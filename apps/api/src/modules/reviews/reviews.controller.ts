import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor } from '../../common/actor';
import { AssignmentsService } from './assignments.service';
import { ReviewsService } from './reviews.service';
import { RebuttalsService } from './rebuttals.service';
import {
  AssignmentPlanDto,
  ConflictDecisionDto,
  CorrectionDto,
  DiscussionDto,
  ManualAssignmentDto,
  ReasonDto,
  RebuttalDraftDto,
  ReleaseDto,
  ReopenRebuttalDto,
  ReviewDraftDto,
  RevisionDto,
} from './reviews.dto';

@ApiTags('Review workflow')
@ApiBearerAuth()
@Controller()
export class ReviewsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly reviews: ReviewsService,
    private readonly rebuttals: RebuttalsService,
  ) {}
  @Get('reviewer-assignments') assignmentsList(
    @CurrentActor() a: Actor,
    @Query('offeringId', new ParseUUIDPipe({ optional: true })) offeringId?: string,
    @Query('submissionId', new ParseUUIDPipe({ optional: true })) submissionId?: string,
  ) {
    return this.assignments.list(a, offeringId, submissionId);
  }
  @Post('reviewer-assignments') manual(
    @CurrentActor() a: Actor,
    @Body() input: ManualAssignmentDto,
  ) {
    return this.assignments.manual(a, input);
  }
  @Post('offerings/:id/assignment-plans') plan(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignmentPlanDto,
  ) {
    return this.assignments.preview(a, id, input.stageId);
  }
  @Post('assignment-plans/:id/apply') apply(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.assignments.apply(a, id);
  }
  @Post('reviewer-assignments/:id/cancel') cancel(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReasonDto,
  ) {
    return this.assignments.cancel(a, id, input.reason);
  }
  @Post('reviewer-assignments/:id/conflicts') conflict(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReasonDto,
  ) {
    return this.assignments.conflict(a, id, input.reason);
  }
  @Post('conflicts/:id/decision') decide(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConflictDecisionDto,
  ) {
    return this.assignments.decideConflict(a, id, input);
  }
  @Post('reviewer-assignments/:id/replacement') replace(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ManualAssignmentDto,
  ) {
    return this.assignments.replacement(a, id, input);
  }
  @Get('reviewer-assignments/:id/review') review(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviews.getAssignmentReview(a, id);
  }
  @Put('reviewer-assignments/:id/review') save(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReviewDraftDto,
  ) {
    return this.reviews.save(a, id, input);
  }
  @Post('reviews/:id/submit') submit(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RevisionDto,
  ) {
    return this.reviews.submit(a, id, input.revision);
  }
  @Get('reviews/:id/revisions') history(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviews.history(a, id);
  }
  @Post('reviews/:id/correction-authorizations') correction(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CorrectionDto,
  ) {
    return this.reviews.authorizeCorrection(a, id, input);
  }
  @Get('submissions/:id/reviews') list(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reviews.list(a, id);
  }
  @Post('submissions/:id/reviews/release') release(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReleaseDto,
  ) {
    return this.reviews.release(a, id, input);
  }
  @Get('submissions/:id/rebuttal') rebuttal(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rebuttals.get(a, id);
  }
  @Put('submissions/:id/rebuttal') saveRebuttal(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RebuttalDraftDto,
  ) {
    return this.rebuttals.save(a, id, input);
  }
  @Post('rebuttals/:id/finalize') finalize(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RevisionDto,
  ) {
    return this.rebuttals.finalize(a, id, input.revision);
  }
  @Post('rebuttals/:id/reopen') reopen(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ReopenRebuttalDto,
  ) {
    return this.rebuttals.reopen(a, id, input);
  }
  @Get('submissions/:id/discussions') discussions(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rebuttals.discussions(a, id);
  }
  @Post('submissions/:id/discussions') discuss(
    @CurrentActor() a: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: DiscussionDto,
  ) {
    return this.rebuttals.postDiscussion(a, id, input);
  }
}
