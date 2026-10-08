'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiClient, ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/api/auth';
import type { SessionUser } from '@/lib/api/contracts';

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  api: ApiClient;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            retry: (count, error) =>
              !(error instanceof ApiError && error.status < 500) && count < 1,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [api] = useState(() => new ApiClient());
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let previousId: string | null = null;
    api.onSessionChange((session) => {
      if (!active) return;
      const nextId = session?.user.id ?? null;
      if (nextId !== previousId || !session) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      previousId = nextId;
      setUser(session?.user ?? null);
    });
    void api
      .refresh()
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('proview.session') : null;
    if (channel)
      channel.onmessage = () => {
        api.setSession(null);
      };
    return () => {
      active = false;
      channel?.close();
    };
  }, [api, queryClient]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      await queryClient.cancelQueries();
      queryClient.clear();
      const session = await authApi(api).login(identifier, password);
      api.setSession(session);
    },
    [api, queryClient],
  );

  const logout = useCallback(async () => {
    // Server revocation must succeed before showing a completed logout.
    await authApi(api).logout();
    api.setSession(null);
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('proview.session') : null;
    channel?.postMessage('logout');
    channel?.close();
  }, [api]);

  const reloadUser = useCallback(async () => {
    setUser(await authApi(api).me());
  }, [api]);

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={{ user, loading, api, login, logout, reloadUser }}>
        {children}
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession requires SessionProvider.');
  return session;
}
