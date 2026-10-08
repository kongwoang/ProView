import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { AssignmentsService } from './assignments.service';
import { ReviewsService } from './reviews.service';
import { RebuttalsService } from './rebuttals.service';
@Module({
  controllers: [ReviewsController],
  providers: [AssignmentsService, ReviewsService, RebuttalsService],
  exports: [ReviewsService, RebuttalsService],
})
export class ReviewsModule {}
