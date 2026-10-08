import { Global, Module } from '@nestjs/common';
import { PolicyService } from '../modules/policies/policy.service';
import { AuditService } from '../modules/audit/audit.service';
import { NotificationsController } from '../modules/notifications/notifications.controller';
import { DeadlineRemindersService } from '../modules/notifications/deadline-reminders.service';
@Global()
@Module({
  providers: [PolicyService, AuditService, DeadlineRemindersService],
  controllers: [NotificationsController],
  exports: [PolicyService, AuditService],
})
export class DomainCoreModule {}
