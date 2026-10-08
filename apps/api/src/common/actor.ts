import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '@prisma/client';

export interface Actor {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  tokenVersion: number;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { actor: Actor };
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().actor,
);

export const publicUser = (
  actor: Pick<Actor, 'id' | 'email' | 'username' | 'displayName' | 'role'>,
) => ({
  id: actor.id,
  email: actor.email,
  username: actor.username,
  displayName: actor.displayName,
  role: actor.role,
});
