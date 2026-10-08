import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CourseOffering } from '@prisma/client';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { Actor } from '../../common/actor';
import { PageDto, pageResult, paging } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../policies/policy.service';
import {
  CourseDto,
  CoursePatchDto,
  CsvDto,
  GroupDto,
  GroupPatchDto,
  MembershipDto,
  OfferingDto,
  OfferingPatchDto,
  RubricDto,
  StageDto,
  StagePatchDto,
} from './courses.dto';

const safeUser = { id: true, username: true, displayName: true, role: true } as const;
const groupInclude = {
  members: {
    where: { leftAt: null },
    include: { membership: { include: { user: { select: safeUser } } } },
  },
  project: true,
} as const;
type ImportRow = {
  row: number;
  email: string;
  userId?: string;
  action: 'ADD' | 'EXISTS' | 'ERROR';
  error?: string;
};

export function assertStage(input: StageDto): void {
  const open = new Date(input.openAt).getTime();
  const submit = new Date(input.submissionDeadline).getTime();
  if (!(open < submit))
    throw new BadRequestException('Stage must open before its submission deadline');
  if (input.allowRebuttal && !input.allowReviews)
    throw new BadRequestException('Rebuttal requires reviews');
  if (
    input.allowReviews &&
    (!input.reviewDeadline || !(submit < new Date(input.reviewDeadline).getTime()))
  )
    throw new BadRequestException('Review deadline must follow submission deadline');
  if (
    input.allowRebuttal &&
    (!input.rebuttalDeadline ||
      !(new Date(input.reviewDeadline!).getTime() < new Date(input.rebuttalDeadline).getTime()))
  )
    throw new BadRequestException('Rebuttal deadline must follow review deadline');
  if (!input.allowReviews && input.peerReviewCount !== 0)
    throw new BadRequestException('Peer count must be zero when review is disabled');
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}
  private editable(offering: CourseOffering): void {
    if (!['DRAFT', 'ACTIVE'].includes(offering.status))
      throw new ConflictException('Course offering is closed');
  }
  private timezone(value: string): void {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
    } catch {
      throw new BadRequestException('Invalid IANA timezone');
    }
  }

  async courses(actor: Actor, query: PageDto) {
    const where: Prisma.CourseWhereInput = {
      ...(actor.role === 'STUDENT'
        ? { offerings: { some: { memberships: { some: { userId: actor.id, endedAt: null } } } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { title: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.course.findMany({ where, ...paging(query), orderBy: { code: 'asc' } }),
      this.db.course.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async createCourse(actor: Actor, dto: CourseDto) {
    this.policy.requireAdmin(actor);
    return this.db.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          title: dto.title.trim(),
          description: dto.description,
        },
      });
      await this.audit.record(tx, actor, 'COURSE_CREATED', 'Course', course.id);
      return course;
    });
  }
  async patchCourse(actor: Actor, id: string, dto: CoursePatchDto) {
    this.policy.requireAdmin(actor);
    return this.db.$transaction(async (tx) => {
      if (!(await tx.course.findUnique({ where: { id } })))
        throw new NotFoundException('Course not found');
      const course = await tx.course.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          title: dto.title?.trim(),
          description: dto.description,
          isActive: dto.isActive,
        },
      });
      await this.audit.record(tx, actor, 'COURSE_UPDATED', 'Course', id);
      return course;
    });
  }
  async offerings(actor: Actor, query: PageDto) {
    const where: Prisma.CourseOfferingWhereInput = {
      ...(actor.role === 'ADMIN'
        ? {}
        : { memberships: { some: { userId: actor.id, endedAt: null } } }),
      ...(query.search
        ? {
            OR: [
              { semester: { contains: query.search, mode: 'insensitive' } },
              { course: { title: { contains: query.search, mode: 'insensitive' } } },
              { course: { code: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.courseOffering.findMany({
        where,
        ...paging(query),
        include: { course: true, _count: { select: { groups: true, stages: true } } },
        orderBy: { termStartAt: 'desc' },
      }),
      this.db.courseOffering.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  async offering(actor: Actor, id: string) {
    await this.policy.requireOffering(actor, id);
    return this.db.courseOffering.findUniqueOrThrow({
      where: { id },
      include: {
        course: true,
        stages: {
          orderBy: { sequence: 'asc' },
          include: { rubricRevision: { include: { criteria: { orderBy: { sequence: 'asc' } } } } },
        },
        groups: { include: groupInclude },
      },
    });
  }
  private async createRubricTx(tx: Prisma.TransactionClient, offeringId: string, dto: RubricDto) {
    this.checkRubric(dto);
    const rubric = await tx.rubric.create({
      data: {
        offeringId,
        name: dto.name.trim(),
        description: dto.description,
        revisions: {
          create: {
            offeringId,
            revisionNumber: 1,
            requireRecommendation: dto.requireRecommendation ?? false,
            recommendationOptions: dto.recommendationOptions ?? [],
            requireOverallComment: dto.requireOverallComment ?? true,
            criteria: {
              create: dto.criteria.map((criterion, index) => ({
                ...criterion,
                sequence: index + 1,
              })),
            },
          },
        },
      },
      include: { revisions: { include: { criteria: true } } },
    });
    const publishedAt = new Date();
    await tx.rubricRevision.update({
      where: { id: rubric.revisions[0].id },
      data: { publishedAt },
    });
    rubric.revisions[0].publishedAt = publishedAt;
    return rubric;
  }
  private checkRubric(dto: RubricDto): void {
    if (
      !dto.criteria.length ||
      dto.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) <= 0 ||
      dto.criteria.some((criterion) => criterion.scoreMax <= criterion.scoreMin)
    )
      throw new BadRequestException('Rubric requires positive total weight and valid score bounds');
    if (dto.requireRecommendation && !dto.recommendationOptions?.length)
      throw new BadRequestException('Recommendation options are required');
    if (
      new Set(dto.recommendationOptions).size !== dto.recommendationOptions?.length &&
      dto.recommendationOptions
    )
      throw new BadRequestException('Recommendation options must be unique');
  }
  async createOffering(actor: Actor, dto: OfferingDto) {
    if (actor.role === 'STUDENT')
      throw new ForbiddenException('Instructor or administrator required');
    const start = new Date(dto.termStartAt);
    const end = new Date(dto.termEndAt);
    if (start >= end) throw new BadRequestException('Term must end after its start');
    this.timezone(dto.timezone ?? 'Asia/Ho_Chi_Minh');
    const course = await this.db.course.findUnique({ where: { id: dto.courseId } });
    if (!course?.isActive) throw new BadRequestException('Active course required');
    if (dto.copyFromOfferingId) await this.policy.requireStaff(actor, dto.copyFromOfferingId);
    const instructors = [
      ...new Set([
        ...(actor.role === 'INSTRUCTOR' ? [actor.id] : []),
        ...(dto.instructorIds ?? []),
      ]),
    ];
    if (!instructors.length) throw new BadRequestException('At least one instructor is required');
    if (actor.role !== 'ADMIN' && instructors.some((id) => id !== actor.id))
      throw new ForbiddenException('Only administrators assign additional instructors');
    if (
      (await this.db.user.count({
        where: { id: { in: instructors }, role: 'INSTRUCTOR', isActive: true },
      })) !== instructors.length
    )
      throw new BadRequestException('All instructor accounts must be active instructors');
    return this.db.$transaction(
      async (tx) => {
        const offering = await tx.courseOffering.create({
          data: {
            courseId: dto.courseId,
            semester: dto.semester.trim(),
            academicYear: dto.academicYear.trim(),
            termStartAt: start,
            termEndAt: end,
            timezone: dto.timezone,
            anonymityMode: dto.anonymityMode,
            memberships: { create: instructors.map((userId) => ({ userId, role: 'INSTRUCTOR' })) },
          },
        });
        if (dto.copyFromOfferingId) {
          const source = await tx.courseOffering.findUniqueOrThrow({
            where: { id: dto.copyFromOfferingId },
            include: {
              stages: {
                orderBy: { sequence: 'asc' },
                include: { rubricRevision: { include: { rubric: true, criteria: true } } },
              },
            },
          });
          if (source.courseId !== dto.courseId)
            throw new BadRequestException('Copy source must belong to the same course');
          const revisions = new Map<string, string>();
          const offset = +start - +source.termStartAt;
          for (const stage of source.stages) {
            const sourceRubric = stage.rubricRevision;
            let revisionId = revisions.get(sourceRubric.id);
            if (!revisionId) {
              const copied = await this.createRubricTx(tx, offering.id, {
                name: sourceRubric.rubric.name,
                description: sourceRubric.rubric.description,
                requireRecommendation: sourceRubric.requireRecommendation,
                recommendationOptions: sourceRubric.recommendationOptions as string[],
                requireOverallComment: sourceRubric.requireOverallComment,
                criteria: sourceRubric.criteria.map((c) => ({
                  title: c.title,
                  description: c.description,
                  weight: Number(c.weight),
                  scoreMin: Number(c.scoreMin),
                  scoreMax: Number(c.scoreMax),
                  required: c.required,
                  requireComment: c.requireComment,
                })),
              });
              revisionId = copied.revisions[0].id;
              revisions.set(sourceRubric.id, revisionId);
            }
            await tx.submissionStage.create({
              data: {
                offeringId: offering.id,
                rubricRevisionId: revisionId,
                name: stage.name,
                sequence: stage.sequence,
                openAt: new Date(+stage.openAt + offset),
                submissionDeadline: new Date(+stage.submissionDeadline + offset),
                reviewDeadline: stage.reviewDeadline
                  ? new Date(+stage.reviewDeadline + offset)
                  : null,
                rebuttalDeadline: stage.rebuttalDeadline
                  ? new Date(+stage.rebuttalDeadline + offset)
                  : null,
                allowReviews: stage.allowReviews,
                allowRebuttal: stage.allowRebuttal,
                requireSimilarityCheck: stage.requireSimilarityCheck,
                peerReviewCount: stage.peerReviewCount,
              },
            });
          }
        } else {
          const duration = +end - +start;
          const at = (part: number) => new Date(+start + duration * part);
          for (const [index, name] of ['Proposal', 'Final Report'].entries()) {
            const rubric = await this.createRubricTx(tx, offering.id, {
              name: `${name} rubric`,
              criteria: [
                { title: 'Clarity and scope', weight: 30, scoreMin: 0, scoreMax: 10 },
                { title: 'Technical quality', weight: 40, scoreMin: 0, scoreMax: 10 },
                { title: 'Evidence and presentation', weight: 30, scoreMin: 0, scoreMax: 10 },
              ],
            });
            await tx.submissionStage.create({
              data: {
                offeringId: offering.id,
                rubricRevisionId: rubric.revisions[0].id,
                name,
                sequence: index + 1,
                openAt: at(index ? 0.4 : 0),
                submissionDeadline: at(index ? 0.8 : 0.2),
                reviewDeadline: at(index ? 0.9 : 0.3),
                rebuttalDeadline: at(index ? 1 : 0.4),
                allowReviews: true,
                allowRebuttal: true,
                requireSimilarityCheck: index === 1,
                peerReviewCount: 2,
              },
            });
          }
        }
        await this.audit.record(tx, actor, 'OFFERING_CREATED', 'CourseOffering', offering.id, {
          copiedFrom: dto.copyFromOfferingId ?? null,
        });
        return offering;
      },
      { isolationLevel: 'Serializable', timeout: 15000 },
    );
  }
  async patchOffering(actor: Actor, id: string, dto: OfferingPatchDto) {
    await this.policy.requireStaff(actor, id);
    if (dto.timezone) this.timezone(dto.timezone);
    return this.db.$transaction(async (tx) => {
      const current = await tx.courseOffering.findUniqueOrThrow({ where: { id } });
      if (dto.status && dto.status !== current.status) {
        const allowed: Record<string, string[]> = {
          DRAFT: ['ACTIVE'],
          ACTIVE: ['CLOSED'],
          CLOSED: ['ARCHIVED'],
          ARCHIVED: [],
        };
        if (!allowed[current.status].includes(dto.status))
          throw new ConflictException('Invalid offering state transition');
      }
      if (
        dto.anonymityMode &&
        dto.anonymityMode !== current.anonymityMode &&
        (await tx.reviewerAssignment.count({ where: { submission: { offeringId: id } } }))
      )
        throw new ConflictException('Anonymity mode is locked after reviewer assignment');
      const { revision, ...data } = dto;
      const update = await tx.courseOffering.updateMany({
        where: { id, revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (!update.count) throw new ConflictException('Offering changed; reload before saving');
      await this.audit.record(tx, actor, 'OFFERING_UPDATED', 'CourseOffering', id, {
        status: dto.status ?? current.status,
      });
      return tx.courseOffering.findUniqueOrThrow({ where: { id } });
    });
  }
  async roster(actor: Actor, offeringId: string) {
    await this.policy.requireStaff(actor, offeringId);
    return this.db.courseMembership.findMany({
      where: { offeringId, endedAt: null },
      include: { user: { select: { ...safeUser, email: true, isActive: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  }
  async addMember(actor: Actor, offeringId: string, dto: MembershipDto) {
    await this.policy.requireStaff(actor, offeringId);
    const role = dto.role ?? 'STUDENT';
    if (role === 'INSTRUCTOR') this.policy.requireAdmin(actor);
    const user = await this.db.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user?.isActive || user.role !== role)
      throw new BadRequestException(
        `An active ${role.toLowerCase()} account with this email is required`,
      );
    return this.db.$transaction(
      async (tx) => {
        this.editable(await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } }));
        if (
          await tx.courseMembership.findFirst({
            where: { offeringId, userId: user.id, endedAt: null },
          })
        )
          throw new ConflictException('Account is already enrolled');
        const member = await tx.courseMembership.create({
          data: { offeringId, userId: user.id, role },
        });
        await this.audit.record(tx, actor, 'MEMBER_ADDED', 'CourseMembership', member.id, {
          offeringId,
          userId: user.id,
        });
        return member;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async removeMember(actor: Actor, offeringId: string, id: string) {
    await this.policy.requireStaff(actor, offeringId);
    return this.db.$transaction(
      async (tx) => {
        this.editable(await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } }));
        const membership = await tx.courseMembership.findFirst({
          where: { id, offeringId, endedAt: null },
          include: { groupMemberships: { where: { leftAt: null }, include: { group: true } } },
        });
        if (!membership) throw new NotFoundException('Membership not found');
        if (membership.role === 'INSTRUCTOR') this.policy.requireAdmin(actor);
        if (
          membership.role === 'INSTRUCTOR' &&
          (await tx.courseMembership.count({
            where: { offeringId, role: 'INSTRUCTOR', endedAt: null },
          })) <= 1
        )
          throw new ConflictException('Cannot remove the last instructor');
        if (membership.groupMemberships.some((m) => m.group.membershipLockedAt))
          throw new ConflictException('Membership is preserved after first submission');
        await tx.groupMember.updateMany({
          where: { membershipId: id, leftAt: null },
          data: {
            leftAt: new Date(),
            changedById: actor.id,
            changeReason: 'Removed from offering roster',
          },
        });
        await tx.courseMembership.update({ where: { id }, data: { endedAt: new Date() } });
        await this.audit.record(tx, actor, 'MEMBER_REMOVED', 'CourseMembership', id, {
          offeringId,
        });
        return { success: true };
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async previewRoster(actor: Actor, offeringId: string, dto: CsvDto) {
    await this.policy.requireStaff(actor, offeringId);
    const offering = await this.db.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
    this.editable(offering);
    let input: Record<string, string>[];
    try {
      input = parse(dto.csv, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        max_record_size: 2000,
      }) as Record<string, string>[];
    } catch {
      throw new BadRequestException('Malformed CSV; expected email header and consistent rows');
    }
    if (!input.length || input.length > 1000 || input.some((row) => !Object.hasOwn(row, 'email')))
      throw new BadRequestException('CSV needs an email column and 1–1000 rows');
    const seen = new Set<string>();
    const rows: ImportRow[] = [];
    for (const [index, row] of input.entries()) {
      const email = row.email.trim().toLowerCase();
      let error: string | undefined;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email';
      else if (seen.has(email)) error = 'Duplicate email in CSV';
      seen.add(email);
      const user = error ? null : await this.db.user.findUnique({ where: { email } });
      if (!error && (!user || user.role !== 'STUDENT' || !user.isActive))
        error = 'Active student account not found; administrator must create it first';
      const exists =
        user &&
        (await this.db.courseMembership.findFirst({
          where: { offeringId, userId: user.id, endedAt: null },
        }));
      rows.push({
        row: index + 2,
        email,
        ...(user ? { userId: user.id } : {}),
        action: error ? 'ERROR' : exists ? 'EXISTS' : 'ADD',
        ...(error ? { error } : {}),
      });
    }
    const summary = {
      total: rows.length,
      add: rows.filter((r) => r.action === 'ADD').length,
      existing: rows.filter((r) => r.action === 'EXISTS').length,
      errors: rows.filter((r) => r.action === 'ERROR').length,
    };
    const preview = await this.db.rosterImportPreview.create({
      data: {
        offeringId,
        createdById: actor.id,
        offeringRevision: offering.revision,
        inputHash: createHash('sha256').update(dto.csv).digest('hex'),
        rows,
        summary,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    return { previewId: preview.id, rows, summary, expiresAt: preview.expiresAt };
  }
  async importRoster(actor: Actor, offeringId: string, previewId: string) {
    await this.policy.requireStaff(actor, offeringId);
    return this.db.$transaction(
      async (tx) => {
        const preview = await tx.rosterImportPreview.findFirst({
          where: { id: previewId, offeringId, createdById: actor.id },
        });
        if (!preview) throw new NotFoundException('Import preview not found');
        if (preview.committedAt)
          return { summary: preview.summary, committedAt: preview.committedAt };
        const offering = await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } });
        this.editable(offering);
        if (preview.expiresAt <= new Date() || preview.offeringRevision !== offering.revision)
          throw new ConflictException('Preview expired or offering changed; preview again');
        const rows = preview.rows as unknown as ImportRow[];
        if (rows.some((r) => r.action === 'ERROR'))
          throw new BadRequestException('Resolve all CSV errors before import');
        for (const row of rows) {
          const user = await tx.user.findFirst({
            where: { id: row.userId, role: 'STUDENT', isActive: true },
          });
          if (!user) throw new ConflictException('Student account changed; preview again');
          if (
            !(await tx.courseMembership.findFirst({
              where: { offeringId, userId: user.id, endedAt: null },
            }))
          )
            await tx.courseMembership.create({
              data: { offeringId, userId: user.id, role: 'STUDENT' },
            });
        }
        const committedAt = new Date();
        await tx.rosterImportPreview.update({ where: { id: previewId }, data: { committedAt } });
        await this.audit.record(tx, actor, 'ROSTER_IMPORTED', 'CourseOffering', offeringId, {
          previewId,
          rows: rows.length,
        });
        return { summary: preview.summary, committedAt };
      },
      { isolationLevel: 'Serializable', timeout: 15000 },
    );
  }
  async groups(actor: Actor, offeringId: string) {
    await this.policy.requireOffering(actor, offeringId);
    return this.db.projectGroup.findMany({
      where: { offeringId },
      include: groupInclude,
      orderBy: { name: 'asc' },
    });
  }
  private async replaceMembers(
    tx: Prisma.TransactionClient,
    actor: Actor,
    groupId: string,
    offeringId: string,
    userIds: string[],
  ) {
    const memberships = await tx.courseMembership.findMany({
      where: {
        offeringId,
        userId: { in: userIds },
        role: 'STUDENT',
        endedAt: null,
        user: { isActive: true },
      },
    });
    if (memberships.length !== userIds.length)
      throw new BadRequestException(
        'Every group member must be an active student in this offering',
      );
    if (
      await tx.groupMember.count({
        where: { offeringId, userId: { in: userIds }, leftAt: null, groupId: { not: groupId } },
      })
    )
      throw new ConflictException('A student already belongs to another active group');
    await tx.groupMember.updateMany({
      where: { groupId, leftAt: null, userId: { notIn: userIds } },
      data: { leftAt: new Date(), changedById: actor.id, changeReason: 'Group membership updated' },
    });
    for (const member of memberships)
      if (
        !(await tx.groupMember.findFirst({
          where: { groupId, userId: member.userId, leftAt: null },
        }))
      )
        await tx.groupMember.create({
          data: {
            groupId,
            offeringId,
            membershipId: member.id,
            userId: member.userId,
            membershipRole: 'STUDENT',
            changedById: actor.id,
          },
        });
  }
  async createGroup(actor: Actor, offeringId: string, dto: GroupDto) {
    await this.policy.requireOffering(actor, offeringId);
    if (actor.role === 'STUDENT' && (dto.memberIds.length !== 1 || dto.memberIds[0] !== actor.id))
      throw new ForbiddenException(
        'Students may create a group with themselves; instructors manage roster membership',
      );
    if (actor.role !== 'STUDENT') await this.policy.requireStaff(actor, offeringId);
    return this.db.$transaction(
      async (tx) => {
        this.editable(await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } }));
        const group = await tx.projectGroup.create({
          data: {
            offeringId,
            name: dto.name.trim(),
            project: {
              create: { offeringId, title: dto.title.trim(), description: dto.description },
            },
          },
        });
        await this.replaceMembers(tx, actor, group.id, offeringId, dto.memberIds);
        await this.audit.record(tx, actor, 'GROUP_CREATED', 'ProjectGroup', group.id, {
          offeringId,
        });
        return tx.projectGroup.findUniqueOrThrow({
          where: { id: group.id },
          include: groupInclude,
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async patchGroup(actor: Actor, id: string, dto: GroupPatchDto) {
    const group = await this.db.projectGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Group not found');
    const staff =
      actor.role === 'ADMIN' || (await this.policy.isInstructor(actor, group.offeringId));
    if (!staff && !(await this.policy.isGroupMember(actor, id)))
      throw new NotFoundException('Group not found');
    if (!staff && dto.memberIds)
      throw new ForbiddenException('Instructors manage group membership');
    return this.db.$transaction(
      async (tx) => {
        const current = await tx.projectGroup.findUniqueOrThrow({
          where: { id },
          include: { offering: true },
        });
        this.editable(current.offering);
        if (current.membershipLockedAt)
          throw new ConflictException(
            'Group and project metadata are locked after first submission',
          );
        const updated = await tx.projectGroup.updateMany({
          where: { id, revision: dto.revision, membershipLockedAt: null },
          data: { name: dto.name?.trim(), revision: { increment: 1 } },
        });
        if (!updated.count) throw new ConflictException('Group changed; reload before saving');
        await tx.project.update({
          where: { groupId: id },
          data: { title: dto.title?.trim(), description: dto.description },
        });
        if (dto.memberIds)
          await this.replaceMembers(tx, actor, id, group.offeringId, dto.memberIds);
        await this.audit.record(tx, actor, 'GROUP_UPDATED', 'ProjectGroup', id);
        return tx.projectGroup.findUniqueOrThrow({ where: { id }, include: groupInclude });
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async createRubric(actor: Actor, offeringId: string, dto: RubricDto) {
    await this.policy.requireStaff(actor, offeringId);
    return this.db.$transaction(async (tx) => {
      this.editable(await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } }));
      const rubric = await this.createRubricTx(tx, offeringId, dto);
      await this.audit.record(tx, actor, 'RUBRIC_CREATED', 'Rubric', rubric.id);
      return rubric;
    });
  }
  async reviseRubric(actor: Actor, id: string, dto: RubricDto) {
    const rubric = await this.db.rubric.findUnique({ where: { id } });
    if (!rubric) throw new NotFoundException('Rubric not found');
    await this.policy.requireStaff(actor, rubric.offeringId);
    this.checkRubric(dto);
    return this.db.$transaction(
      async (tx) => {
        this.editable(
          await tx.courseOffering.findUniqueOrThrow({ where: { id: rubric.offeringId } }),
        );
        const latest = await tx.rubricRevision.findFirstOrThrow({
          where: { rubricId: id },
          orderBy: { revisionNumber: 'desc' },
        });
        const revision = await tx.rubricRevision.create({
          data: {
            rubricId: id,
            offeringId: rubric.offeringId,
            revisionNumber: latest.revisionNumber + 1,
            requireRecommendation: dto.requireRecommendation ?? false,
            recommendationOptions: dto.recommendationOptions ?? [],
            requireOverallComment: dto.requireOverallComment ?? true,
            criteria: {
              create: dto.criteria.map((criterion, index) => ({
                ...criterion,
                sequence: index + 1,
              })),
            },
          },
          include: { criteria: true },
        });
        revision.publishedAt = new Date();
        await tx.rubricRevision.update({
          where: { id: revision.id },
          data: { publishedAt: revision.publishedAt },
        });
        await this.audit.record(tx, actor, 'RUBRIC_REVISED', 'Rubric', id, {
          revisionId: revision.id,
        });
        return revision;
      },
      { isolationLevel: 'Serializable' },
    );
  }
  async rubrics(actor: Actor, offeringId: string) {
    await this.policy.requireOffering(actor, offeringId);
    return this.db.rubric.findMany({
      where: { offeringId },
      include: {
        revisions: {
          orderBy: { revisionNumber: 'desc' },
          include: { criteria: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
  }
  async createStage(actor: Actor, offeringId: string, dto: StageDto) {
    await this.policy.requireStaff(actor, offeringId);
    assertStage(dto);
    return this.db.$transaction(async (tx) => {
      this.editable(await tx.courseOffering.findUniqueOrThrow({ where: { id: offeringId } }));
      if (!(await tx.rubricRevision.findFirst({ where: { id: dto.rubricRevisionId, offeringId } })))
        throw new BadRequestException('Rubric must belong to this offering');
      const stage = await tx.submissionStage.create({
        data: {
          ...dto,
          offeringId,
          reviewDeadline: dto.allowReviews ? dto.reviewDeadline : null,
          rebuttalDeadline: dto.allowRebuttal ? dto.rebuttalDeadline : null,
        },
      });
      await this.audit.record(tx, actor, 'STAGE_CREATED', 'SubmissionStage', stage.id);
      return stage;
    });
  }
  async patchStage(actor: Actor, id: string, dto: StagePatchDto) {
    const stage = await this.db.submissionStage.findUnique({ where: { id } });
    if (!stage) throw new NotFoundException('Stage not found');
    await this.policy.requireStaff(actor, stage.offeringId);
    assertStage(dto);
    return this.db.$transaction(
      async (tx) => {
        this.editable(
          await tx.courseOffering.findUniqueOrThrow({ where: { id: stage.offeringId } }),
        );
        if (await tx.submission.count({ where: { stageId: id } }))
          throw new ConflictException(
            'Stage configuration is locked after a submission is created; use a new stage or explicit submission reopen',
          );
        if (
          !(await tx.rubricRevision.findFirst({
            where: { id: dto.rubricRevisionId, offeringId: stage.offeringId },
          }))
        )
          throw new BadRequestException('Rubric must belong to this offering');
        const { revision, ...data } = dto;
        if (
          !(
            await tx.submissionStage.updateMany({
              where: { id, revision },
              data: {
                ...data,
                reviewDeadline: dto.allowReviews ? dto.reviewDeadline : null,
                rebuttalDeadline: dto.allowRebuttal ? dto.rebuttalDeadline : null,
                revision: { increment: 1 },
              },
            })
          ).count
        )
          throw new ConflictException('Stage changed; reload before saving');
        await this.audit.record(tx, actor, 'STAGE_UPDATED', 'SubmissionStage', id);
        return tx.submissionStage.findUniqueOrThrow({ where: { id } });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
