import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Actor, CurrentActor } from '../../common/actor';
import { PageDto } from '../../common/page.dto';
import { CoursesService } from './courses.service';
import {
  CourseDto,
  CoursePatchDto,
  CsvDto,
  GroupDto,
  GroupPatchDto,
  ImportDto,
  MembershipDto,
  OfferingDto,
  OfferingPatchDto,
  RubricDto,
  StageDto,
  StagePatchDto,
} from './courses.dto';

@ApiTags('courses')
@ApiBearerAuth()
@Controller()
export class CoursesController {
  constructor(private readonly service: CoursesService) {}
  @Get('courses') courses(@CurrentActor() actor: Actor, @Query() query: PageDto) {
    return this.service.courses(actor, query);
  }
  @Post('courses') course(@CurrentActor() actor: Actor, @Body() dto: CourseDto) {
    return this.service.createCourse(actor, dto);
  }
  @Patch('courses/:id') patchCourse(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CoursePatchDto,
  ) {
    return this.service.patchCourse(actor, id, dto);
  }
  @Delete('courses/:id')
  deactivateCourse(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.patchCourse(actor, id, { isActive: false });
  }
  @Get('offerings') offerings(@CurrentActor() actor: Actor, @Query() query: PageDto) {
    return this.service.offerings(actor, query);
  }
  @Post('offerings') create(@CurrentActor() actor: Actor, @Body() dto: OfferingDto) {
    return this.service.createOffering(actor, dto);
  }
  @Get('offerings/:id') get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.offering(actor, id);
  }
  @Patch('offerings/:id') patch(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OfferingPatchDto,
  ) {
    return this.service.patchOffering(actor, id, dto);
  }
  @Get('offerings/:id/roster') roster(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.roster(actor, id);
  }
  @Post('offerings/:id/roster') addMember(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MembershipDto,
  ) {
    return this.service.addMember(actor, id, dto);
  }
  @Delete('offerings/:id/roster/:memberId') removeMember(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.service.removeMember(actor, id, memberId);
  }
  @Post('offerings/:id/roster/preview') preview(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CsvDto,
  ) {
    return this.service.previewRoster(actor, id, dto);
  }
  @Post('offerings/:id/roster/import') import(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportDto,
  ) {
    return this.service.importRoster(actor, id, dto.previewId);
  }
  @Get('offerings/:id/groups') groups(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.groups(actor, id);
  }
  @Post('offerings/:id/groups') createGroup(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupDto,
  ) {
    return this.service.createGroup(actor, id, dto);
  }
  @Patch('groups/:id') patchGroup(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GroupPatchDto,
  ) {
    return this.service.patchGroup(actor, id, dto);
  }
  @Get('offerings/:id/rubrics') rubrics(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.rubrics(actor, id);
  }
  @Post('offerings/:id/rubrics') rubric(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RubricDto,
  ) {
    return this.service.createRubric(actor, id, dto);
  }
  @Post('rubrics/:id/revisions') revision(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RubricDto,
  ) {
    return this.service.reviseRubric(actor, id, dto);
  }
  @Post('offerings/:id/stages') stage(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StageDto,
  ) {
    return this.service.createStage(actor, id, dto);
  }
  @Patch('stages/:id') patchStage(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StagePatchDto,
  ) {
    return this.service.patchStage(actor, id, dto);
  }
}
