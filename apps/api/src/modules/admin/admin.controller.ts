import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { Actor, CurrentActor } from '../../common/actor';
import { PageDto, paging, pageResult } from '../../common/page.dto';
import { PrismaService } from '../../infrastructure/prisma.service';
import { PolicyService } from '../policies/policy.service';
import { AuditService } from '../audit/audit.service';
import { AuditQueryDto, CreateUserDto, ResetPasswordDto, UpdateUserDto } from './admin.dto';
const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;
@ApiTags('Administration')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(
    private readonly db: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}
  @Get('users') async users(@CurrentActor() actor: Actor, @Query() query: PageDto) {
    this.policy.requireAdmin(actor);
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { username: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        select: userSelect,
      }),
      this.db.user.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
  @Post('users') async create(@CurrentActor() actor: Actor, @Body() input: CreateUserDto) {
    this.policy.requireAdmin(actor);
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    try {
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email.trim().toLowerCase(),
            username: input.username.trim().toLowerCase(),
            displayName: input.displayName.trim(),
            passwordHash,
            role: input.role,
          },
          select: userSelect,
        });
        await this.audit.record(tx, actor, 'USER_CREATED', 'User', user.id, { role: user.role });
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Email or username is already in use');
      throw error;
    }
  }
  @Patch('users/:id') async update(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUserDto,
  ) {
    this.policy.requireAdmin(actor);
    if (!(await this.db.user.findUnique({ where: { id } })))
      throw new NotFoundException('User not found');
    try {
      return await this.db.$transaction(async (tx) => {
        const revoke = input.isActive === false || input.role !== undefined;
        const user = await tx.user.update({
          where: { id },
          data: {
            ...input,
            ...(input.email ? { email: input.email.trim().toLowerCase() } : {}),
            ...(input.displayName ? { displayName: input.displayName.trim() } : {}),
            ...(revoke ? { tokenVersion: { increment: 1 } } : {}),
          },
          select: userSelect,
        });
        if (revoke)
          await tx.authSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        await this.audit.record(tx, actor, 'USER_UPDATED', 'User', id, {
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.role ? { role: input.role } : {}),
        });
        return user;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Email is already in use');
      throw error;
    }
  }
  @Post('users/:id/password-reset') async reset(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ResetPasswordDto,
  ) {
    this.policy.requireAdmin(actor);
    if (!(await this.db.user.findUnique({ where: { id } })))
      throw new NotFoundException('User not found');
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, actor, 'PASSWORD_RESET', 'User', id);
    });
    return { success: true };
  }
  @Get('audit-logs') async logs(@CurrentActor() actor: Actor, @Query() query: AuditQueryDto) {
    this.policy.requireAdmin(actor);
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        ...paging(query),
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, displayName: true, email: true } } },
      }),
      this.db.auditLog.count({ where }),
    ]);
    return pageResult(items, total, query);
  }
}
