import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';

// Only the public shell is server rendered. Private DTOs are fetched per browser session.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
