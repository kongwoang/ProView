import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../common/actor';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PolicyService } from '../policies/policy.service';
import { AuditService } from '../audit/audit.service';
import { PublishGradeDto, SaveGradeDto } from './grade.dto';
import { calculateGrade } from './scoring';
const revisionInclude = {
  scores: { include: { criterion: true } },
  rubricRevision: { include: { criteria: { orderBy: { sequence: 'asc' as const } } } },
} as const;
type GradeRevisionView = Prisma.GradeRevisionGetPayload<{ include: typeof revisionInclude }>;
export function gradeView(revision: GradeRevisionView | null) {
  if (!revision) return null;
  return {
    id: revision.id,
    status: revision.status,
    revision: revision.revision,
    revisionNumber: revision.revisionNumber,
    submissionVersionId: revision.submissionVersionId,
    rubricRevisionId: revision.rubricRevisionId,
    overall: revision.overall === null ? null : Number(revision.overall),
    calculatedOverall:
      revision.calculatedOverall === null ? null : Number(revision.calculatedOverall),
    feedback: revision.feedback,
    overrideReason: revision.overrideReason,
    correctionReason: revision.correctionReason,
    publishedAt: revision.publishedAt,
    criterionScores: revision.scores.map((s) => ({
      criterionId: s.criterionId,
      title: s.criterion.title,
      score: Number(s.score),
      comment: s.comment,
    })),
  };
}
@Injectable()
export class GradesService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}
  async get(actor: Actor, submissionId: string) {
    const submission = await this.policy.submissionContext(submissionId);
    const instructor = await this.policy.isInstructor(actor, submission.offeringId);
    if (
      !instructor &&
      !(await this.policy.isGroupMember(actor, submission.project.groupId)) &&
      !(await this.db.submissionVersionAuthor.findFirst({
        where: { userId: actor.id, version: { submissionId } },
      }))
    )
      throw new NotFoundException('Grade not found');
    const grade = await this.db.grade.findUnique({
      where: { submissionId },
      include: {
        draftRevision: { include: revisionInclude },
        publishedRevision: { include: revisionInclude },
      },
    });
    if (!grade) return { grade: null };
    if (
      !instructor &&
      !(await this.policy.isGroupMember(actor, submission.project.groupId)) &&
      grade.publishedRevision &&
      !(await this.db.submissionVersionAuthor.findUnique({
        where: {
          submissionVersionId_userId: {
            submissionVersionId: grade.publishedRevision.submissionVersionId,
            userId: actor.id,
          },
        },
      }))
    )
      return { grade: null };
    return instructor
      ? {
          id: grade.id,
          draft: gradeView(grade.draftRevision),
          published: gradeView(grade.publishedRevision),
        }
      : { grade: gradeView(grade.publishedRevision) };
  }
  async context(actor: Actor, submissionId: string) {
    const submission = await this.policy.submissionContext(submissionId);
    await this.policy.requireInstructor(actor, submission.offeringId);
    const [versions, assignments, rebuttal, discussions, grade, similarity] = await Promise.all([
      this.db.submissionVersion.findMany({
        where: { submissionId },
        orderBy: { versionNumber: 'desc' },
        include: { file: true },
      }),
      this.db.reviewerAssignment.findMany({
        where: { submissionId, reviewCycle: submission.reviewCycle },
        include: {
          reviewerGroup: {
            include: {
              members: {
                where: { leftAt: null },
                include: {
                  membership: {
                    include: { user: { select: { id: true, displayName: true, email: true } } },
                  },
                },
              },
            },
          },
          review: {
            include: {
              submittedRevision: { include: { responses: { include: { criterion: true } } } },
            },
          },
        },
        orderBy: { aliasNumber: 'asc' },
      }),
      this.db.rebuttal.findUnique({
        where: { submissionId_reviewCycle: { submissionId, reviewCycle: submission.reviewCycle } },
        include: { responses: true },
      }),
      this.db.discussionMessage.findMany({
        where: { submissionId, reviewCycle: submission.reviewCycle },
        orderBy: { createdAt: 'asc' },
      }),
      this.get(actor, submissionId),
      submission.submittedVersionId
        ? this.db.similarityCheck.findUnique({
            where: { submissionVersionId: submission.submittedVersionId },
            include: {
              resultFiles: {
                where: { state: 'READY' },
                select: { id: true, displayName: true, sizeBytes: true },
              },
            },
          })
        : null,
    ]);
    const actorIds = [
      ...new Set(
        [
          ...assignments.map((a) => a.reviewerUserId),
          ...assignments.map((a) => a.review?.submittedRevision?.submittedById),
          ...discussions.map((d) => d.authorId),
        ].filter((id): id is string => !!id),
      ),
    ];
    const users = await this.db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, displayName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      submission: {
        id: submission.id,
        status: submission.status,
        submittedVersionId: submission.submittedVersionId,
        reviewCycle: submission.reviewCycle,
        project: {
          id: submission.project.id,
          title: submission.project.title,
          description: submission.project.description,
          group: submission.project.group,
        },
        offering: {
          id: submission.offeringId,
          semester: submission.offering.semester,
          course: submission.offering.course,
        },
        stage: {
          id: submission.stage.id,
          name: submission.stage.name,
          requireSimilarityCheck: submission.stage.requireSimilarityCheck,
        },
      },
      rubric: {
        id: submission.stage.rubricRevision.id,
        criteria: submission.stage.rubricRevision.criteria.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          weight: Number(c.weight),
          scoreMin: Number(c.scoreMin),
          scoreMax: Number(c.scoreMax),
          required: c.required,
          sequence: c.sequence,
        })),
      },
      versions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        uploadedAt: v.uploadedAt,
        uploadedById: v.uploadedById,
        changeNote: v.changeNote,
        file: v.file
          ? {
              id: v.file.id,
              displayName: v.file.displayName,
              sizeBytes: v.file.sizeBytes,
              sha256: v.file.sha256,
            }
          : null,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        status: a.status,
        submissionVersionId: a.submissionVersionId,
        reviewer: a.reviewerGroup
          ? {
              kind: 'group',
              id: a.reviewerGroup.id,
              name: a.reviewerGroup.name,
              members: a.reviewerGroup.members.map((m) => m.membership.user),
            }
          : { kind: 'instructor', ...userMap.get(a.reviewerUserId ?? '') },
        review: a.review?.submittedRevision
          ? {
              id: a.review.id,
              submittedBy: userMap.get(a.review.submittedRevision.submittedById ?? ''),
              overallComment: a.review.submittedRevision.overallComment,
              strengths: a.review.submittedRevision.strengths,
              weaknesses: a.review.submittedRevision.weaknesses,
              recommendation: a.review.submittedRevision.recommendation,
              responses: a.review.submittedRevision.responses.map((r) => ({
                criterionId: r.criterionId,
                title: r.criterion.title,
                score: Number(r.score),
                comment: r.comment,
              })),
            }
          : null,
      })),
      rebuttal,
      discussions: discussions.map((d) => ({
        id: d.id,
        reviewId: d.reviewId,
        content: d.content,
        createdAt: d.createdAt,
        author: userMap.get(d.authorId),
      })),
      similarity: similarity
        ? {
            id: similarity.id,
            status: similarity.status,
            revision: similarity.revision,
            percentage: similarity.percentage === null ? null : Number(similarity.percentage),
            notes: similarity.notes,
            reason: similarity.reason,
            resultDate: similarity.resultDate,
            resultFiles: similarity.resultFiles,
          }
        : null,
      grade,
    };
  }
  async save(actor: Actor, submissionId: string, input: SaveGradeDto) {
    const submission = await this.policy.submissionContext(submissionId);
    await this.policy.requireInstructor(actor, submission.offeringId);
    if (!submission.submittedVersionId)
      throw new ConflictException('A submitted version is required');
    if (submission.offering.status !== 'ACTIVE')
      throw new ConflictException('The course offering is not editable');
    const criteria = submission.stage.rubricRevision.criteria;
    const map = new Map(input.criterionScores.map((s) => [s.criterionId, s.score]));
    if (map.size !== input.criterionScores.length)
      throw new BadRequestException('Duplicate criterion scores');
    for (const score of input.criterionScores) {
      const criterion = criteria.find((c) => c.id === score.criterionId);
      if (
        !criterion ||
        score.score < Number(criterion.scoreMin) ||
        score.score > Number(criterion.scoreMax)
      )
        throw new BadRequestException('Invalid criterion score');
    }
    if (input.overall !== undefined && !input.overrideReason?.trim())
      throw new BadRequestException('An overall score override requires a reason');
    const calculated = calculateGrade(criteria, map);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Submission" WHERE id=${submissionId}::uuid FOR UPDATE`;
      let grade = await tx.grade.findUnique({
        where: { submissionId },
        include: { draftRevision: true },
      });
      if (!grade)
        grade = await tx.grade.create({ data: { submissionId }, include: { draftRevision: true } });
      if (!grade.draftRevision && input.revision !== 0)
        throw new ConflictException('This grade has changed');
      if (grade.publishedRevisionId && !grade.draftRevision && !input.correctionReason?.trim())
        throw new BadRequestException('A grade correction requires a reason');
      const data = {
        feedback: input.feedback ?? '',
        calculatedOverall: calculated,
        overall: input.overall === undefined ? calculated : new Prisma.Decimal(input.overall),
        overrideReason: input.overall === undefined ? null : input.overrideReason?.trim(),
        graderId: actor.id,
      };
      let draft = grade.draftRevision;
      if (draft) {
        if (
          draft.submissionVersionId !== submission.submittedVersionId ||
          draft.rubricRevisionId !== submission.stage.rubricRevisionId
        )
          throw new ConflictException('Grade evidence has changed');
        const changed = await tx.gradeRevision.updateMany({
          where: { id: draft.id, revision: input.revision, status: 'DRAFT' },
          data: { ...data, revision: { increment: 1 } },
        });
        if (changed.count !== 1) throw new ConflictException('This grade has changed');
        await tx.gradeCriterionScore.deleteMany({ where: { gradeRevisionId: draft.id } });
      } else {
        const revisionNumber = (await tx.gradeRevision.count({ where: { gradeId: grade.id } })) + 1;
        draft = await tx.gradeRevision.create({
          data: {
            ...data,
            gradeId: grade.id,
            submissionId,
            submissionVersionId: submission.submittedVersionId!,
            rubricRevisionId: submission.stage.rubricRevisionId,
            revisionNumber,
            revision: 1,
            correctionReason: input.correctionReason?.trim(),
          },
        });
        await tx.grade.update({ where: { id: grade.id }, data: { draftRevisionId: draft.id } });
      }
      await tx.gradeCriterionScore.createMany({
        data: input.criterionScores.map((s) => ({
          gradeRevisionId: draft!.id,
          rubricRevisionId: submission.stage.rubricRevisionId,
          criterionId: s.criterionId,
          score: new Prisma.Decimal(s.score),
          comment: s.comment ?? '',
        })),
      });
      await this.audit.record(tx, actor, 'GRADE_DRAFT_SAVED', 'Grade', grade.id, {
        submissionVersionId: submission.submittedVersionId!,
      });
      return {
        id: grade.id,
        draft: gradeView(
          await tx.gradeRevision.findUniqueOrThrow({
            where: { id: draft.id },
            include: revisionInclude,
          }),
        ),
      };
    });
  }
  async publish(actor: Actor, gradeId: string, input: PublishGradeDto) {
    const grade = await this.db.grade.findUnique({
      where: { id: gradeId },
      include: {
        submission: { include: { stage: true, project: true } },
        draftRevision: { include: revisionInclude },
        publishedRevision: { include: revisionInclude },
      },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    await this.policy.requireInstructor(actor, grade.submission.offeringId);
    if (!grade.draftRevision) throw new ConflictException('No grade draft is ready to publish');
    const draft = grade.draftRevision;
    if (
      !['REVIEW_COMPLETED', 'FINALIZED'].includes(grade.submission.status) ||
      !grade.submission.inputLockedAt
    )
      throw new ConflictException('The submission workflow must be completed before publishing');
    if (
      draft.submissionVersionId !== grade.submission.submittedVersionId ||
      draft.revision !== input.revision
    )
      throw new ConflictException('Grade evidence has changed');
    const calculated = calculateGrade(
      draft.rubricRevision.criteria,
      new Map(draft.scores.map((s) => [s.criterionId, Number(s.score)])),
    );
    if (calculated === null || draft.overall === null)
      throw new BadRequestException('Complete all required grading criteria');
    if (grade.submission.stage.requireSimilarityCheck) {
      const check = await this.db.similarityCheck.findUnique({
        where: { submissionVersionId: draft.submissionVersionId },
      });
      if (!check || !['COMPLETED', 'WAIVED'].includes(check.status))
        throw new ConflictException(
          'Complete or waive the textual similarity check for this version before publishing',
        );
    }
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Submission" WHERE id=${grade.submissionId}::uuid FOR UPDATE`;
      const current = await tx.submission.findUniqueOrThrow({ where: { id: grade.submissionId } });
      if (
        current.submittedVersionId !== draft.submissionVersionId ||
        !['REVIEW_COMPLETED', 'FINALIZED'].includes(current.status)
      )
        throw new ConflictException('Grade evidence has changed');
      if (!current.inputLockedAt)
        throw new ConflictException('Submission input must be locked before publishing');
      const offering = await tx.courseOffering.findUniqueOrThrow({
        where: { id: current.offeringId },
      });
      if (offering.status !== 'ACTIVE')
        throw new ConflictException('The course offering is not editable');
      if (grade.submission.stage.requireSimilarityCheck) {
        const check = await tx.similarityCheck.findUnique({
          where: { submissionVersionId: draft.submissionVersionId },
        });
        if (!check || !['COMPLETED', 'WAIVED'].includes(check.status))
          throw new ConflictException(
            'Complete or waive the textual similarity check for this version before publishing',
          );
      }
      const changed = await tx.gradeRevision.updateMany({
        where: { id: draft.id, status: 'DRAFT', revision: input.revision },
        data: {
          status: 'PUBLISHED',
          publishedById: actor.id,
          publishedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException('This grade has changed');
      await tx.grade.update({
        where: { id: gradeId },
        data: { publishedRevisionId: draft.id, draftRevisionId: null },
      });
      await tx.submission.update({
        where: { id: grade.submissionId },
        data: { status: 'FINALIZED', finalizedAt: new Date(), revision: { increment: 1 } },
      });
      await this.audit.record(tx, actor, 'GRADE_PUBLISHED', 'Grade', gradeId, {
        submissionVersionId: draft.submissionVersionId,
      });
      await this.audit.notify(
        tx,
        {
          recipients: await this.audit.groupRecipients(grade.submission.project.groupId, tx),
          type: 'GRADE_PUBLISHED',
          title: 'Grade published',
          body: 'Your instructor has published your project grade.',
          targetUrl: `/submissions/${grade.submissionId}`,
        },
        `grade:${draft.id}:published`,
      );
      return {
        id: gradeId,
        published: gradeView(
          await tx.gradeRevision.findUniqueOrThrow({
            where: { id: draft.id },
            include: revisionInclude,
          }),
        ),
      };
    });
  }
}
