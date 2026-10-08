import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../../common/actor';
import { paging, pageResult } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PolicyService } from '../policies/policy.service';
import { AuditService } from '../audit/audit.service';
import { ApproveArchiveDto, ArchiveQueryDto } from './archive.dto';
const archiveInclude = {
  project: {
    include: {
      group: {
        include: {
          members: {
            include: {
              membership: { include: { user: { select: { id: true, displayName: true } } } },
            },
          },
        },
      },
      offering: { include: { course: true } },
    },
  },
  version: { include: { submission: { include: { stage: true } }, file: true } },
} as const;
type Publication = Prisma.ArchivePublicationGetPayload<{ include: typeof archiveInclude }>;
const publicationView = (p: Publication) => ({
  id: p.id,
  project: { id: p.projectId, title: p.project.title, description: p.project.description },
  offering: {
    id: p.project.offeringId,
    semester: p.project.offering.semester,
    academicYear: p.project.offering.academicYear,
    course: p.project.offering.course,
  },
  stage: { id: p.version.submission.stage.id, name: p.version.submission.stage.name },
  version: { id: p.version.id, versionNumber: p.version.versionNumber },
  file: p.version.file
    ? {
        displayName: p.version.file.displayName,
        sizeBytes: p.version.file.sizeBytes,
        sha256: p.version.file.sha256,
      }
    : null,
  approvedAt: p.approvedAt,
  revokedAt: p.revokedAt,
  allowDownload: p.allowDownload,
});
@Injectable()
export class ArchiveService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}
  private filters(query: ArchiveQueryDto): Prisma.ProjectWhereInput {
    return {
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
      offering: {
        ...(query.courseId ? { courseId: query.courseId } : {}),
        ...(query.semester ? { semester: query.semester } : {}),
        status: { in: ['CLOSED', 'ARCHIVED'] },
      },
    };
  }
  private async allowedSources(actor: Actor): Promise<Prisma.ProjectWhereInput> {
    if (actor.role === 'ADMIN') return {};
    const memberships = await this.db.courseMembership.findMany({
      where: { userId: actor.id, endedAt: null },
      include: { offering: true },
    });
    const ownInstructorIds = memberships
      .filter((m) => m.role === 'INSTRUCTOR')
      .map((m) => m.offeringId);
    const later = memberships
      .filter((m) => m.role === 'STUDENT')
      .map((m) => ({
        offering: { courseId: m.offering.courseId, termStartAt: { lt: m.offering.termStartAt } },
      }));
    return {
      OR: [
        ...(ownInstructorIds.length ? [{ offeringId: { in: ownInstructorIds } }] : []),
        ...later,
      ],
    };
  }
  async references(actor: Actor, query: ArchiveQueryDto) {
    if (query.student && actor.role === 'STUDENT')
      throw new ForbiddenException('Student searching is limited to staff');
    const where: Prisma.ArchivePublicationWhereInput = {
      revokedAt: null,
      project: {
        AND: [
          this.filters(query),
          await this.allowedSources(actor),
          ...(query.student
            ? [
                {
                  group: {
                    members: {
                      some: {
                        membership: {
                          user: {
                            displayName: { contains: query.student, mode: 'insensitive' as const },
                          },
                        },
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
    };
    const [rows, total] = await Promise.all([
      this.db.archivePublication.findMany({
        where,
        ...paging(query),
        orderBy: { approvedAt: 'desc' },
        include: archiveInclude,
      }),
      this.db.archivePublication.count({ where }),
    ]);
    return pageResult(rows.map(publicationView), total, query);
  }
  async own(actor: Actor, query: ArchiveQueryDto) {
    if (query.student)
      throw new ForbiddenException('Student filter is unavailable for personal history');
    const where: Prisma.ProjectWhereInput = {
      AND: [this.filters(query), { group: { members: { some: { userId: actor.id } } } }],
    };
    const [rows, total] = await Promise.all([
      this.db.project.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { id: true, name: true } },
          offering: { include: { course: true } },
          submissions: {
            include: {
              stage: true,
              submittedVersion: {
                include: { authors: { where: { userId: actor.id } }, file: true },
              },
              grade: { include: { publishedRevision: true } },
            },
          },
        },
      }),
      this.db.project.count({ where }),
    ]);
    return pageResult(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        group: p.group,
        offering: {
          id: p.offeringId,
          semester: p.offering.semester,
          academicYear: p.offering.academicYear,
          course: p.offering.course,
        },
        submissions: p.submissions.map((s) => ({
          id: s.id,
          status: s.status,
          stage: { id: s.stageId, name: s.stage.name },
          version: s.submittedVersion
            ? {
                id: s.submittedVersion.id,
                versionNumber: s.submittedVersion.versionNumber,
                canView: s.submittedVersion.authors.length > 0,
              }
            : null,
          grade:
            s.submittedVersion?.authors.length && s.grade?.publishedRevision
              ? {
                  overall:
                    s.grade.publishedRevision.overall === null
                      ? null
                      : Number(s.grade.publishedRevision.overall),
                  feedback: s.grade.publishedRevision.feedback,
                }
              : null,
        })),
      })),
      total,
      query,
    );
  }
  async manage(actor: Actor, query: ArchiveQueryDto) {
    if (actor.role === 'STUDENT')
      throw new ForbiddenException('Archive management is limited to staff');
    const managedIds =
      actor.role === 'ADMIN'
        ? undefined
        : (
            await this.db.courseMembership.findMany({
              where: { userId: actor.id, role: 'INSTRUCTOR', endedAt: null },
              select: { offeringId: true },
            })
          ).map((m) => m.offeringId);
    const where: Prisma.ProjectWhereInput = {
      AND: [
        this.filters(query),
        ...(managedIds ? [{ offeringId: { in: managedIds } }] : []),
        ...(query.student
          ? [
              {
                group: {
                  members: {
                    some: {
                      membership: {
                        user: {
                          displayName: { contains: query.student, mode: 'insensitive' as const },
                        },
                      },
                    },
                  },
                },
              },
            ]
          : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.db.project.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        include: {
          offering: { include: { course: true } },
          submissions: {
            where: { status: 'FINALIZED' },
            include: {
              stage: true,
              submittedVersion: { select: { id: true, versionNumber: true } },
            },
          },
          publications: {
            where: { revokedAt: null },
            select: { id: true, submissionVersionId: true, allowDownload: true, approvedAt: true },
          },
        },
      }),
      this.db.project.count({ where }),
    ]);
    return pageResult(
      rows.map((p) => ({
        id: p.id,
        title: p.title,
        offering: { id: p.offeringId, semester: p.offering.semester, course: p.offering.course },
        submissions: p.submissions.map((s) => ({
          id: s.id,
          stage: { id: s.stageId, name: s.stage.name },
          version: s.submittedVersion,
        })),
        publications: p.publications,
      })),
      total,
      query,
    );
  }
  async approve(actor: Actor, input: ApproveArchiveDto) {
    const version = await this.db.submissionVersion.findUnique({
      where: { id: input.submissionVersionId },
      include: {
        file: true,
        submission: {
          include: { offering: true, grade: { include: { publishedRevision: true } } },
        },
      },
    });
    if (!version) throw new NotFoundException('Submission version not found');
    await this.policy.requireStaff(actor, version.submission.offeringId);
    if (
      !['CLOSED', 'ARCHIVED'].includes(version.submission.offering.status) ||
      version.submission.status !== 'FINALIZED' ||
      version.submission.submittedVersionId !== version.id ||
      version.file?.state !== 'READY' ||
      version.submission.grade?.publishedRevision?.submissionVersionId !== version.id
    )
      throw new ConflictException(
        'Approve a finalized, graded report from a closed or archived offering',
      );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Submission" WHERE id=${version.submissionId}::uuid FOR UPDATE`;
      const same = await tx.archivePublication.findFirst({
        where: {
          projectId: version.submission.projectId,
          submissionVersionId: version.id,
          revokedAt: null,
        },
      });
      if (same) {
        if (same.allowDownload !== input.allowDownload) {
          await tx.archivePublication.update({
            where: { id: same.id },
            data: { allowDownload: input.allowDownload },
          });
          await this.audit.record(
            tx,
            actor,
            'ARCHIVE_POLICY_UPDATED',
            'ArchivePublication',
            same.id,
            { allowDownload: input.allowDownload },
          );
        }
        return { ...same, allowDownload: input.allowDownload };
      }
      await tx.archivePublication.updateMany({
        where: { projectId: version.submission.projectId, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedById: actor.id,
          revokeReason: 'Replaced by a newly approved report',
        },
      });
      const publication = await tx.archivePublication.create({
        data: {
          projectId: version.submission.projectId,
          submissionId: version.submissionId,
          submissionVersionId: version.id,
          approvedById: actor.id,
          allowDownload: input.allowDownload,
        },
      });
      await this.audit.record(tx, actor, 'ARCHIVE_APPROVED', 'ArchivePublication', publication.id, {
        submissionVersionId: version.id,
        allowDownload: input.allowDownload,
      });
      return publication;
    });
  }
  async revoke(actor: Actor, id: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('A revocation reason is required');
    const publication = await this.db.archivePublication.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!publication) throw new NotFoundException('Publication not found');
    await this.policy.requireStaff(actor, publication.project.offeringId);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.archivePublication.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id, revokeReason: reason.trim() },
      });
      if (updated.count)
        await this.audit.record(tx, actor, 'ARCHIVE_REVOKED', 'ArchivePublication', id, {
          reason: reason.trim(),
        });
      return { success: true };
    });
  }
  async publicationAccess(actor: Actor, id: string, download = false) {
    const p = await this.db.archivePublication.findFirst({
      where: {
        id,
        revokedAt: null,
        project: {
          AND: [
            { offering: { status: { in: ['CLOSED', 'ARCHIVED'] } } },
            await this.allowedSources(actor),
          ],
        },
      },
      include: archiveInclude,
    });
    if (!p || p.version.file?.state !== 'READY')
      throw new NotFoundException('Archived report not found');
    if (download && !p.allowDownload && actor.role === 'STUDENT')
      throw new ForbiddenException('Download permission is required');
    return p;
  }
}
