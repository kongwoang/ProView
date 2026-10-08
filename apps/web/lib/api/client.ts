'use client';

import type { ApiErrorEnvelope, AuthSession } from './contracts';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly details: ApiErrorEnvelope,
  ) {
    super(details.message);
    this.name = 'ApiError';
  }
}

type SessionListener = (session: AuthSession | null) => void;

/** Each browser provider owns one client. No server singleton or persisted token. */
export class ApiClient {
  private accessToken: string | null = null;
  private actorKey: string | null = null;
  private refreshRequest: Promise<AuthSession> | null = null;
  private epoch = 0;
  private listener: SessionListener = () => {};

  constructor(private readonly transport: typeof fetch = (input, init) => fetch(input, init)) {}

  onSessionChange(listener: SessionListener) {
    this.listener = listener;
  }

  setSession(session: AuthSession | null) {
    this.epoch += 1;
    this.accessToken = session?.accessToken ?? null;
    this.actorKey = session ? `${session.user.id}:${session.user.role}` : null;
    this.listener(session);
  }

  private async decodeError(response: Response): Promise<ApiError> {
    const body: Partial<ApiErrorEnvelope> = await response.json().catch(() => ({}));
    return new ApiError(response.status, {
      code: body.code || 'REQUEST_FAILED',
      message: body.message || 'The request could not be completed. Please try again.',
      fieldErrors: body.fieldErrors,
      requestId: body.requestId,
    });
  }

  async refresh(): Promise<AuthSession> {
    if (this.refreshRequest) return this.refreshRequest;
    const startedAt = this.epoch;
    this.refreshRequest = (async () => {
      const response = await this.transport('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'ProView' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: '{}',
      });
      if (!response.ok) throw await this.decodeError(response);
      const session = (await response.json()) as AuthSession;
      if (startedAt !== this.epoch)
        throw new ApiError(401, {
          code: 'SESSION_CHANGED',
          message: 'Your session has changed. Please sign in again.',
        });
      const actorKey = `${session.user.id}:${session.user.role}`;
      if (this.actorKey !== null && this.actorKey !== actorKey) {
        this.setSession(session);
        throw new ApiError(401, {
          code: 'SESSION_CHANGED',
          message: 'Your account has changed. Please reload this page before continuing.',
        });
      }
      this.actorKey = actorKey;
      this.accessToken = session.accessToken;
      this.listener(session);
      return session;
    })()
      .catch((error: unknown) => {
        if (startedAt === this.epoch) this.setSession(null);
        throw error;
      })
      .finally(() => {
        this.refreshRequest = null;
      });
    return this.refreshRequest;
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new Error('Use a local API resource path.');
    const startedAt = this.epoch;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('X-Requested-With', 'ProView');
    if (init.body && !(init.body instanceof FormData))
      headers.set('Content-Type', 'application/json');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await this.transport(`/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (startedAt !== this.epoch)
      throw new ApiError(401, {
        code: 'SESSION_CHANGED',
        message: 'Your session has changed. Please reload this page.',
      });
    if (response.status === 401 && retry && !path.startsWith('/auth/')) {
      await this.refresh();
      return this.request<T>(path, init, false);
    }
    if (!response.ok) throw await this.decodeError(response);
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  get<T>(path: string, signal?: AbortSignal) {
    return this.request<T>(path, { signal });
  }
  post<T>(path: string, body: unknown = {}) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }
  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
  }
  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }

  /** Native upload progress; authorization and refresh follow the same session rules. */
  async upload<T>(
    path: string,
    body: FormData,
    onProgress: (percent: number) => void,
    retry = true,
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new Error('Use a local API resource path.');
    const startedAt = this.epoch;
    try {
      return await new Promise<T>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('POST', `/api/v1${path}`);
        request.withCredentials = true;
        request.setRequestHeader('X-Requested-With', 'ProView');
        if (this.accessToken)
          request.setRequestHeader('Authorization', `Bearer ${this.accessToken}`);
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        request.onerror = () =>
          reject(new Error('Upload failed. Check your connection and try again.'));
        request.onload = () => {
          if (startedAt !== this.epoch)
            return reject(
              new ApiError(401, { code: 'SESSION_CHANGED', message: 'Your session has changed.' }),
            );
          let data: unknown;
          try {
            data = JSON.parse(request.responseText);
          } catch {
            return reject(new Error('Upload returned an invalid response.'));
          }
          if (request.status >= 200 && request.status < 300) resolve(data as T);
          else reject(new ApiError(request.status, data as ApiErrorEnvelope));
        };
        request.send(body);
      });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        error.details.code !== 'SESSION_CHANGED' &&
        retry
      ) {
        await this.refresh();
        return this.upload<T>(path, body, onProgress, false);
      }
      throw error;
    }
  }

  async file(path: string, signal?: AbortSignal, retry = true): Promise<Blob> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new Error('Use a local API resource path.');
    const startedAt = this.epoch;
    const response = await this.transport(`/api/v1${path}`, {
      signal,
      headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (startedAt !== this.epoch)
      throw new ApiError(401, { code: 'SESSION_CHANGED', message: 'Your session has changed.' });
    if (response.status === 401 && retry) {
      await this.refresh();
      return this.file(path, signal, false);
    }
    if (!response.ok) throw await this.decodeError(response);
    return response.blob();
  }
}
