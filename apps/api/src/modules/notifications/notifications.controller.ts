import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';
import { NotificationPageDto, SuccessDto } from '../../common/response.dto';
import { Actor, CurrentActor } from '../../common/actor';
import { PageDto, paging, pageResult } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly db: PrismaService) {}
  @Get()
  @ApiOkResponse({ type: NotificationPageDto })
  async list(@CurrentActor() actor: Actor, @Query() query: PageDto): Promise<NotificationPageDto> {
    const where = { recipientId: actor.id };
    const [items, total, unread] = await Promise.all([
      this.db.notification.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          targetUrl: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.db.notification.count({ where }),
      this.db.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { ...pageResult(items, total, query), unread };
  }
  @Patch(':id/read')
  @ApiOkResponse({ type: SuccessDto })
  async read(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    const result = await this.db.notification.updateMany({
      where: { id, recipientId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (
      !result.count &&
      !(await this.db.notification.findFirst({ where: { id, recipientId: actor.id } }))
    )
      throw new NotFoundException('Notification not found');
    return { success: true };
  }
  @Post(':id/read')
  @ApiCreatedResponse({ type: SuccessDto })
  readPost(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SuccessDto> {
    return this.read(actor, id);
  }
  @Post('read-all')
  @ApiCreatedResponse({ type: SuccessDto })
  async all(@CurrentActor() actor: Actor): Promise<SuccessDto> {
    await this.db.notification.updateMany({
      where: { recipientId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true };
  }
}
