import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
@Module({
  imports: [StorageModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
