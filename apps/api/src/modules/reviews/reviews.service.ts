import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../common/actor';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policies/policy.service';
import { CorrectionDto, ReleaseDto, ReviewDraftDto } from './reviews.dto';

const revisionInclude = {
  responses: { include: { criterion: true } },
} satisfies Prisma.ReviewRevisionInclude;
const reviewInclude = {
  assignment: { include: { reviewerGroup: true } },
  draftRevision: { include: revisionInclude },
  submittedRevision: { include: revisionInclude },
} satisfies Prisma.ReviewInclude;
type PresentedReview = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  private async assignment(actor: Actor, id: string, forWrite = false) {
    const a = await this.db.reviewerAssignment.findUnique({
      where: { id },
      include: {
        submission: { include: { project: true, stage: true, offering: true } },
        rubricRevision: { include: { criteria: { orderBy: { sequence: 'asc' } } } },
        review: { include: reviewInclude },
      },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    const owner = await this.policy.canReviewAssignment(actor, id);
    const staff = await this.policy.isInstructor(actor, a.offeringId);
    if (!(forWrite ? owner : owner || staff)) throw new NotFoundException('Assignment not found');
    if (forWrite) {
      const correction = a.review?.draftRevision?.correctionDeadline;
      const deadline = correction ?? a.submission.stage.reviewDeadline;
      if (
        a.submission.offering.status !== 'ACTIVE' ||
        a.reviewCycle !== a.submission.reviewCycle ||
        a.submissionVersionId !== a.submission.submittedVersionId ||
        !deadline ||
        deadline <= new Date() ||
        !['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(a.status)
      )
        throw new ConflictException('Review window is closed or this evidence has been superseded');
      if (!correction && a.submission.status !== 'UNDER_REVIEW')
        throw new ConflictException('Review evidence is locked');
      if (a.status === 'SUBMITTED' && !correction)
        throw new ConflictException(
          'Submitted review requires instructor correction authorization',
        );
    }
    return a;
  }

  private revisionView(revision: PresentedReview['submittedRevision']) {
    if (!revision) return null;
    return {
      id: revision.id,
      revision: revision.revision,
      revisionNumber: revision.revisionNumber,
      status: revision.status,
      strengths: revision.strengths,
      weaknesses: revision.weaknesses,
      overallComment: revision.overallComment,
      recommendation: revision.recommendation,
      submittedAt: revision.submittedAt,
      responses: revision.responses.map((r) => ({
        criterionId: r.criterionId,
        criterionTitle: r.criterion.title,
        score: Number(r.score),
        comment: r.comment,
      })),
    };
  }

  private async present(
    actor: Actor,
    review: PresentedReview,
    staff: boolean,
    named: boolean,
    owner: boolean,
  ) {
    const identity = staff || named || owner;
    let label = `Reviewer ${review.assignment.aliasNumber}`;
    if (identity) {
      label =
        review.assignment.reviewerGroup?.name ??
        (
          await this.db.user.findUnique({
            where: { id: review.assignment.reviewerUserId! },
            select: { displayName: true },
          })
        )?.displayName ??
        'Instructor';
    }
    return {
      id: review.id,
      submissionId: review.submissionId,
      submissionVersionId: review.submissionVersionId,
      reviewCycle: review.reviewCycle,
      reviewerLabel: label,
      releasedAt: review.releasedAt,
      supersededAt: review.supersededAt,
      submittedRevision: this.revisionView(review.submittedRevision),
      ...(staff || owner
        ? {
            assignmentId: review.assignmentId,
            draftRevision: this.revisionView(review.draftRevision),
          }
        : {}),
      ...(identity
        ? {
            reviewerGroupId: review.assignment.reviewerGroupId,
            reviewerUserId: review.assignment.reviewerUserId,
            submittedById: review.submittedRevision?.submittedById,
          }
        : {}),
    };
  }

  async getAssignmentReview(actor: Actor, id: string) {
    const a = await this.assignment(actor, id);
    return {
      assignment: {
        id: a.id,
        submissionId: a.submissionId,
        submissionVersionId: a.submissionVersionId,
        status: a.status,
        reviewCycle: a.reviewCycle,
        projectTitle: a.submission.project.title,
        stageName: a.submission.stage.name,
        deadline: a.review?.draftRevision?.correctionDeadline ?? a.submission.stage.reviewDeadline,
      },
      rubric: {
        id: a.rubricRevision.id,
        requireOverallComment: a.rubricRevision.requireOverallComment,
        requireRecommendation: a.rubricRevision.requireRecommendation,
        recommendationOptions: a.rubricRevision.recommendationOptions,
        criteria: a.rubricRevision.criteria.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          weight: Number(c.weight),
          scoreMin: Number(c.scoreMin),
          scoreMax: Number(c.scoreMax),
          required: c.required,
          requireComment: c.requireComment,
          sequence: c.sequence,
        })),
      },
      review: a.review
        ? await this.present(
            actor,
            a.review,
            await this.policy.isInstructor(actor, a.offeringId),
            false,
            await this.policy.canReviewAssignment(actor, id),
          )
        : null,
    };
  }

  async list(actor: Actor, submissionId: string) {
    const s = await this.policy.requireSubmissionView(actor, submissionId);
    const staff = await this.policy.isInstructor(actor, s.offeringId);
    const author = await this.policy.isGroupMember(actor, s.project.groupId);
    const reviews = await this.db.review.findMany({
      where: { submissionId },
      include: reviewInclude,
      orderBy: [{ reviewCycle: 'asc' }, { createdAt: 'asc' }],
    });
    const items = [];
    for (const review of reviews) {
      const owner = await this.policy.canReviewAssignment(actor, review.assignmentId);
      if (!staff && !owner && !(author && review.releasedAt && review.submittedRevisionId))
        continue;
      items.push(
        await this.present(
          actor,
          review,
          staff,
          author && s.offering.anonymityMode === 'NAMED' && !!review.releasedAt,
          owner,
        ),
      );
    }
    return { items };
  }

  async save(actor: Actor, assignmentId: string, input: ReviewDraftDto) {
    const a = await this.assignment(actor, assignmentId, true);
    const criterionById = new Map(a.rubricRevision.criteria.map((c) => [c.id, c]));
    for (const response of input.responses) {
      const c = criterionById.get(response.criterionId);
      if (!c || response.score < Number(c.scoreMin) || response.score > Number(c.scoreMax))
        throw new UnprocessableEntityException(
          'Criterion does not belong to the rubric or score is out of range',
        );
    }
    if (
      input.recommendation &&
      !(a.rubricRevision.recommendationOptions as string[]).includes(input.recommendation)
    )
      throw new UnprocessableEntityException('Invalid recommendation');
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${a.submissionId}::uuid FOR UPDATE`;
        const current = await tx.reviewerAssignment.findUniqueOrThrow({
          where: { id: assignmentId },
          include: {
            submission: { include: { stage: true, offering: true } },
            review: { include: { draftRevision: true } },
          },
        });
        if (
          current.reviewCycle !== current.submission.reviewCycle ||
          !['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(current.status)
        )
          throw new ConflictException('Assignment changed');
        const effectiveDeadline =
          current.review?.draftRevision?.correctionDeadline ??
          current.submission.stage.reviewDeadline;
        const correction = !!current.review?.draftRevision?.correctionDeadline;
        if (
          current.submission.offering.status !== 'ACTIVE' ||
          (!correction && current.submission.status !== 'UNDER_REVIEW') ||
          !effectiveDeadline ||
          effectiveDeadline <= new Date()
        )
          throw new ConflictException('Review window is closed');
        const isOwner =
          current.reviewerType === 'INSTRUCTOR'
            ? current.reviewerUserId === actor.id &&
              !!(await tx.courseMembership.findFirst({
                where: {
                  offeringId: current.offeringId,
                  userId: actor.id,
                  role: 'INSTRUCTOR',
                  endedAt: null,
                },
              }))
            : !!(await tx.groupMember.findFirst({
                where: {
                  groupId: current.reviewerGroupId!,
                  userId: actor.id,
                  leftAt: null,
                  membership: { endedAt: null },
                },
              }));
        if (!isOwner) throw new NotFoundException('Assignment not found');
        let review = current.review;
        if (!review)
          review = {
            ...(await tx.review.create({
              data: {
                assignmentId,
                submissionId: a.submissionId,
                submissionVersionId: a.submissionVersionId,
                rubricRevisionId: a.rubricRevisionId,
                reviewCycle: a.reviewCycle,
              },
            })),
            draftRevision: null,
          };
        let draft = review.draftRevision;
        if (!draft) {
          if (review.submittedRevisionId || input.revision !== 0)
            throw new ConflictException(
              'Draft revision is stale or correction has not been authorized',
            );
          draft = await tx.reviewRevision.create({
            data: { reviewId: review.id, rubricRevisionId: a.rubricRevisionId, revisionNumber: 1 },
          });
          await tx.review.update({ where: { id: review.id }, data: { draftRevisionId: draft.id } });
        }
        if (draft.status !== 'DRAFT' || draft.revision !== input.revision)
          throw new ConflictException('Draft changed; reload before saving');
        if (draft.correctionDeadline && draft.correctionDeadline <= new Date())
          throw new ConflictException('Correction deadline passed');
        const updated = await tx.reviewRevision.updateMany({
          where: { id: draft.id, revision: input.revision, status: 'DRAFT' },
          data: {
            strengths: input.strengths,
            weaknesses: input.weaknesses,
            overallComment: input.overallComment,
            recommendation: input.recommendation ?? null,
            revision: { increment: 1 },
          },
        });
        if (!updated.count) throw new ConflictException('Draft changed');
        await tx.reviewCriterionResponse.deleteMany({ where: { reviewRevisionId: draft.id } });
        await tx.reviewCriterionResponse.createMany({
          data: input.responses.map((r) => ({
            reviewRevisionId: draft!.id,
            criterionId: r.criterionId,
            rubricRevisionId: a.rubricRevisionId,
            score: new Prisma.Decimal(r.score),
            comment: r.comment,
          })),
        });
        if (current.status === 'ASSIGNED')
          await tx.reviewerAssignment.update({
            where: { id: assignmentId },
            data: { status: 'IN_PROGRESS' },
          });
        await this.audit.record(tx, actor, 'REVIEW_DRAFT_SAVED', 'Review', review.id, {
          revision: input.revision + 1,
        });
        return { id: review.id, revision: input.revision + 1, status: 'DRAFT' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async submit(actor: Actor, reviewId: string, revision: number) {
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });
    if (!review) throw new NotFoundException('Review not found');
    if (!(await this.policy.canReviewAssignment(actor, review.assignmentId)))
      throw new NotFoundException('Review not found');
    if (!review.draftRevision && review.submittedRevision?.revision === revision)
      return { id: review.id, status: 'SUBMITTED', alreadySubmitted: true };
    const a = await this.assignment(actor, review.assignmentId, true);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${review.submissionId}::uuid FOR UPDATE`;
        const current = await tx.review.findUniqueOrThrow({
          where: { id: reviewId },
          include: {
            draftRevision: { include: { responses: true } },
            assignment: { include: { submission: { include: { stage: true, offering: true } } } },
          },
        });
        const draft = current.draftRevision;
        if (
          !draft ||
          draft.revision !== revision ||
          draft.status !== 'DRAFT' ||
          !['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(current.assignment.status) ||
          current.reviewCycle !== current.assignment.submission.reviewCycle
        )
          throw new ConflictException('Review changed; reload before submitting');
        const deadline =
          draft.correctionDeadline ?? current.assignment.submission.stage.reviewDeadline;
        if (
          current.assignment.submission.offering.status !== 'ACTIVE' ||
          (!draft.correctionDeadline && current.assignment.submission.status !== 'UNDER_REVIEW')
        )
          throw new ConflictException('Submission evidence is locked');
        if (!deadline || deadline <= new Date())
          throw new ConflictException('Review deadline passed');
        for (const c of a.rubricRevision.criteria) {
          const response = draft.responses.find((r) => r.criterionId === c.id);
          if (c.required && !response)
            throw new UnprocessableEntityException('Every required criterion needs a score');
          if (
            response &&
            (Number(response.score) < Number(c.scoreMin) ||
              Number(response.score) > Number(c.scoreMax) ||
              (c.requireComment && !response.comment.trim()))
          )
            throw new UnprocessableEntityException('Criterion score or comment is incomplete');
        }
        if (a.rubricRevision.requireOverallComment && !draft.overallComment.trim())
          throw new UnprocessableEntityException('Overall comments are required');
        if (
          a.rubricRevision.requireRecommendation &&
          (!draft.recommendation ||
            !(a.rubricRevision.recommendationOptions as string[]).includes(draft.recommendation))
        )
          throw new UnprocessableEntityException('Recommendation is required');
        await tx.reviewRevision.update({
          where: { id: draft.id },
          data: { status: 'SUBMITTED', submittedById: actor.id, submittedAt: new Date() },
        });
        await tx.review.update({
          where: { id: reviewId },
          data: { submittedRevisionId: draft.id, draftRevisionId: null },
        });
        await tx.reviewerAssignment.update({
          where: { id: current.assignmentId },
          data: { status: 'SUBMITTED' },
        });
        await this.audit.record(
          tx,
          actor,
          draft.revisionNumber > 1 ? 'REVIEW_CORRECTION_SUBMITTED' : 'REVIEW_SUBMITTED',
          'Review',
          reviewId,
          { revisionNumber: draft.revisionNumber },
        );
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.instructorRecipients(a.offeringId, tx),
            type: 'REVIEW_SUBMITTED',
            title: 'Review submitted',
            body: 'An assigned review has been submitted.',
            targetUrl: `/submissions/${a.submissionId}`,
          },
          `review-submitted:${draft.id}`,
        );
        if (current.releasedAt)
          await this.audit.notify(
            tx,
            {
              recipients: await this.audit.groupRecipients(a.submission.project.groupId, tx),
              type: 'REVIEW_CORRECTED',
              title: 'A review correction is available',
              body: 'A released review has an updated revision. The previous evidence remains in history.',
              targetUrl: `/submissions/${a.submissionId}`,
            },
            `review-correction:${draft.id}`,
          );
        return { id: reviewId, status: 'SUBMITTED' };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async authorizeCorrection(actor: Actor, reviewId: string, input: CorrectionDto) {
    if (!input.reason.trim() || new Date(input.deadline) <= new Date())
      throw new UnprocessableEntityException(
        'A reason and future correction deadline are required',
      );
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
      include: {
        assignment: true,
        submittedRevision: { include: { responses: true } },
        submission: true,
      },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.policy.requireInstructor(actor, review.assignment.offeringId);
    if (
      !review.submittedRevision ||
      review.draftRevisionId ||
      review.reviewCycle !== review.submission.reviewCycle ||
      review.assignment.status !== 'SUBMITTED'
    )
      throw new ConflictException('Review is not available for correction');
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Review" WHERE id = ${reviewId}::uuid FOR UPDATE`;
        const current = await tx.review.findUniqueOrThrow({ where: { id: reviewId } });
        if (current.draftRevisionId || current.submittedRevisionId !== review.submittedRevisionId)
          throw new ConflictException('Review changed');
        const original = review.submittedRevision!;
        const next = await tx.reviewRevision.create({
          data: {
            reviewId,
            rubricRevisionId: review.rubricRevisionId,
            revisionNumber: original.revisionNumber + 1,
            strengths: original.strengths,
            weaknesses: original.weaknesses,
            overallComment: original.overallComment,
            recommendation: original.recommendation,
            correctionAuthorizedById: actor.id,
            correctionReason: input.reason,
            correctionDeadline: new Date(input.deadline),
            responses: {
              create: original.responses.map((r) => ({
                criterionId: r.criterionId,
                rubricRevisionId: r.rubricRevisionId,
                score: r.score,
                comment: r.comment,
              })),
            },
          },
        });
        await tx.review.update({ where: { id: reviewId }, data: { draftRevisionId: next.id } });
        await this.audit.record(tx, actor, 'REVIEW_CORRECTION_AUTHORIZED', 'Review', reviewId, {
          reason: input.reason,
          deadline: input.deadline,
        });
        return { id: reviewId, draftRevisionId: next.id, revision: 0 };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async history(actor: Actor, reviewId: string) {
    const review = await this.db.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });
    if (!review) throw new NotFoundException('Review not found');
    const s = await this.policy.requireSubmissionView(actor, review.submissionId);
    const staff = await this.policy.isInstructor(actor, s.offeringId);
    const owner = await this.policy.canReviewAssignment(actor, review.assignmentId);
    const author = await this.policy.isGroupMember(actor, s.project.groupId);
    if (!staff && !owner && !(author && review.releasedAt))
      throw new NotFoundException('Review not found');
    const revisions = await this.db.reviewRevision.findMany({
      where: { reviewId, ...(!staff && !owner ? { status: 'SUBMITTED' } : {}) },
      include: revisionInclude,
      orderBy: { revisionNumber: 'asc' },
    });
    return {
      items: revisions.map((r) => ({
        ...this.revisionView(r),
        ...(staff || owner
          ? {
              correctionReason: r.correctionReason,
              correctionAuthorizedById: r.correctionAuthorizedById,
              submittedById: r.submittedById,
            }
          : {}),
      })),
    };
  }

  async release(actor: Actor, submissionId: string, input: ReleaseDto) {
    const s = await this.policy.submissionContext(submissionId);
    await this.policy.requireInstructor(actor, s.offeringId);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${submissionId}::uuid FOR UPDATE`;
        const current = await tx.submission.findUniqueOrThrow({
          where: { id: submissionId },
          include: {
            assignments: { where: { reviewCycle: s.reviewCycle }, include: { review: true } },
            stage: true,
            offering: true,
          },
        });
        if (current.reviewsReleasedAt && current.reviewCycle === s.reviewCycle)
          return { id: submissionId, status: current.status, alreadyReleased: true };
        if (
          current.revision !== input.revision ||
          current.status !== 'UNDER_REVIEW' ||
          current.offering.status !== 'ACTIVE'
        )
          throw new ConflictException('Submission changed or cannot release reviews');
        const active = current.assignments.filter((a) =>
          ['ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED', 'SUBMITTED'].includes(a.status),
        );
        const submitted = active.filter(
          (a) => a.status === 'SUBMITTED' && a.review?.submittedRevisionId,
        );
        const complete =
          submitted.filter((a) => a.reviewerType === 'GROUP').length >=
            current.stage.peerReviewCount &&
          active
            .filter((a) => a.required && a.reviewerType === 'INSTRUCTOR')
            .every((a) => a.status === 'SUBMITTED');
        if (!complete && !input.reason?.trim())
          throw new ConflictException(
            'Required reviews are incomplete; an explicit close reason is required',
          );
        const deadline = input.rebuttalDeadline
          ? new Date(input.rebuttalDeadline)
          : current.stage.rebuttalDeadline;
        const rebuttalOpen = current.stage.allowRebuttal && deadline && deadline > new Date();
        if (current.stage.allowRebuttal && !rebuttalOpen && !input.reason?.trim())
          throw new ConflictException(
            'Rebuttal deadline has passed; provide a future deadline or explicit waiver reason',
          );
        if (input.rebuttalDeadline && (!deadline || deadline <= new Date()))
          throw new UnprocessableEntityException('Rebuttal deadline must be in the future');
        await tx.review.updateMany({
          where: { id: { in: submitted.map((a) => a.review!.id) } },
          data: { releasedAt: new Date() },
        });
        await tx.reviewerAssignment.updateMany({
          where: { id: { in: active.filter((a) => a.status !== 'SUBMITTED').map((a) => a.id) } },
          data: {
            status: 'CANCELLED',
            cancelledReason: input.reason ?? 'Review batch closed by instructor',
          },
        });
        if (rebuttalOpen) {
          const authors = await this.audit.groupRecipients(s.project.groupId, tx);
          if (!authors[0]) throw new ConflictException('Author group has no active members');
          await tx.rebuttal.upsert({
            where: { submissionId_reviewCycle: { submissionId, reviewCycle: current.reviewCycle } },
            create: {
              submissionId,
              reviewCycle: current.reviewCycle,
              authorId: authors[0],
              ...(input.rebuttalDeadline
                ? {
                    reopenUntil: deadline,
                    reopenReason: input.reason ?? 'Review release supplied a new rebuttal window',
                    reopenedById: actor.id,
                  }
                : {}),
            },
            update: {},
          });
        }
        const updated = await tx.submission.update({
          where: { id: submissionId },
          data: {
            reviewsReleasedAt: new Date(),
            status: rebuttalOpen ? 'REBUTTAL_OPEN' : 'REVIEW_COMPLETED',
            revision: { increment: 1 },
          },
        });
        await this.audit.record(tx, actor, 'REVIEWS_RELEASED', 'Submission', submissionId, {
          reason: input.reason ?? null,
          reviewCount: submitted.length,
          rebuttalDeadline: deadline?.toISOString() ?? null,
        });
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.groupRecipients(s.project.groupId, tx),
            type: 'REVIEWS_RELEASED',
            title: 'Reviews are available',
            body: rebuttalOpen
              ? 'Reviews are available and the rebuttal window is open.'
              : 'The review round has completed.',
            targetUrl: `/submissions/${submissionId}`,
          },
          `released:${submissionId}:${current.reviewCycle}`,
        );
        return { id: updated.id, status: updated.status, revision: updated.revision };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
