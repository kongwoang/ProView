'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/providers/session-provider';
import { queryKeys } from '@/lib/api/query-keys';
import type { PageResult } from '@/lib/api/contracts';
import { ErrorState } from '@/components/ui';
import LoadingSpinner from '@/components/upstream/LoadingSpinner';
import Alert from '@/components/upstream/Alert';

export function useResource<T>(resource: string, path: string, enabled = true) {
  const { user, api } = useSession();
  return useQuery({
    queryKey: queryKeys.resource(user?.id ?? '', resource, path),
    queryFn: ({ signal }) => api.get<T>(path, signal),
    enabled: !!user && enabled,
  });
}

export function useAction() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run<T>(
    action: () => Promise<T>,
    success = 'Changes saved.',
  ): Promise<T | undefined> {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await action();
      setMessage(success);
      await queryClient.invalidateQueries({ queryKey: queryKeys.account(user?.id ?? '') });
      return result;
    } catch (cause) {
      setError(cause);
      return undefined;
    } finally {
      setPending(false);
    }
  }
  const feedback = (
    <>
      {error ? <ErrorState error={error} /> : null}
      {message ? <Alert color="success">{message}</Alert> : null}
    </>
  );
  return { pending, error, message, run, feedback };
}

export function QueryState<T>({
  query,
  children,
}: {
  query: { isPending: boolean; error: Error | null; data: T | undefined; refetch: () => unknown };
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <LoadingSpinner />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}

export function itemsOf<T>(data: PageResult<T> | T[] | undefined): T[] {
  return Array.isArray(data) ? data : (data?.items ?? []);
}
export function dateTime(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(value),
      )
    : 'Not set';
}
export function dateInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
export function formText(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim();
}
export function formNumber(form: FormData, key: string) {
  return Number(form.get(key));
}
export function formDate(form: FormData, key: string) {
  const value = formText(form, key);
  return value ? new Date(value).toISOString() : undefined;
}

export function AuthorizedPdf({
  path,
  title,
  download = false,
}: {
  path: string;
  title: string;
  download?: boolean;
}) {
  const { api } = useSession();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setUrl(null);
    setError(null);
    void api
      .file(path, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, path]);
  if (error) return <ErrorState error={error} />;
  if (!url) return <LoadingSpinner text="Loading authorized PDF" />;
  return (
    <div>
      {download && (
        <div className="button-row" style={{ marginBottom: 12 }}>
          <a
            className="button secondary small"
            href={url}
            download={`${title.replace(/[^a-z0-9 -]/gi, '')}.pdf`}
          >
            Download PDF
          </a>
        </div>
      )}
      <iframe className="pdf-viewer" src={url} title={title} />
    </div>
  );
}
