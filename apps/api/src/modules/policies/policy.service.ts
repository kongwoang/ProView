import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Actor } from '../../common/actor';

@Injectable()
export class PolicyService {
  constructor(private readonly db: PrismaService) {}
  async isInstructor(actor: Actor, offeringId: string) {
    return !!(await this.db.courseMembership.findFirst({
      where: { userId: actor.id, offeringId, role: 'INSTRUCTOR', endedAt: null },
    }));
  }
  async requireInstructor(actor: Actor, offeringId: string) {
    if (!(await this.isInstructor(actor, offeringId)))
      throw new ForbiddenException('Instructor membership is required for this offering');
  }
  async requireStaff(actor: Actor, offeringId: string) {
    if (actor.role !== 'ADMIN') await this.requireInstructor(actor, offeringId);
  }
  requireAdmin(actor: Actor) {
    if (actor.role !== 'ADMIN')
      throw new ForbiddenException('Administrator permission is required');
  }
  async requireOffering(actor: Actor, offeringId: string) {
    const offering = await this.db.courseOffering.findUnique({
      where: { id: offeringId },
      include: { course: true },
    });
    if (!offering) throw new NotFoundException('Course offering not found');
    if (
      actor.role !== 'ADMIN' &&
      !(await this.db.courseMembership.findFirst({
        where: { userId: actor.id, offeringId, endedAt: null },
      }))
    )
      throw new NotFoundException('Course offering not found');
    return offering;
  }
  async isGroupMember(actor: Actor, groupId: string) {
    return !!(await this.db.groupMember.findFirst({
      where: {
        userId: actor.id,
        groupId,
        leftAt: null,
        membership: { endedAt: null, role: 'STUDENT' },
      },
    }));
  }
  async submissionContext(submissionId: string) {
    const submission = await this.db.submission.findUnique({
      where: { id: submissionId },
      include: {
        project: { include: { group: true } },
        stage: {
          include: { rubricRevision: { include: { criteria: { orderBy: { sequence: 'asc' } } } } },
        },
        offering: { include: { course: true } },
        submittedVersion: { include: { file: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
  async requireAuthor(actor: Actor, submissionId: string) {
    const submission = await this.submissionContext(submissionId);
    if (!(await this.isGroupMember(actor, submission.project.groupId)))
      throw new NotFoundException('Submission not found');
    return submission;
  }
  async canReviewAssignment(actor: Actor, assignmentId: string) {
    const assignment = await this.db.reviewerAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || !['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(assignment.status))
      return false;
    return assignment.reviewerType === 'INSTRUCTOR'
      ? assignment.reviewerUserId === actor.id &&
          (await this.isInstructor(actor, assignment.offeringId))
      : !!assignment.reviewerGroupId &&
          (await this.isGroupMember(actor, assignment.reviewerGroupId));
  }
  async requireSubmissionView(actor: Actor, submissionId: string) {
    const submission = await this.submissionContext(submissionId);
    if (
      (await this.isInstructor(actor, submission.offeringId)) ||
      (await this.isGroupMember(actor, submission.project.groupId))
    )
      return submission;
    const assignments = await this.db.reviewerAssignment.findMany({
      where: {
        submissionId,
        reviewCycle: submission.reviewCycle,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] },
      },
    });
    for (const assignment of assignments)
      if (await this.canReviewAssignment(actor, assignment.id)) return submission;
    throw new NotFoundException('Submission not found');
  }
  async requireVersionView(actor: Actor, versionId: string) {
    const version = await this.db.submissionVersion.findUnique({
      where: { id: versionId },
      include: { file: true, submission: { include: { project: true } } },
    });
    if (!version) throw new NotFoundException('File not found');
    if (
      (await this.isInstructor(actor, version.submission.offeringId)) ||
      (await this.isGroupMember(actor, version.submission.project.groupId)) ||
      (await this.db.submissionVersionAuthor.findFirst({
        where: { submissionVersionId: versionId, userId: actor.id },
      }))
    )
      return version;
    const assignments = await this.db.reviewerAssignment.findMany({
      where: {
        submissionVersionId: versionId,
        reviewCycle: version.submission.reviewCycle,
        status: { in: ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'] },
      },
    });
    for (const assignment of assignments)
      if (await this.canReviewAssignment(actor, assignment.id)) return version;
    // Administrator file access is a distinct privileged capability, audited by the file service.
    if (actor.role === 'ADMIN') return version;
    throw new NotFoundException('File not found');
  }
}
