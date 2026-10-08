import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Actor, CurrentActor } from '../../common/actor';
import { ArchiveService } from './archive.service';
import { ApproveArchiveDto, ArchiveQueryDto, RevokeArchiveDto } from './archive.dto';
import { StorageService, servePdf } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../infrastructure/prisma.service';
@ApiTags('Archive')
@ApiBearerAuth()
@Controller('archive')
export class ArchiveController {
  constructor(
    private readonly service: ArchiveService,
    private readonly storage: StorageService,
    private readonly db: PrismaService,
    private readonly audit: AuditService,
  ) {}
  @Get('own') own(@CurrentActor() actor: Actor, @Query() query: ArchiveQueryDto) {
    return this.service.own(actor, query);
  }
  @Get('references') references(@CurrentActor() actor: Actor, @Query() query: ArchiveQueryDto) {
    return this.service.references(actor, query);
  }
  @Get('manage') manage(@CurrentActor() actor: Actor, @Query() query: ArchiveQueryDto) {
    return this.service.manage(actor, query);
  }
  @Post('publications') approve(@CurrentActor() actor: Actor, @Body() input: ApproveArchiveDto) {
    return this.service.approve(actor, input);
  }
  @Post('publications/:id/revoke') revoke(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: RevokeArchiveDto,
  ) {
    return this.service.revoke(actor, id, input.reason);
  }
  @Get('publications/:id/file') async file(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    const p = await this.service.publicationAccess(actor, id);
    const file = p.version.file!;
    await this.db.$transaction((tx) =>
      this.audit.record(tx, actor, 'ARCHIVE_FILE_VIEWED', 'ArchivePublication', id),
    );
    servePdf(response, file, await this.storage.read(file.storageKey), range);
  }
  @Get('publications/:id/download') async download(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const p = await this.service.publicationAccess(actor, id, true);
    const file = p.version.file!;
    await this.db.$transaction((tx) =>
      this.audit.record(tx, actor, 'ARCHIVE_FILE_DOWNLOADED', 'ArchivePublication', id),
    );
    response.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `attachment; filename="report.pdf"`,
    });
    response.send(await this.storage.read(file.storageKey));
  }
}
