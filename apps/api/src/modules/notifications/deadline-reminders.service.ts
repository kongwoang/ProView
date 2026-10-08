import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Database outbox keys make reminders safe across restarts and multiple API replicas. */
@Injectable()
export class DeadlineRemindersService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    void this.enqueue().catch(() => undefined);
    this.timer = setInterval(() => {
      void this.enqueue().catch(() => undefined);
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const assignments = await this.db.reviewerAssignment.findMany({
        where: {
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
          submission: {
            status: 'UNDER_REVIEW',
            offering: { status: 'ACTIVE' },
            stage: { reviewDeadline: { gt: now, lte: new Date(now.getTime() + 86_400_000) } },
          },
        },
        include: {
          submission: {
            select: { reviewCycle: true, stage: { select: { reviewDeadline: true } } },
          },
          reviewerGroup: {
            select: {
              members: {
                where: { leftAt: null, membership: { endedAt: null, user: { isActive: true } } },
                select: { userId: true },
              },
            },
          },
        },
      });
      for (const assignment of assignments) {
        const deadline = assignment.submission.stage.reviewDeadline;
        if (!deadline || assignment.reviewCycle !== assignment.submission.reviewCycle) continue;
        const reviewer = assignment.reviewerUserId
          ? await this.db.user.findUnique({
              where: { id: assignment.reviewerUserId },
              select: { id: true, isActive: true },
            })
          : null;
        const recipients =
          assignment.reviewerGroup?.members.map((member) => member.userId) ??
          (reviewer?.isActive ? [reviewer.id] : []);
        if (!recipients.length) continue;
        await this.db.$transaction((tx) =>
          this.audit.notify(
            tx,
            {
              recipients,
              type: 'REVIEW_DEADLINE_APPROACHING',
              title: 'Review deadline approaching',
              body: `Your assigned review is due at ${deadline.toISOString()}.`,
              targetUrl: `/reviews/${assignment.id}`,
            },
            `review-deadline:${assignment.id}:${deadline.toISOString()}`,
          ),
        );
      }
    } finally {
      this.running = false;
    }
  }
}
