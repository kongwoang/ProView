/** Public transport shapes only. Never import database entities into the web app. */
import type { components } from './generated';

export type SessionUser = components['schemas']['SessionUserDto'];
export type Role = SessionUser['role'];
export type AuthSession = components['schemas']['AuthSessionDto'];
// Locally synthesized network/session errors do not have a server request id.
export type ApiErrorEnvelope = Omit<components['schemas']['ApiErrorDto'], 'requestId'> & {
  requestId?: string;
};

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Anonymous variants have no real reviewer identifier or profile link. */
export type ReviewerIdentity =
  { kind: 'anonymous'; label: string } | { kind: 'named'; displayName: string; groupName?: string };

export type AllowedAction = string;
