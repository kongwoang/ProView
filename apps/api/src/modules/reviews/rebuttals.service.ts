import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Actor } from '../../common/actor';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policies/policy.service';
import { DiscussionDto, RebuttalDraftDto, ReopenRebuttalDto } from './reviews.dto';

@Injectable()
export class RebuttalsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private expiring = false;
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expire().catch(() => undefined);
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async expire() {
    if (this.expiring) return;
    this.expiring = true;
    try {
      const now = new Date();
      const rows = await this.db.rebuttal.findMany({
        where: {
          status: 'DRAFT',
          submission: { status: 'REBUTTAL_OPEN', offering: { status: 'ACTIVE' } },
          OR: [
            { reopenUntil: { lte: now } },
            { reopenUntil: null, submission: { stage: { rebuttalDeadline: { lte: now } } } },
          ],
        },
        take: 100,
      });
      for (const row of rows)
        await this.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${row.submissionId}::uuid FOR UPDATE`;
          const current = await tx.rebuttal.findUniqueOrThrow({
            where: { id: row.id },
            include: { responses: true, submission: { include: { stage: true } } },
          });
          const deadline = current.reopenUntil ?? current.submission.stage.rebuttalDeadline;
          if (
            current.status !== 'DRAFT' ||
            current.submission.status !== 'REBUTTAL_OPEN' ||
            current.reviewCycle !== current.submission.reviewCycle ||
            !deadline ||
            deadline > new Date()
          )
            return;
          await tx.rebuttalSnapshot.create({
            data: {
              rebuttalId: row.id,
              revision: current.revision,
              generalResponse: current.generalResponse,
              responses: current.responses.map((r) => ({
                reviewId: r.reviewId,
                content: r.content,
              })),
              finalizedAt: new Date(),
              authorId: current.authorId,
            },
          });
          await tx.rebuttal.update({
            where: { id: row.id },
            data: { status: 'EXPIRED', finalizedAt: new Date() },
          });
          await tx.submission.update({
            where: { id: row.submissionId },
            data: { status: 'REVIEW_COMPLETED', revision: { increment: 1 } },
          });
          await this.audit.record(tx, null, 'REBUTTAL_EXPIRED', 'Rebuttal', row.id);
        });
    } finally {
      this.expiring = false;
    }
  }
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  async get(actor: Actor, submissionId: string) {
    const s = await this.policy.requireSubmissionView(actor, submissionId);
    const staff = await this.policy.isInstructor(actor, s.offeringId);
    const author = await this.policy.isGroupMember(actor, s.project.groupId);
    const rebuttal = await this.db.rebuttal.findUnique({
      where: { submissionId_reviewCycle: { submissionId, reviewCycle: s.reviewCycle } },
      include: { responses: true, snapshots: { orderBy: { revision: 'asc' } } },
    });
    if (!rebuttal || (!staff && !author && rebuttal.status !== 'FINALIZED')) return null;
    return {
      id: rebuttal.id,
      submissionId,
      reviewCycle: rebuttal.reviewCycle,
      generalResponse: rebuttal.generalResponse,
      status: rebuttal.status,
      revision: rebuttal.revision,
      finalizedAt: rebuttal.finalizedAt,
      history: rebuttal.snapshots.map((snapshot) => ({
        revision: snapshot.revision,
        generalResponse: snapshot.generalResponse,
        responses: snapshot.responses,
        finalizedAt: snapshot.finalizedAt,
      })),
      deadline: rebuttal.reopenUntil ?? s.stage.rebuttalDeadline,
      responses: rebuttal.responses.map((r) => ({ reviewId: r.reviewId, content: r.content })),
      canEdit:
        author &&
        s.offering.status === 'ACTIVE' &&
        s.status === 'REBUTTAL_OPEN' &&
        rebuttal.status === 'DRAFT' &&
        (rebuttal.reopenUntil ?? s.stage.rebuttalDeadline ?? new Date(0)) > new Date(),
    };
  }

  async save(actor: Actor, submissionId: string, input: RebuttalDraftDto) {
    await this.policy.requireAuthor(actor, submissionId);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${submissionId}::uuid FOR UPDATE`;
        const current = await tx.submission.findUniqueOrThrow({
          where: { id: submissionId },
          include: { stage: true, offering: true },
        });
        const rebuttal = await tx.rebuttal.findUnique({
          where: { submissionId_reviewCycle: { submissionId, reviewCycle: current.reviewCycle } },
        });
        const deadline = rebuttal?.reopenUntil ?? current.stage.rebuttalDeadline;
        if (
          !rebuttal ||
          current.status !== 'REBUTTAL_OPEN' ||
          current.offering.status !== 'ACTIVE' ||
          rebuttal.status !== 'DRAFT' ||
          !deadline ||
          deadline <= new Date()
        )
          throw new ConflictException('Rebuttal editing window is closed');
        const visible = await tx.review.findMany({
          where: {
            submissionId,
            reviewCycle: current.reviewCycle,
            releasedAt: { not: null },
            submittedRevisionId: { not: null },
          },
          select: { id: true },
        });
        if (input.responses.some((r) => !visible.some((v) => v.id === r.reviewId)))
          throw new UnprocessableEntityException(
            'Response must reference a released review in this submission',
          );
        const changed = await tx.rebuttal.updateMany({
          where: { id: rebuttal.id, revision: input.revision, status: 'DRAFT' },
          data: {
            generalResponse: input.generalResponse,
            authorId: actor.id,
            revision: { increment: 1 },
          },
        });
        if (!changed.count)
          throw new ConflictException('Rebuttal draft changed; reload before saving');
        await tx.rebuttalReviewResponse.deleteMany({ where: { rebuttalId: rebuttal.id } });
        await tx.rebuttalReviewResponse.createMany({
          data: input.responses.map((r) => ({
            rebuttalId: rebuttal.id,
            reviewId: r.reviewId,
            submissionId,
            reviewCycle: current.reviewCycle,
            content: r.content,
          })),
        });
        await this.audit.record(tx, actor, 'REBUTTAL_DRAFT_SAVED', 'Rebuttal', rebuttal.id, {
          revision: input.revision + 1,
        });
        return { id: rebuttal.id, revision: input.revision + 1, status: 'DRAFT' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async finalize(actor: Actor, id: string, revision: number) {
    const rebuttal = await this.db.rebuttal.findUnique({ where: { id } });
    if (!rebuttal) throw new NotFoundException('Rebuttal not found');
    const s = await this.policy.requireAuthor(actor, rebuttal.submissionId);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${s.id}::uuid FOR UPDATE`;
        const current = await tx.rebuttal.findUniqueOrThrow({
          where: { id },
          include: { responses: true, submission: { include: { stage: true, offering: true } } },
        });
        if (current.status === 'FINALIZED' && current.revision === revision)
          return { id, status: 'FINALIZED', alreadyFinalized: true };
        const deadline = current.reopenUntil ?? current.submission.stage.rebuttalDeadline;
        if (
          current.revision !== revision ||
          current.status !== 'DRAFT' ||
          current.reviewCycle !== current.submission.reviewCycle ||
          current.submission.status !== 'REBUTTAL_OPEN' ||
          current.submission.offering.status !== 'ACTIVE' ||
          !deadline ||
          deadline <= new Date()
        )
          throw new ConflictException('Rebuttal is stale or editing window is closed');
        if (!current.generalResponse.trim())
          throw new UnprocessableEntityException('General response is required');
        await tx.rebuttalSnapshot.create({
          data: {
            rebuttalId: id,
            revision: current.revision,
            generalResponse: current.generalResponse,
            responses: current.responses.map((r) => ({ reviewId: r.reviewId, content: r.content })),
            finalizedAt: new Date(),
            authorId: actor.id,
          },
        });
        await tx.rebuttal.update({
          where: { id },
          data: { status: 'FINALIZED', finalizedAt: new Date(), authorId: actor.id },
        });
        await tx.submission.update({
          where: { id: s.id },
          data: { status: 'REVIEW_COMPLETED', revision: { increment: 1 } },
        });
        await this.audit.record(tx, actor, 'REBUTTAL_FINALIZED', 'Rebuttal', id);
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.instructorRecipients(s.offeringId, tx),
            type: 'REBUTTAL_FINALIZED',
            title: 'Rebuttal finalized',
            body: 'An author group has finalized its rebuttal.',
            targetUrl: `/submissions/${s.id}`,
          },
          `rebuttal-finalized:${id}:${revision}`,
        );
        return { id, status: 'FINALIZED' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async reopen(actor: Actor, id: string, input: ReopenRebuttalDto) {
    const rebuttal = await this.db.rebuttal.findUnique({
      where: { id },
      include: { submission: { include: { grade: true, offering: true } } },
    });
    if (!rebuttal) throw new NotFoundException('Rebuttal not found');
    await this.policy.requireInstructor(actor, rebuttal.submission.offeringId);
    if (!input.reason.trim() || new Date(input.deadline) <= new Date())
      throw new UnprocessableEntityException('Reason and future deadline are required');
    if (rebuttal.submission.grade?.publishedRevisionId && !input.acknowledgePublishedGrade)
      throw new ConflictException(
        'A published grade exists; acknowledge that it remains unchanged until explicit regrading',
      );
    if (
      rebuttal.submission.offering.status !== 'ACTIVE' ||
      rebuttal.reviewCycle !== rebuttal.submission.reviewCycle ||
      !['REVIEW_COMPLETED', 'FINALIZED', 'REBUTTAL_OPEN'].includes(rebuttal.submission.status)
    )
      throw new ConflictException('Rebuttal is not available for reopening');
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${rebuttal.submissionId}::uuid FOR UPDATE`;
        const current = await tx.rebuttal.findUniqueOrThrow({ where: { id } });
        if (current.revision !== rebuttal.revision) throw new ConflictException('Rebuttal changed');
        await tx.rebuttal.update({
          where: { id },
          data: {
            status: 'DRAFT',
            reopenUntil: new Date(input.deadline),
            reopenedById: actor.id,
            reopenReason: input.reason,
            revision: { increment: 1 },
          },
        });
        await tx.submission.update({
          where: { id: rebuttal.submissionId },
          data: { status: 'REBUTTAL_OPEN', revision: { increment: 1 } },
        });
        await this.audit.record(tx, actor, 'REBUTTAL_REOPENED', 'Rebuttal', id, {
          reason: input.reason,
          deadline: input.deadline,
          previousFinalizedAt: current.finalizedAt?.toISOString() ?? null,
        });
        return { id, status: 'DRAFT', revision: current.revision + 1, deadline: input.deadline };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async discussionAudience(actor: Actor, submissionId: string, reviewId?: string) {
    const s = await this.policy.requireSubmissionView(actor, submissionId);
    const staff = await this.policy.isInstructor(actor, s.offeringId);
    const author = await this.policy.isGroupMember(actor, s.project.groupId);
    if (!staff && !s.reviewsReleasedAt)
      throw new ConflictException('Discussion opens when reviews are released');
    if (reviewId) {
      const review = await this.db.review.findFirst({
        where: { id: reviewId, submissionId, reviewCycle: s.reviewCycle },
      });
      if (!review || (!staff && !review.releasedAt))
        throw new NotFoundException('Review context not found');
      if (!staff && !author && !(await this.policy.canReviewAssignment(actor, review.assignmentId)))
        throw new NotFoundException('Review context not found');
    }
    return { s, staff, author };
  }

  async discussions(actor: Actor, submissionId: string) {
    const { s, staff, author } = await this.discussionAudience(actor, submissionId);
    const assignments = await this.db.reviewerAssignment.findMany({
      where: { submissionId, reviewCycle: s.reviewCycle },
      include: { reviewerGroup: { include: { members: true } }, review: true },
    });
    const own = [] as string[];
    for (const assignment of assignments)
      if (assignment.review && (await this.policy.canReviewAssignment(actor, assignment.id)))
        own.push(assignment.review.id);
    const rows = await this.db.discussionMessage.findMany({
      where: {
        submissionId,
        reviewCycle: s.reviewCycle,
        ...(!staff && !author ? { OR: [{ reviewId: null }, { reviewId: { in: own } }] } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    const authorMembers = await this.db.groupMember.findMany({
      where: { groupId: s.project.groupId },
      select: { userId: true },
    });
    const items = [];
    for (const row of rows) {
      const identity = staff || s.offering.anonymityMode === 'NAMED' || row.authorId === actor.id;
      const reviewer = assignments.find(
        (a) =>
          a.reviewerUserId === row.authorId ||
          a.reviewerGroup?.members.some((m) => m.userId === row.authorId),
      );
      const member = authorMembers.some((m) => m.userId === row.authorId);
      const user =
        identity || member
          ? await this.db.user.findUnique({
              where: { id: row.authorId },
              select: { displayName: true },
            })
          : null;
      const label =
        user?.displayName ?? (reviewer ? `Reviewer ${reviewer.aliasNumber}` : 'Instructor');
      items.push({
        id: row.id,
        submissionId,
        reviewId: row.reviewId,
        content: row.content,
        createdAt: row.createdAt,
        authorLabel: label,
        ...(identity || member ? { authorId: row.authorId } : {}),
      });
    }
    return { items };
  }

  async postDiscussion(actor: Actor, submissionId: string, input: DiscussionDto) {
    const { s } = await this.discussionAudience(actor, submissionId, input.reviewId);
    if (
      s.offering.status !== 'ACTIVE' ||
      !['UNDER_REVIEW', 'REBUTTAL_OPEN', 'REVIEW_COMPLETED'].includes(s.status)
    )
      throw new ConflictException('Discussion is closed');
    const content = input.content.trim();
    if (!content) throw new UnprocessableEntityException('Discussion content is required');
    const created = await this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${submissionId}::uuid FOR UPDATE`;
        const current = await tx.submission.findUniqueOrThrow({ where: { id: submissionId } });
        if (current.reviewCycle !== s.reviewCycle || current.status !== s.status)
          throw new ConflictException('Submission changed');
        const message = await tx.discussionMessage.create({
          data: {
            submissionId,
            reviewId: input.reviewId,
            reviewCycle: s.reviewCycle,
            authorId: actor.id,
            content,
          },
        });
        await this.audit.record(tx, actor, 'DISCUSSION_POSTED', 'DiscussionMessage', message.id);
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.instructorRecipients(s.offeringId, tx),
            type: 'DISCUSSION_POSTED',
            title: 'New submission discussion',
            body: 'A new message was posted in a submission discussion.',
            targetUrl: `/submissions/${submissionId}`,
          },
          `discussion:${message.id}`,
        );
        return message.id;
      },
      { isolationLevel: 'Serializable' },
    );
    // Reuse the audience presenter for the creation response; never return the ORM row.
    return (await this.discussions(actor, submissionId)).items.find((m) => m.id === created);
  }
}
