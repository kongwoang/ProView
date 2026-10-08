import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../common/actor';
import { PageDto, pageResult, paging } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policies/policy.service';
import { StorageService } from '../storage/storage.service';
import { ReopenSubmissionDto, SubmitDto } from './submissions.dto';

const contextInclude = {
  stage: {
    include: {
      rubricRevision: { include: { criteria: { orderBy: { sequence: 'asc' as const } } } },
    },
  },
  offering: { include: { course: true } },
  project: {
    include: {
      group: {
        include: {
          members: {
            where: { leftAt: null },
            include: {
              membership: {
                include: { user: { select: { id: true, displayName: true, username: true } } },
              },
            },
          },
        },
      },
    },
  },
} as const;
type SubmissionContext = Prisma.SubmissionGetPayload<{ include: typeof contextInclude }>;

export function inputWindow(
  submission: Pick<
    SubmissionContext,
    'inputLockedAt' | 'status' | 'reopenUntil' | 'stage' | 'offering'
  >,
  now: Date,
): boolean {
  if (
    submission.offering.status !== 'ACTIVE' ||
    submission.inputLockedAt ||
    !['DRAFT', 'SUBMITTED'].includes(submission.status)
  )
    return false;
  if (submission.reopenUntil) return now < submission.reopenUntil;
  return submission.stage.openAt <= now && now < submission.stage.submissionDeadline;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private async lock(tx: Prisma.TransactionClient, id: string): Promise<SubmissionContext> {
    await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${id}::uuid FOR UPDATE`;
    const submission = await tx.submission.findUnique({ where: { id }, include: contextInclude });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
  private assertWindow(
    submission: Pick<
      SubmissionContext,
      'inputLockedAt' | 'status' | 'reopenUntil' | 'stage' | 'offering'
    >,
  ): void {
    if (!inputWindow(submission, new Date()))
      throw new ConflictException('Submission input is closed or locked');
  }
  private async assertAuthorTx(
    tx: Prisma.TransactionClient,
    actor: Actor,
    groupId: string,
  ): Promise<void> {
    if (
      !(await tx.groupMember.findFirst({
        where: {
          groupId,
          userId: actor.id,
          leftAt: null,
          membership: { endedAt: null, role: 'STUDENT', user: { isActive: true } },
        },
      }))
    )
      throw new NotFoundException('Submission not found');
  }
  async myProjects(actor: Actor) {
    return this.db.project.findMany({
      where: {
        group: {
          members: { some: { userId: actor.id, leftAt: null, membership: { endedAt: null } } },
        },
      },
      include: {
        group: { select: { id: true, name: true } },
        offering: { include: { course: true } },
        submissions: {
          select: { id: true, stageId: true, status: true, submittedVersionId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async listOffering(actor: Actor, offeringId: string, query: PageDto) {
    await this.policy.requireStaff(actor, offeringId);
    const where: Prisma.SubmissionWhereInput = {
      offeringId,
      ...(query.search
        ? { project: { title: { contains: query.search, mode: 'insensitive' } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.submission.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          revision: true,
          submittedAt: true,
          submittedVersionId: true,
          reviewCycle: true,
          project: {
            select: { id: true, title: true, group: { select: { id: true, name: true } } },
          },
          stage: {
            select: { id: true, name: true, allowReviews: true, requireSimilarityCheck: true },
          },
        },
      }),
      this.db.submission.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async project(actor: Actor, id: string) {
    const project = await this.db.project.findUnique({
      where: { id },
      include: {
        offering: { include: { course: true, stages: { orderBy: { sequence: 'asc' } } } },
        group: contextInclude.project.include.group,
        submissions: {
          select: {
            id: true,
            stageId: true,
            status: true,
            revision: true,
            submittedVersionId: true,
            latestDraftVersionId: true,
          },
        },
      },
    });
    if (
      !project ||
      (!(await this.policy.isGroupMember(actor, project.groupId)) &&
        !(await this.policy.isInstructor(actor, project.offeringId)))
    )
      throw new NotFoundException('Project not found');
    return { ...project, stages: project.offering.stages };
  }
  async create(actor: Actor, projectId: string, stageId: string) {
    const project = await this.db.project.findUnique({ where: { id: projectId } });
    if (!project || !(await this.policy.isGroupMember(actor, project.groupId)))
      throw new NotFoundException('Project not found');
    return this.db.$transaction(
      async (tx) => {
        await this.assertAuthorTx(tx, actor, project.groupId);
        const stage = await tx.submissionStage.findFirst({
          where: { id: stageId, offeringId: project.offeringId },
          include: { offering: true },
        });
        if (!stage) throw new BadRequestException('Stage must belong to the project offering');
        const existing = await tx.submission.findUnique({
          where: { projectId_stageId: { projectId, stageId } },
        });
        if (existing) return { id: existing.id, revision: existing.revision };
        if (
          stage.offering.status !== 'ACTIVE' ||
          stage.openAt > new Date() ||
          stage.submissionDeadline <= new Date()
        )
          throw new ConflictException('Submission window is closed');
        const submission = await tx.submission.create({
          data: { projectId, stageId, offeringId: project.offeringId },
        });
        await this.audit.record(tx, actor, 'SUBMISSION_CREATED', 'Submission', submission.id);
        return { id: submission.id, revision: submission.revision };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async detail(actor: Actor, id: string) {
    await this.policy.requireSubmissionView(actor, id);
    const submission = await this.db.submission.findUniqueOrThrow({
      where: { id },
      include: contextInclude,
    });
    const author = await this.policy.isGroupMember(actor, submission.project.groupId);
    const instructor = await this.policy.isInstructor(actor, submission.offeringId);
    const allowedVersionIds: string[] = [];
    if (!author && !instructor) {
      const assignments = await this.db.reviewerAssignment.findMany({
        where: {
          submissionId: id,
          reviewCycle: submission.reviewCycle,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] },
        },
      });
      for (const assignment of assignments)
        if (await this.policy.canReviewAssignment(actor, assignment.id))
          allowedVersionIds.push(assignment.submissionVersionId);
    }
    const versions = await this.db.submissionVersion.findMany({
      where: {
        submissionId: id,
        ...(author || instructor ? {} : { id: { in: allowedVersionIds } }),
      },
      include: { file: true },
      orderBy: { versionNumber: 'desc' },
    });
    const users = await this.db.user.findMany({
      where: { id: { in: versions.map((version) => version.uploadedById) } },
      select: { id: true, displayName: true, username: true },
    });
    return {
      id,
      projectId: submission.projectId,
      stageId: submission.stageId,
      offeringId: submission.offeringId,
      status: submission.status,
      revision: submission.revision,
      reviewCycle: submission.reviewCycle,
      latestDraftVersionId: author || instructor ? submission.latestDraftVersionId : null,
      submittedVersionId: submission.submittedVersionId,
      inputLockedAt: submission.inputLockedAt,
      reviewsReleasedAt: submission.reviewsReleasedAt,
      submittedAt: submission.submittedAt,
      reopenUntil: submission.reopenUntil,
      project: {
        id: submission.project.id,
        title: submission.project.title,
        description: submission.project.description,
        group: {
          id: submission.project.group.id,
          name: submission.project.group.name,
          members: submission.project.group.members.map((member) => ({
            user: member.membership.user,
          })),
        },
      },
      stage: submission.stage,
      offering: {
        id: submission.offering.id,
        semester: submission.offering.semester,
        academicYear: submission.offering.academicYear,
        status: submission.offering.status,
        timezone: submission.offering.timezone,
        anonymityMode: submission.offering.anonymityMode,
        course: submission.offering.course,
      },
      versions: versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        uploadedAt: version.uploadedAt,
        uploadedBy: users.find((user) => user.id === version.uploadedById),
        changeNote: version.changeNote,
        file: version.file
          ? {
              displayName: version.file.displayName,
              sizeBytes: version.file.sizeBytes,
              sha256: version.file.sha256,
              mimeType: version.file.mimeType,
            }
          : null,
        fileUrl: `/api/v1/versions/${version.id}/file`,
      })),
      allowedActions: [
        ...(author && inputWindow(submission, new Date()) ? ['UPLOAD_VERSION', 'SUBMIT'] : []),
        ...(instructor && submission.offering.status === 'ACTIVE'
          ? [
              'REOPEN',
              ...(!submission.stage.allowReviews && submission.status === 'SUBMITTED'
                ? ['FINALIZE_INPUT']
                : []),
            ]
          : []),
      ],
    };
  }
  async upload(actor: Actor, id: string, file: Express.Multer.File, changeNote = '') {
    const initial = await this.policy.requireAuthor(actor, id);
    this.assertWindow(initial);
    const stored = await this.storage.put(file);
    try {
      return await this.db.$transaction(async (tx) => {
        const submission = await this.lock(tx, id);
        await this.assertAuthorTx(tx, actor, submission.project.groupId);
        this.assertWindow(submission);
        const latest = await tx.submissionVersion.findFirst({
          where: { submissionId: id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        const version = await tx.submissionVersion.create({
          data: {
            submissionId: id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            uploadedById: actor.id,
            changeNote,
            file: { create: { ...stored, state: 'READY' } },
          },
        });
        const updated = await tx.submission.update({
          where: { id },
          data: { latestDraftVersionId: version.id, revision: { increment: 1 } },
        });
        await this.audit.record(
          tx,
          actor,
          'SUBMISSION_VERSION_UPLOADED',
          'SubmissionVersion',
          version.id,
          { submissionId: id, versionNumber: version.versionNumber, sha256: stored.sha256 },
        );
        return {
          id: version.id,
          versionNumber: version.versionNumber,
          uploadedAt: version.uploadedAt,
          revision: updated.revision,
          sha256: stored.sha256,
        };
      });
    } catch (error) {
      await this.storage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }
  async submit(actor: Actor, id: string, dto: SubmitDto) {
    await this.policy.requireAuthor(actor, id);
    return this.db.$transaction(async (tx) => {
      const submission = await this.lock(tx, id);
      await this.assertAuthorTx(tx, actor, submission.project.groupId);
      if (submission.status === 'SUBMITTED' && submission.submittedVersionId === dto.versionId)
        return {
          id,
          status: submission.status,
          revision: submission.revision,
          submittedVersionId: dto.versionId,
        };
      this.assertWindow(submission);
      if (submission.revision !== dto.revision)
        throw new ConflictException('Submission changed; reload before submitting');
      const version = await tx.submissionVersion.findFirst({
        where: { id: dto.versionId, submissionId: id, file: { state: 'READY' } },
      });
      if (!version)
        throw new BadRequestException('Ready PDF version belonging to this submission required');
      await tx.projectGroup.update({
        where: { id: submission.project.groupId },
        data: { membershipLockedAt: submission.project.group.membershipLockedAt ?? new Date() },
      });
      const authors = await tx.groupMember.findMany({
        where: { groupId: submission.project.groupId, leftAt: null, membership: { endedAt: null } },
      });
      await tx.submissionVersionAuthor.createMany({
        data: authors.map((member) => ({
          submissionVersionId: version.id,
          userId: member.userId,
          groupMemberId: member.id,
        })),
        skipDuplicates: true,
      });
      const updated = await tx.submission.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedVersionId: version.id,
          submittedById: actor.id,
          submittedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (submission.stage.requireSimilarityCheck)
        await tx.similarityCheck.upsert({
          where: { submissionVersionId: version.id },
          create: { submissionVersionId: version.id },
          update: {},
        });
      await this.audit.record(tx, actor, 'SUBMISSION_SUBMITTED', 'Submission', id, {
        versionId: version.id,
        reviewCycle: submission.reviewCycle,
      });
      await this.audit.notify(
        tx,
        {
          recipients: [
            ...authors.map((a) => a.userId),
            ...(await this.audit.instructorRecipients(submission.offeringId, tx)),
          ],
          type: 'SUBMISSION_RECEIVED',
          title: 'Project submission received',
          body: `${submission.stage.name} version ${version.versionNumber} was submitted.`,
          targetUrl: `/submissions/${id}`,
        },
        `submission:${id}:${submission.reviewCycle}:${version.id}`,
      );
      return {
        id,
        status: updated.status,
        revision: updated.revision,
        submittedVersionId: version.id,
      };
    });
  }
  async finalizeInput(actor: Actor, id: string, revision: number) {
    const initial = await this.policy.submissionContext(id);
    await this.policy.requireInstructor(actor, initial.offeringId);
    return this.db.$transaction(async (tx) => {
      const submission = await this.lock(tx, id);
      if (
        submission.revision !== revision ||
        submission.status !== 'SUBMITTED' ||
        submission.stage.allowReviews ||
        !submission.submittedVersionId
      )
        throw new ConflictException(
          'Only submitted stages without reviews may finalize input here',
        );
      const result = await tx.submission.update({
        where: { id },
        data: { inputLockedAt: new Date(), status: 'REVIEW_COMPLETED', revision: { increment: 1 } },
      });
      await this.audit.record(tx, actor, 'SUBMISSION_INPUT_FINALIZED', 'Submission', id, {
        versionId: submission.submittedVersionId,
      });
      return { id, status: result.status, revision: result.revision };
    });
  }
  async reopen(actor: Actor, id: string, dto: ReopenSubmissionDto) {
    const initial = await this.policy.submissionContext(id);
    await this.policy.requireInstructor(actor, initial.offeringId);
    const until = new Date(dto.until);
    if (until <= new Date() || +until > Date.now() + 30 * 86400_000)
      throw new BadRequestException('Reopen deadline must be within the next 30 days');
    return this.db.$transaction(async (tx) => {
      const submission = await this.lock(tx, id);
      if (submission.offering.status !== 'ACTIVE' || submission.revision !== dto.revision)
        throw new ConflictException('Offering closed or submission changed');
      await tx.reviewerAssignment.updateMany({
        where: {
          submissionId: id,
          reviewCycle: submission.reviewCycle,
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED', 'SUBMITTED'] },
        },
        data: { status: 'CANCELLED' },
      });
      await tx.archivePublication.updateMany({
        where: { submissionId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: dto.reason },
      });
      await tx.grade.updateMany({
        where: { submissionId: id },
        data: { publishedRevisionId: null, draftRevisionId: null },
      });
      const updated = await tx.submission.update({
        where: { id },
        data: {
          status: 'DRAFT',
          inputLockedAt: null,
          submittedVersionId: null,
          submittedAt: null,
          submittedById: null,
          reviewsReleasedAt: null,
          finalizedAt: null,
          reopenUntil: until,
          reviewCycle: { increment: 1 },
          revision: { increment: 1 },
        },
      });
      await this.audit.record(tx, actor, 'SUBMISSION_REOPENED', 'Submission', id, {
        reason: dto.reason,
        until: until.toISOString(),
        previousCycle: submission.reviewCycle,
        previousVersionId: submission.submittedVersionId,
      });
      await this.audit.notify(
        tx,
        {
          recipients: await this.audit.groupRecipients(submission.project.groupId, tx),
          type: 'SUBMISSION_REOPENED',
          title: 'Submission reopened',
          body: `Your submission may be revised until ${until.toISOString()}. Previous evidence is preserved.`,
          targetUrl: `/submissions/${id}`,
        },
        `submission-reopen:${id}:${updated.reviewCycle}`,
      );
      return {
        id,
        status: updated.status,
        revision: updated.revision,
        reviewCycle: updated.reviewCycle,
      };
    });
  }
  async file(actor: Actor, versionId: string) {
    const version = await this.policy.requireVersionView(actor, versionId);
    if (!version.file || version.file.state !== 'READY')
      throw new NotFoundException('File not found');
    if (actor.role === 'ADMIN')
      await this.db.$transaction((tx) =>
        this.audit.record(tx, actor, 'ADMIN_FILE_ACCESSED', 'SubmissionVersion', versionId),
      );
    return { file: version.file, data: await this.storage.read(version.file.storageKey) };
  }
}
