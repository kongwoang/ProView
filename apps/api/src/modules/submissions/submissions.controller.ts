import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ApiPdfResponse } from '../../common/pdf-response';
import type { Response } from 'express';
import { Actor, CurrentActor } from '../../common/actor';
import { PageDto } from '../../common/page.dto';
import { servePdf } from '../storage/storage.service';
import { SubmissionsService } from './submissions.service';
import {
  CreateSubmissionDto,
  ReopenSubmissionDto,
  SubmissionRevisionDto,
  SubmitDto,
  UploadVersionDto,
} from './submissions.dto';

@ApiTags('submissions')
@ApiBearerAuth()
@Controller()
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}
  @Get('offerings/:id/submissions')
  list(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PageDto,
  ) {
    return this.service.listOffering(actor, id, query);
  }
  @Get('projects/mine') mine(@CurrentActor() actor: Actor) {
    return this.service.myProjects(actor);
  }
  @Get('projects/:id') project(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.project(actor, id);
  }
  @Post('projects/:id/submissions') create(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.service.create(actor, id, dto.stageId);
  }
  @Get('submissions/:id') detail(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(actor, id);
  }
  @Post('submissions/:id/versions')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        changeNote: { type: 'string', maxLength: 4000 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: Number(process.env.MAX_UPLOAD_BYTES || 20 * 1024 * 1024),
        files: 1,
        fields: 1,
      },
    }),
  )
  upload(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVersionDto,
  ) {
    return this.service.upload(actor, id, file, dto.changeNote);
  }
  @Post('submissions/:id/submit') submit(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitDto,
  ) {
    return this.service.submit(actor, id, dto);
  }
  @Post('submissions/:id/finalize-input') finalize(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmissionRevisionDto,
  ) {
    return this.service.finalizeInput(actor, id, dto.revision);
  }
  @Post('submissions/:id/reopen') reopen(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenSubmissionDto,
  ) {
    return this.service.reopen(actor, id, dto);
  }
  @Get('versions/:id/file')
  @ApiPdfResponse()
  async file(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const { file, data } = await this.service.file(actor, id);
    servePdf(response, file, data, range);
  }
}
