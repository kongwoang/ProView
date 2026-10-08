import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, SimilarityStatus } from '@prisma/client';
import { Actor } from '../../common/actor';
import { paging, pageResult } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PolicyService } from '../policies/policy.service';
import { AuditService } from '../audit/audit.service';
import { SimilarityQueryDto, SimilarityUpdateDto } from './similarity.dto';
@Injectable()
export class SimilarityService {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}
  async list(actor: Actor, query: SimilarityQueryDto) {
    if (actor.role === 'STUDENT')
      throw new ForbiddenException('Similarity checks are limited to staff');
    const offeringIds =
      actor.role === 'ADMIN'
        ? undefined
        : (
            await this.db.courseMembership.findMany({
              where: { userId: actor.id, role: 'INSTRUCTOR', endedAt: null },
              select: { offeringId: true },
            })
          ).map((m) => m.offeringId);
    const where: Prisma.SimilarityCheckWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      version: {
        submission: {
          ...(offeringIds ? { offeringId: { in: offeringIds } } : {}),
          ...(query.search
            ? { project: { title: { contains: query.search, mode: 'insensitive' } } }
            : {}),
        },
      },
    };
    const [checks, total] = await Promise.all([
      this.db.similarityCheck.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'asc' },
        include: {
          version: {
            include: {
              submission: {
                include: { project: true, stage: true, offering: { include: { course: true } } },
              },
            },
          },
          resultFiles: {
            where: { state: 'READY' },
            select: { id: true, displayName: true, sizeBytes: true, sha256: true, createdAt: true },
          },
        },
      }),
      this.db.similarityCheck.count({ where }),
    ]);
    return pageResult(
      checks.map((c) => ({
        id: c.id,
        status: c.status,
        revision: c.revision,
        percentage: c.percentage === null ? null : Number(c.percentage),
        resultDate: c.resultDate,
        notes: c.notes,
        reason: c.reason,
        createdAt: c.createdAt,
        version: { id: c.version.id, versionNumber: c.version.versionNumber },
        submissionId: c.version.submissionId,
        project: { id: c.version.submission.project.id, title: c.version.submission.project.title },
        stage: { id: c.version.submission.stage.id, name: c.version.submission.stage.name },
        offering: {
          id: c.version.submission.offering.id,
          semester: c.version.submission.offering.semester,
          course: c.version.submission.offering.course,
        },
        resultFiles: c.resultFiles,
      })),
      total,
      query,
    );
  }
  async update(actor: Actor, id: string, command: string, input: SimilarityUpdateDto) {
    const check = await this.db.similarityCheck.findUnique({
      where: { id },
      include: { version: { include: { submission: { include: { project: true } } } } },
    });
    if (!check) throw new NotFoundException('Similarity check not found');
    await this.policy.requireStaff(actor, check.version.submission.offeringId);
    const transitions: Record<string, { from: SimilarityStatus[]; to: SimilarityStatus }> = {
      'mark-external': { from: ['PENDING'], to: 'SUBMITTED_EXTERNALLY' },
      complete: { from: ['SUBMITTED_EXTERNALLY'], to: 'COMPLETED' },
      fail: { from: ['PENDING', 'SUBMITTED_EXTERNALLY'], to: 'FAILED' },
      waive: { from: ['PENDING', 'SUBMITTED_EXTERNALLY', 'FAILED'], to: 'WAIVED' },
      retry: { from: ['FAILED'], to: 'PENDING' },
    };
    const rule = transitions[command];
    if (!rule || !rule.from.includes(check.status))
      throw new ConflictException('Invalid similarity workflow transition');
    if (['fail', 'waive', 'retry'].includes(command) && !input.reason?.trim())
      throw new BadRequestException('A reason is required');
    if (command === 'complete' && !input.resultDate)
      throw new BadRequestException('Result date is required');
    if (check.revision !== input.revision)
      throw new ConflictException('This similarity check has changed');
    return this.db.$transaction(async (tx) => {
      const data = {
        status: rule.to,
        revision: { increment: 1 },
        updatedById: actor.id,
        ...(command === 'mark-external' ? { submittedExternallyAt: new Date() } : {}),
        ...(input.percentage !== undefined
          ? { percentage: new Prisma.Decimal(input.percentage) }
          : {}),
        ...(input.resultDate ? { resultDate: new Date(input.resultDate) } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.reason ? { reason: input.reason.trim() } : {}),
      };
      const changed = await tx.similarityCheck.updateMany({
        where: { id, revision: input.revision, status: check.status },
        data,
      });
      if (changed.count !== 1) throw new ConflictException('This similarity check has changed');
      const updated = await tx.similarityCheck.findUniqueOrThrow({ where: { id } });
      await tx.similarityCheckHistory.create({
        data: {
          similarityCheckId: id,
          revision: updated.revision,
          status: updated.status,
          percentage: updated.percentage,
          resultDate: updated.resultDate,
          notes: updated.notes,
          reason: updated.reason,
          actorId: actor.id,
        },
      });
      await this.audit.record(tx, actor, 'SIMILARITY_UPDATED', 'SimilarityCheck', id, {
        status: updated.status,
        submissionVersionId: check.submissionVersionId,
      });
      if (['COMPLETED', 'WAIVED', 'FAILED'].includes(updated.status))
        await this.audit.notify(
          tx,
          {
            recipients: await this.audit.instructorRecipients(
              check.version.submission.offeringId,
              tx,
            ),
            type: 'SIMILARITY_RESULT',
            title: 'Similarity check updated',
            body: `The textual similarity check is ${updated.status.toLowerCase()}.`,
            targetUrl: `/submissions/${check.version.submissionId}`,
          },
          `similarity:${id}:${updated.revision}`,
        );
      return {
        ...updated,
        percentage: updated.percentage === null ? null : Number(updated.percentage),
      };
    });
  }
}
