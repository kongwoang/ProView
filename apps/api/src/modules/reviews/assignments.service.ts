import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, AssignmentStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { Actor } from '../../common/actor';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policies/policy.service';
import { AssignmentInput, AssignmentResult, solveAssignments } from './assignment-engine';
import { ConflictDecisionDto, ManualAssignmentDto } from './reviews.dto';

const activeStatuses: AssignmentStatus[] = [
  'ASSIGNED',
  'IN_PROGRESS',
  'COI_REQUESTED',
  'SUBMITTED',
];
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: Actor, offeringId?: string, submissionId?: string) {
    if (offeringId) await this.policy.requireOffering(actor, offeringId);
    const staffOfferings = await this.db.courseMembership.findMany({
      where: { userId: actor.id, role: 'INSTRUCTOR', endedAt: null },
      select: { offeringId: true },
    });
    const ownGroups = await this.db.groupMember.findMany({
      where: { userId: actor.id, leftAt: null, membership: { endedAt: null } },
      select: { groupId: true },
    });
    const items = await this.db.reviewerAssignment.findMany({
      where: {
        ...(offeringId ? { offeringId } : {}),
        ...(submissionId ? { submissionId } : {}),
        OR: [
          { offeringId: { in: staffOfferings.map((o) => o.offeringId) } },
          { reviewerGroupId: { in: ownGroups.map((g) => g.groupId) } },
        ],
      },
      include: {
        submission: { include: { project: true, stage: true } },
        reviewerGroup: true,
        review: { include: { draftRevision: true, submittedRevision: true } },
        conflicts: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      items: items.map((a) => ({
        id: a.id,
        submissionId: a.submissionId,
        submissionVersionId: a.submissionVersionId,
        offeringId: a.offeringId,
        projectTitle: a.submission.project.title,
        stageName: a.submission.stage.name,
        deadline: a.submission.stage.reviewDeadline,
        status: a.status,
        reviewerType: a.reviewerType,
        reviewerLabel: a.reviewerGroup?.name ?? 'Instructor',
        reviewerGroupId: a.reviewerGroupId,
        reviewerUserId: a.reviewerUserId,
        required: a.required,
        aliasNumber: a.aliasNumber,
        reviewId: a.review?.id ?? null,
        conflicts: a.conflicts.map((c) => ({
          id: c.id,
          reason: c.reason,
          status: c.status,
          decisionNote: c.decisionNote,
          createdAt: c.createdAt,
        })),
      })),
    };
  }

  private async snapshot(tx: Prisma.TransactionClient, offeringId: string, stageId: string) {
    const stage = await tx.submissionStage.findFirst({
      where: { id: stageId, offeringId },
      include: { offering: true },
    });
    if (!stage) throw new NotFoundException('Stage not found');
    if (
      stage.offering.status !== 'ACTIVE' ||
      !stage.allowReviews ||
      !stage.reviewDeadline ||
      stage.reviewDeadline <= new Date()
    )
      throw new ConflictException('Review assignment window is closed');
    const submissions = await tx.submission.findMany({
      where: {
        stageId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        submittedVersionId: { not: null },
      },
      include: { project: true, assignments: { include: { conflicts: true } } },
      orderBy: { id: 'asc' },
    });
    const groups = await tx.projectGroup.findMany({
      where: {
        offeringId,
        members: {
          some: { leftAt: null, membership: { endedAt: null, user: { isActive: true } } },
        },
      },
      include: {
        members: { include: { membership: { include: { user: { select: { isActive: true } } } } } },
      },
      orderBy: { id: 'asc' },
    });
    const allActive = await tx.reviewerAssignment.findMany({
      where: { offeringId, status: { in: activeStatuses }, reviewerType: 'GROUP' },
      include: { submission: { include: { project: true } } },
      orderBy: { id: 'asc' },
    });
    const excluded: { submissionId: string; reviewerGroupId: string; reason: string }[] = [];
    const input: AssignmentInput = {
      reviewers: groups.map((g) => ({
        id: g.id,
        workload: allActive.filter((a) => a.reviewerGroupId === g.id).length,
      })),
      existingPairs: allActive.map((a) => ({
        reviewerGroupId: a.reviewerGroupId!,
        authorGroupId: a.submission.project.groupId,
      })),
      submissions: submissions.map((s) => {
        const assignments = s.assignments.filter((a) => a.reviewCycle === s.reviewCycle);
        const authorMembers =
          groups.find((g) => g.id === s.project.groupId)?.members.map((m) => m.userId) ?? [];
        const candidates = groups
          .filter((g) => {
            let reason = '';
            if (g.id === s.project.groupId) reason = 'SELF_REVIEW';
            else if (g.members.some((m) => authorMembers.includes(m.userId)))
              reason = 'SHARED_MEMBERSHIP';
            else if (
              assignments.some(
                (a) =>
                  a.reviewerGroupId === g.id && a.conflicts.some((c) => c.status === 'APPROVED'),
              )
            )
              reason = 'APPROVED_COI';
            if (reason) excluded.push({ submissionId: s.id, reviewerGroupId: g.id, reason });
            return !reason;
          })
          .map((g) => g.id);
        return {
          id: s.id,
          authorGroupId: s.project.groupId,
          required: stage.peerReviewCount,
          candidates,
          fixed: assignments
            .filter((a) => a.reviewerGroupId && activeStatuses.includes(a.status))
            .map((a) => a.reviewerGroupId!),
        };
      }),
    };
    return {
      input,
      excluded,
      stage: {
        id: stage.id,
        revision: stage.revision,
        offeringRevision: stage.offering.revision,
        rubricRevisionId: stage.rubricRevisionId,
      },
      submissions: submissions.map((s) => ({
        id: s.id,
        revision: s.revision,
        reviewCycle: s.reviewCycle,
        submittedVersionId: s.submittedVersionId,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        revision: g.revision,
        members: g.members.map((m) => ({
          userId: m.userId,
          leftAt: m.leftAt,
          endedAt: m.membership.endedAt,
          isActive: m.membership.user.isActive,
        })),
      })),
    };
  }

  async preview(actor: Actor, offeringId: string, stageId: string) {
    await this.policy.requireInstructor(actor, offeringId);
    const snapshot = await this.db.$transaction((tx) => this.snapshot(tx, offeringId, stageId), {
      isolationLevel: 'RepeatableRead',
    });
    const result = solveAssignments(snapshot.input);
    const plan = await this.db.assignmentPlan.create({
      data: {
        offeringId,
        stageId,
        createdById: actor.id,
        status: result.status,
        snapshotHash: digest(snapshot),
        snapshot: json(snapshot),
        result: json({ ...result, excludedPairs: snapshot.excluded }),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    return {
      id: plan.id,
      snapshotHash: plan.snapshotHash,
      expiresAt: plan.expiresAt,
      ...result,
      excludedPairs: snapshot.excluded,
    };
  }

  async apply(actor: Actor, planId: string) {
    const plan = await this.db.assignmentPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Assignment plan not found');
    await this.policy.requireInstructor(actor, plan.offeringId);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CourseOffering" WHERE id = ${plan.offeringId}::uuid FOR UPDATE`;
        const currentPlan = await tx.assignmentPlan.findUniqueOrThrow({ where: { id: planId } });
        if (currentPlan.status === 'APPLIED')
          return { id: planId, status: 'APPLIED', alreadyApplied: true };
        if (currentPlan.status !== 'READY' || currentPlan.expiresAt <= new Date())
          throw new ConflictException(
            'Plan is incomplete, unproved, or expired; create another preview',
          );
        const snapshot = await this.snapshot(tx, plan.offeringId, plan.stageId);
        if (digest(snapshot) !== currentPlan.snapshotHash)
          throw new ConflictException('Assignment preview is stale');
        const result = currentPlan.result as unknown as AssignmentResult;
        for (const pair of result.pairs)
          await this.createInTransaction(tx, actor, {
            submissionId: pair.submissionId,
            reviewerType: 'GROUP',
            reviewerGroupId: pair.reviewerGroupId,
          });
        await tx.assignmentPlan.update({
          where: { id: planId },
          data: { status: 'APPLIED', appliedAt: new Date() },
        });
        await this.audit.record(tx, actor, 'ASSIGNMENT_PLAN_APPLIED', 'AssignmentPlan', planId, {
          count: result.pairs.length,
        });
        return { id: planId, status: 'APPLIED', count: result.pairs.length };
      },
      { isolationLevel: 'Serializable', timeout: 30_000 },
    );
  }

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    actor: Actor,
    input: ManualAssignmentDto,
    previousAssignmentId?: string,
  ) {
    const s = await tx.submission.findUnique({
      where: { id: input.submissionId },
      include: {
        project: { include: { group: { include: { members: true } } } },
        stage: true,
        offering: true,
      },
    });
    if (!s) throw new NotFoundException('Submission not found');
    if (
      s.offering.status !== 'ACTIVE' ||
      !['SUBMITTED', 'UNDER_REVIEW'].includes(s.status) ||
      !s.submittedVersionId ||
      !s.stage.allowReviews ||
      !s.stage.reviewDeadline ||
      s.stage.reviewDeadline <= new Date()
    )
      throw new ConflictException('Submission cannot accept review assignments');
    if (input.reviewerType === 'GROUP') {
      if (!input.reviewerGroupId || input.reviewerUserId)
        throw new UnprocessableEntityException('Specify exactly one reviewer group');
      const group = await tx.projectGroup.findFirst({
        where: { id: input.reviewerGroupId, offeringId: s.offeringId },
        include: { members: { include: { membership: { include: { user: true } } } } },
      });
      if (
        !group ||
        !group.members.some((m) => !m.leftAt && !m.membership.endedAt && m.membership.user.isActive)
      )
        throw new UnprocessableEntityException('Reviewer group has no eligible members');
      if (
        group.id === s.project.groupId ||
        group.members.some((m) => s.project.group.members.some((a) => a.userId === m.userId))
      )
        throw new UnprocessableEntityException(
          'Self-review and shared-membership review are forbidden',
        );
    } else {
      if (
        !input.reviewerUserId ||
        input.reviewerGroupId ||
        !(await tx.courseMembership.findFirst({
          where: {
            offeringId: s.offeringId,
            userId: input.reviewerUserId,
            role: 'INSTRUCTOR',
            endedAt: null,
            user: { isActive: true },
          },
        }))
      )
        throw new UnprocessableEntityException('Select an active instructor in this offering');
    }
    const prior = await tx.reviewerAssignment.findMany({
      where: { submissionId: s.id, reviewCycle: s.reviewCycle },
      include: { conflicts: true },
    });
    const sameTarget = prior.filter((a) =>
      input.reviewerType === 'GROUP'
        ? a.reviewerGroupId === input.reviewerGroupId
        : a.reviewerUserId === input.reviewerUserId,
    );
    if (
      sameTarget.some(
        (a) =>
          activeStatuses.includes(a.status) || a.conflicts.some((c) => c.status === 'APPROVED'),
      )
    )
      throw new ConflictException(
        'Reviewer is already assigned or has approved conflict of interest',
      );
    const assignment = await tx.reviewerAssignment.create({
      data: {
        submissionId: s.id,
        submissionVersionId: s.submittedVersionId,
        offeringId: s.offeringId,
        rubricRevisionId: s.stage.rubricRevisionId,
        reviewCycle: s.reviewCycle,
        reviewerType: input.reviewerType,
        reviewerGroupId: input.reviewerGroupId,
        reviewerUserId: input.reviewerUserId,
        required: input.required ?? true,
        aliasNumber: Math.max(0, ...prior.map((a) => a.aliasNumber)) + 1,
        assignedById: actor.id,
        previousAssignmentId,
      },
    });
    await tx.submission.update({
      where: { id: s.id },
      data: {
        status: 'UNDER_REVIEW',
        inputLockedAt: s.inputLockedAt ?? new Date(),
        revision: { increment: 1 },
      },
    });
    await this.audit.record(tx, actor, 'REVIEWER_ASSIGNED', 'ReviewerAssignment', assignment.id);
    const recipients = assignment.reviewerGroupId
      ? await this.audit.groupRecipients(assignment.reviewerGroupId, tx)
      : [assignment.reviewerUserId!];
    await this.audit.notify(
      tx,
      {
        recipients,
        type: 'REVIEW_ASSIGNED',
        title: 'New review assignment',
        body: 'A project submission is ready for your review.',
        targetUrl: `/reviews/${assignment.id}`,
      },
      `assignment:${assignment.id}`,
    );
    return assignment;
  }

  async manual(actor: Actor, input: ManualAssignmentDto) {
    const s = await this.policy.submissionContext(input.submissionId);
    await this.policy.requireInstructor(actor, s.offeringId);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CourseOffering" WHERE id = ${s.offeringId}::uuid FOR UPDATE`;
        return this.createInTransaction(tx, actor, input);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async cancel(actor: Actor, id: string, reason: string) {
    if (!reason.trim()) throw new UnprocessableEntityException('Reason is required');
    const assignment = await this.db.reviewerAssignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.policy.requireInstructor(actor, assignment.offeringId);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.reviewerAssignment.updateMany({
        where: { id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        data: { status: 'CANCELLED', cancelledReason: reason },
      });
      if (!updated.count)
        throw new ConflictException('Only an active, unsubmitted assignment can be cancelled');
      await this.audit.record(tx, actor, 'ASSIGNMENT_CANCELLED', 'ReviewerAssignment', id, {
        reason,
      });
      return { id, status: 'CANCELLED' };
    });
  }

  async conflict(actor: Actor, id: string, reason: string) {
    if (!reason.trim()) throw new UnprocessableEntityException('Reason is required');
    if (!(await this.policy.canReviewAssignment(actor, id)))
      throw new NotFoundException('Assignment not found');
    return this.db.$transaction(
      async (tx) => {
        const a = await tx.reviewerAssignment.findUniqueOrThrow({
          where: { id },
          include: { submission: true },
        });
        if (
          !['ASSIGNED', 'IN_PROGRESS'].includes(a.status) ||
          a.reviewCycle !== a.submission.reviewCycle
        )
          throw new ConflictException('Conflict declaration is unavailable for this assignment');
        const claimed = await tx.reviewerAssignment.updateMany({
          where: { id, status: a.status },
          data: { status: 'COI_REQUESTED' },
        });
        if (!claimed.count) throw new ConflictException('Assignment changed');
        const conflict = await tx.conflictOfInterestDeclaration.create({
          data: {
            assignmentId: id,
            declaredById: actor.id,
            reason,
            previousAssignmentStatus: a.status,
          },
        });
        await this.audit.record(
          tx,
          actor,
          'COI_DECLARED',
          'ConflictOfInterestDeclaration',
          conflict.id,
        );
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.instructorRecipients(a.offeringId, tx),
            type: 'COI_DECLARED',
            title: 'Conflict declaration needs review',
            body: 'An assigned reviewer has declared a conflict of interest.',
            targetUrl: '/review-management',
          },
          `coi:${conflict.id}`,
        );
        return { id: conflict.id, status: conflict.status, reason: conflict.reason };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async decideConflict(actor: Actor, id: string, input: ConflictDecisionDto) {
    if (!input.note.trim()) throw new UnprocessableEntityException('Decision note is required');
    const conflict = await this.db.conflictOfInterestDeclaration.findUnique({
      where: { id },
      include: { assignment: true },
    });
    if (!conflict) throw new NotFoundException('Conflict declaration not found');
    await this.policy.requireInstructor(actor, conflict.assignment.offeringId);
    return this.db.$transaction(
      async (tx) => {
        const claimed = await tx.conflictOfInterestDeclaration.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            status: input.decision,
            decisionNote: input.note,
            decidedById: actor.id,
            decidedAt: new Date(),
          },
        });
        if (!claimed.count) throw new ConflictException('Conflict declaration was already decided');
        const assignment = await tx.reviewerAssignment.updateMany({
          where: { id: conflict.assignmentId, status: 'COI_REQUESTED' },
          data: {
            status:
              input.decision === 'APPROVED'
                ? 'REASSIGNMENT_APPROVED'
                : conflict.previousAssignmentStatus,
          },
        });
        if (!assignment.count) throw new ConflictException('Assignment state changed');
        await this.audit.record(
          tx,
          actor,
          `COI_${input.decision}`,
          'ConflictOfInterestDeclaration',
          id,
          { note: input.note },
        );
        const a = conflict.assignment;
        await this.audit.notify(
          tx,
          {
            recipients: a.reviewerGroupId
              ? await this.audit.groupRecipients(a.reviewerGroupId, tx)
              : [a.reviewerUserId!],
            type: 'COI_DECIDED',
            title: 'Conflict declaration decided',
            body: `Your conflict declaration was ${input.decision.toLowerCase()}.`,
            targetUrl: '/reviews',
          },
          `coi-decision:${id}`,
        );
        return { id, status: input.decision };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async replacement(actor: Actor, id: string, input: ManualAssignmentDto) {
    const old = await this.db.reviewerAssignment.findUnique({ where: { id } });
    if (!old) throw new NotFoundException('Assignment not found');
    await this.policy.requireInstructor(actor, old.offeringId);
    if (old.submissionId !== input.submissionId)
      throw new ForbiddenException('Replacement must remain in the same submission');
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CourseOffering" WHERE id = ${old.offeringId}::uuid FOR UPDATE`;
        const claimed = await tx.reviewerAssignment.updateMany({
          where: { id, status: 'REASSIGNMENT_APPROVED' },
          data: { status: 'REASSIGNED' },
        });
        if (!claimed.count)
          throw new ConflictException('Assignment is not approved for replacement');
        const next = await this.createInTransaction(tx, actor, input, id);
        await this.audit.record(tx, actor, 'ASSIGNMENT_REPLACED', 'ReviewerAssignment', id, {
          replacementId: next.id,
        });
        return next;
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
