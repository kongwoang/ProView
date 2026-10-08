/** Public transport shapes only. Never import database entities into the web app. */
export type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId?: string;
}

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
