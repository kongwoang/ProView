import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ApiPdfResponse } from '../../common/pdf-response';
import type { Response } from 'express';
import { Actor, CurrentActor } from '../../common/actor';
import { SimilarityService } from './similarity.service';
import { SimilarityQueryDto, SimilarityUpdateDto } from './similarity.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PolicyService } from '../policies/policy.service';
import { AuditService } from '../audit/audit.service';
import { StorageService, servePdf } from '../storage/storage.service';
@ApiTags('Textual similarity')
@ApiBearerAuth()
@Controller('similarity-checks')
export class SimilarityController {
  constructor(
    private readonly service: SimilarityService,
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}
  @Get() list(@CurrentActor() actor: Actor, @Query() query: SimilarityQueryDto) {
    return this.service.list(actor, query);
  }
  @Post(':id/mark-external') external(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SimilarityUpdateDto,
  ) {
    return this.service.update(actor, id, 'mark-external', input);
  }
  @Post(':id/complete') complete(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SimilarityUpdateDto,
  ) {
    return this.service.update(actor, id, 'complete', input);
  }
  @Post(':id/fail') fail(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SimilarityUpdateDto,
  ) {
    return this.service.update(actor, id, 'fail', input);
  }
  @Post(':id/waive') waive(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SimilarityUpdateDto,
  ) {
    return this.service.update(actor, id, 'waive', input);
  }
  @Post(':id/retry') retry(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SimilarityUpdateDto,
  ) {
    return this.service.update(actor, id, 'retry', input);
  }
  private async check(actor: Actor, id: string) {
    const check = await this.db.similarityCheck.findUnique({
      where: { id },
      include: { version: { include: { submission: true } } },
    });
    if (!check) throw new NotFoundException('Similarity check not found');
    await this.policy.requireStaff(actor, check.version.submission.offeringId);
    return check;
  }
  @Post(':id/result-files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024, files: 1 },
    }),
  )
  async upload(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.check(actor, id);
    const stored = await this.storage.put(file, 'similarity-results');
    try {
      return await this.db.$transaction(async (tx) => {
        const result = await tx.similarityResultFile.create({
          data: { ...stored, similarityCheckId: id, state: 'READY', uploadedById: actor.id },
        });
        await this.audit.record(tx, actor, 'SIMILARITY_RESULT_UPLOADED', 'SimilarityCheck', id, {
          fileId: result.id,
          sha256: result.sha256,
        });
        return {
          id: result.id,
          displayName: result.displayName,
          sizeBytes: result.sizeBytes,
          sha256: result.sha256,
          createdAt: result.createdAt,
        };
      });
    } catch (error) {
      await this.storage.delete(stored.storageKey);
      throw error;
    }
  }
  @Get(':id/result-files/:fileId/file')
  @ApiPdfResponse()
  async file(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    await this.check(actor, id);
    const file = await this.db.similarityResultFile.findFirst({
      where: { id: fileId, similarityCheckId: id, state: 'READY' },
    });
    if (!file) throw new NotFoundException('Result PDF not found');
    await this.db.$transaction((tx) =>
      this.audit.record(tx, actor, 'SIMILARITY_RESULT_VIEWED', 'SimilarityResultFile', fileId),
    );
    servePdf(response, file, await this.storage.read(file.storageKey), range);
  }
}
