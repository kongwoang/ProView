import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Actor, CurrentActor } from '../../common/actor';
import { GradesService } from './grades.service';
import { SaveGradeDto, PublishGradeDto } from './grade.dto';
@ApiTags('Grading')
@ApiBearerAuth()
@Controller()
export class GradesController {
  constructor(private readonly service: GradesService) {}
  @Get('submissions/:id/grade') get(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(actor, id);
  }
  @Get('submissions/:id/grading-context') context(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.context(actor, id);
  }
  @Put('submissions/:id/grade') save(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveGradeDto,
  ) {
    return this.service.save(actor, id, input);
  }
  @Post('grades/:id/publish') publish(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: PublishGradeDto,
  ) {
    return this.service.publish(actor, id, input);
  }
}
