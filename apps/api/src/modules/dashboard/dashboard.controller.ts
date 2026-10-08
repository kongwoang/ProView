import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor } from '../../common/actor';
import { PrismaService } from '../../infrastructure/prisma.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly db: PrismaService) {}
  @Get() async get(@CurrentActor() actor: Actor) {
    const memberships = await this.db.courseMembership.findMany({
      where: { userId: actor.id, endedAt: null },
      include: {
        offering: { include: { course: true, stages: { orderBy: { sequence: 'asc' } } } },
      },
    });
    const instructorIds = memberships
      .filter((m) => m.role === 'INSTRUCTOR')
      .map((m) => m.offeringId);
    const activeGroups = await this.db.groupMember.findMany({
      where: { userId: actor.id, leftAt: null, membership: { endedAt: null } },
      include: { group: { include: { project: true, offering: { include: { course: true } } } } },
    });
    const groupIds = activeGroups.map((m) => m.groupId);
    const [
      assignments,
      unread,
      pendingConflicts,
      pendingSimilarity,
      gradingQueue,
      userCount,
      courseCount,
    ] = await Promise.all([
      this.db.reviewerAssignment.findMany({
        where: {
          OR: [
            { reviewerUserId: actor.id, offeringId: { in: instructorIds } },
            { reviewerGroupId: { in: groupIds } },
          ],
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED'] },
        },
        include: { submission: { include: { project: true, stage: true, offering: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.notification.count({ where: { recipientId: actor.id, readAt: null } }),
      instructorIds.length
        ? this.db.conflictOfInterestDeclaration.count({
            where: { status: 'PENDING', assignment: { offeringId: { in: instructorIds } } },
          })
        : 0,
      actor.role === 'ADMIN'
        ? this.db.similarityCheck.count({
            where: { status: { in: ['PENDING', 'SUBMITTED_EXTERNALLY', 'FAILED'] } },
          })
        : this.db.similarityCheck.count({
            where: {
              status: { in: ['PENDING', 'SUBMITTED_EXTERNALLY', 'FAILED'] },
              version: { submission: { offeringId: { in: instructorIds } } },
            },
          }),
      instructorIds.length
        ? this.db.submission.count({
            where: {
              offeringId: { in: instructorIds },
              submittedVersionId: { not: null },
              OR: [{ grade: null }, { grade: { publishedRevisionId: null } }],
            },
          })
        : 0,
      actor.role === 'ADMIN' ? this.db.user.count() : null,
      actor.role === 'ADMIN' ? this.db.course.count() : null,
    ]);
    const now = Date.now();
    const upcomingDeadlines = memberships
      .flatMap((m) =>
        m.offering.stages.flatMap((s) =>
          [
            { type: 'Submission', at: s.submissionDeadline },
            ...(s.reviewDeadline ? [{ type: 'Review', at: s.reviewDeadline }] : []),
            ...(s.rebuttalDeadline ? [{ type: 'Rebuttal', at: s.rebuttalDeadline }] : []),
          ]
            .filter((d) => d.at.getTime() > now && m.offering.status === 'ACTIVE')
            .map((d) => ({
              offeringId: m.offeringId,
              stageId: s.id,
              stageName: s.name,
              courseCode: m.offering.course.code,
              type: d.type,
              at: d.at,
              timezone: m.offering.timezone,
            })),
        ),
      )
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 10);
    const offerings = memberships.map((m) => ({
      id: m.offeringId,
      role: m.role,
      status: m.offering.status,
      semester: m.offering.semester,
      academicYear: m.offering.academicYear,
      course: {
        id: m.offering.course.id,
        code: m.offering.course.code,
        title: m.offering.course.title,
      },
    }));
    return {
      offerings,
      projects: activeGroups
        .filter((m) => m.group.project)
        .map((m) => ({
          id: m.group.project!.id,
          title: m.group.project!.title,
          group: { id: m.groupId, name: m.group.name },
          offering: {
            id: m.offeringId,
            semester: m.group.offering.semester,
            course: { code: m.group.offering.course.code, title: m.group.offering.course.title },
          },
        })),
      upcomingDeadlines,
      assignedReviews: assignments.map((a) => ({
        id: a.id,
        status: a.status,
        submissionId: a.submissionId,
        submissionVersionId: a.submissionVersionId,
        projectTitle: a.submission.project.title,
        stageName: a.submission.stage.name,
        reviewDeadline: a.submission.stage.reviewDeadline,
        timezone: a.submission.offering.timezone,
      })),
      notifications: { unread },
      counts: {
        activeOfferings: offerings.filter((o) => o.status === 'ACTIVE').length,
        assignedReviews: assignments.length,
        pendingConflicts,
        pendingSimilarity,
        gradingQueue,
        ...(actor.role === 'ADMIN' ? { users: userCount, courses: courseCount } : {}),
      },
    };
  }
}
