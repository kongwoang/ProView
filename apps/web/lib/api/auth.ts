import type { ApiClient } from './client';
import type { AuthSession, SessionUser } from './contracts';

export const authApi = (client: ApiClient) => ({
  login: (identifier: string, password: string) =>
    client.post<AuthSession>('/auth/login', { identifier, password }),
  logout: () => client.post<void>('/auth/logout'),
  me: (signal?: AbortSignal) => client.get<SessionUser>('/me', signal),
  updateProfile: (data: { displayName?: string; email?: string }) =>
    client.patch<SessionUser>('/me', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    client.post<void>('/me/password', { currentPassword, newPassword }),
});
