import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Actor } from '../../common/actor';
import { randomUUID } from 'node:crypto';

export interface NotificationIntent {
  recipients: string[];
  type: string;
  title: string;
  body: string;
  targetUrl: string;
}

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(private readonly db: PrismaService) {}
  record(
    tx: Prisma.TransactionClient,
    actor: Actor | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    return tx.auditLog.create({
      data: { actorId: actor?.id, action, entityType, entityId, metadata },
    });
  }
  notify(tx: Prisma.TransactionClient, intent: NotificationIntent, key: string) {
    return tx.outboxEvent.upsert({
      where: { idempotencyKey: key },
      create: {
        type: 'IN_APP_NOTIFICATION',
        payload: { ...intent, recipients: [...new Set(intent.recipients)] },
        idempotencyKey: key,
      },
      update: {},
    });
  }
  async groupRecipients(groupId: string, tx: Prisma.TransactionClient = this.db) {
    const rows = await tx.groupMember.findMany({
      where: { groupId, leftAt: null, membership: { endedAt: null, user: { isActive: true } } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }
  async instructorRecipients(offeringId: string, tx: Prisma.TransactionClient = this.db) {
    const rows = await tx.courseMembership.findMany({
      where: { offeringId, role: 'INSTRUCTOR', endedAt: null, user: { isActive: true } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.deliver().catch(() => undefined);
    }, 1500);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async deliver() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const rows = await this.db.outboxEvent.findMany({
        where: {
          processedAt: null,
          availableAt: { lte: now },
          OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
        },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
      for (const event of rows) {
        const owner = randomUUID();
        const claimed = await this.db.outboxEvent.updateMany({
          where: {
            id: event.id,
            processedAt: null,
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
          },
          data: {
            leaseOwner: owner,
            leaseUntil: new Date(Date.now() + 30_000),
            attempts: { increment: 1 },
          },
        });
        if (!claimed.count) continue;
        try {
          const payload = event.payload as unknown as NotificationIntent;
          if (
            event.type !== 'IN_APP_NOTIFICATION' ||
            !Array.isArray(payload.recipients) ||
            !payload.targetUrl.startsWith('/') ||
            payload.targetUrl.startsWith('//')
          )
            throw new Error('Invalid notification event');
          await this.db.$transaction(async (tx) => {
            await tx.notification.createMany({
              data: payload.recipients.map((recipientId) => ({
                recipientId,
                type: payload.type,
                title: payload.title,
                body: payload.body,
                targetUrl: payload.targetUrl,
                deduplicationKey: `${event.idempotencyKey}:${recipientId}`,
              })),
              skipDuplicates: true,
            });
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                processedAt: new Date(),
                leaseUntil: null,
                leaseOwner: null,
                lastError: null,
              },
            });
          });
        } catch {
          await this.db.outboxEvent.updateMany({
            where: { id: event.id, leaseOwner: owner },
            data: {
              leaseUntil: null,
              leaseOwner: null,
              availableAt: new Date(
                Date.now() + Math.min(300_000, 2 ** Math.min(event.attempts, 10) * 1000),
              ),
              lastError: 'Notification delivery failed',
            },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
