import { Suspense, type ReactNode } from 'react';
import LoadingSpinner from '@/components/upstream/LoadingSpinner';
import { AppShell } from '@/components/app-shell';

// Only the public shell is server rendered. Private DTOs are fetched per browser session.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="full-loading">
          <LoadingSpinner text="Opening your workspace" />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
