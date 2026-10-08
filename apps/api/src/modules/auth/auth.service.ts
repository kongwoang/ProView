import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/prisma.service';
import { Actor, publicUser } from '../../common/actor';
import { UpdateProfileDto } from './auth.dto';
import { AuditService } from '../audit/audit.service';

const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private async issue(
    user: {
      id: string;
      tokenVersion: number;
      email: string;
      username: string;
      displayName: string;
      role: Actor['role'];
    },
    sessionId: string,
    refreshToken: string,
  ) {
    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        sid: sessionId,
        ver: user.tokenVersion,
      }),
      user: publicUser(user),
      refreshToken,
    };
  }

  private sessionData(
    userId: string,
    familyId: string,
    refreshToken: string,
    client: { userAgent?: string; ipAddress?: string },
    parentId?: string,
  ) {
    return {
      userId,
      familyId,
      parentId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(
        Date.now() + Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7) * 86_400_000,
      ),
      userAgent: client.userAgent?.slice(0, 500),
      ipAddress: client.ipAddress?.slice(0, 64),
    };
  }

  async login(
    identifier: string,
    password: string,
    client: { userAgent?: string; ipAddress?: string },
  ) {
    const key = identifier.trim().toLowerCase();
    const user = await this.db.user.findFirst({
      where: { OR: [{ email: key }, { username: key }] },
    });
    let valid = false;
    if (user) {
      try {
        valid = await argon2.verify(user.passwordHash, password);
      } catch {
        valid = false;
      }
    } else {
      // Preserve a password-hashing cost when the identifier does not exist.
      await argon2.hash(password, { type: argon2.argon2id });
    }
    if (!user?.isActive || !valid) throw new UnauthorizedException('Invalid credentials');
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.db.authSession.create({
      data: this.sessionData(user.id, randomUUID(), refreshToken, client),
    });
    return this.issue(user, session.id, refreshToken);
  }

  async refresh(raw: string | undefined, client: { userAgent?: string; ipAddress?: string }) {
    if (!raw) throw new UnauthorizedException('Session expired');
    const previous = await this.db.authSession.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { user: true },
    });
    if (!previous) throw new UnauthorizedException('Session expired');
    if (previous.revokedAt || previous.rotatedAt) {
      await this.db.authSession.updateMany({
        where: { familyId: previous.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session expired');
    }
    if (previous.expiresAt <= new Date() || !previous.user.isActive)
      throw new UnauthorizedException('Session expired');
    const refreshToken = randomBytes(48).toString('base64url');
    const next = await this.db.$transaction(async (tx) => {
      const claimed = await tx.authSession.updateMany({
        where: { id: previous.id, revokedAt: null, rotatedAt: null },
        data: { revokedAt: new Date(), rotatedAt: new Date() },
      });
      if (claimed.count !== 1) throw new UnauthorizedException('Session expired');
      return tx.authSession.create({
        data: this.sessionData(
          previous.userId,
          previous.familyId,
          refreshToken,
          client,
          previous.id,
        ),
      });
    });
    return this.issue(previous.user, next.id, refreshToken);
  }

  async logout(raw: string | undefined) {
    if (raw) {
      const session = await this.db.authSession.findUnique({
        where: { tokenHash: hashToken(raw) },
      });
      if (session)
        await this.db.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
    }
    return { success: true };
  }

  async authenticate(token: string): Promise<Actor> {
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; sid: string; ver: number }>(token);
      const session = await this.db.authSession.findUnique({
        where: { id: claims.sid },
        include: { user: true },
      });
      if (
        !session ||
        session.userId !== claims.sub ||
        session.revokedAt ||
        session.expiresAt <= new Date() ||
        !session.user.isActive ||
        session.user.tokenVersion !== claims.ver
      )
        throw new Error('Inactive session');
      return {
        ...publicUser(session.user),
        tokenVersion: session.user.tokenVersion,
        sessionId: session.id,
      };
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }

  async changePassword(actor: Actor, currentPassword: string, newPassword: string) {
    const user = await this.db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!(await argon2.verify(user.passwordHash, currentPassword)))
      throw new ForbiddenException('Current password is incorrect');
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: actor.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await tx.authSession.updateMany({
        where: { userId: actor.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, actor, 'PASSWORD_CHANGED', 'User', actor.id);
    });
    return { success: true, requiresLogin: true };
  }

  async updateProfile(actor: Actor, input: UpdateProfileDto) {
    try {
      const user = await this.db.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: actor.id },
          data: {
            ...(input.displayName !== undefined ? { displayName: input.displayName.trim() } : {}),
            ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
          },
        });
        await this.audit.record(tx, actor, 'PROFILE_UPDATED', 'User', actor.id);
        return updated;
      });
      return publicUser(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Email is already in use');
      throw error;
    }
  }
}
