'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/providers/session-provider';
import type { Role } from '@/lib/api/contracts';
import LoadingSpinner from './upstream/LoadingSpinner';
import { ErrorState } from './ui';
import { ProViewBrand } from './proview-brand';
import { WorkspaceFooter } from './workspace-footer';

const navigation: { label: string; href: string; roles?: Role[] }[] = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Courses', href: '/courses', roles: ['STUDENT', 'INSTRUCTOR'] },
  { label: 'My projects', href: '/projects', roles: ['STUDENT'] },
  { label: 'Reviews', href: '/reviews', roles: ['STUDENT'] },
  { label: 'Review management', href: '/review-management', roles: ['INSTRUCTOR'] },
  { label: 'Grading', href: '/grading', roles: ['INSTRUCTOR'] },
  { label: 'Similarity checks', href: '/similarity-checks', roles: ['INSTRUCTOR'] },
  { label: 'Archive', href: '/archive', roles: ['STUDENT', 'INSTRUCTOR'] },
  { label: 'Users', href: '/admin/users', roles: ['ADMIN'] },
  { label: 'Course catalog', href: '/admin/courses', roles: ['ADMIN'] },
  { label: 'Audit logs', href: '/admin/audit', roles: ['ADMIN'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [logoutError, setLogoutError] = useState<unknown>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  if (loading || !user)
    return (
      <div className="full-loading">
        <LoadingSpinner text="Opening your workspace" />
      </div>
    );
  const forbidden =
    (pathname.startsWith('/admin/') && user.role !== 'ADMIN') ||
    (['/review-management', '/grading', '/similarity-checks'].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) &&
      user.role === 'STUDENT');
  const current = navigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logout();
      router.replace('/login');
    } catch (error) {
      setLogoutError(error);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="topbar">
          <Link className="brand" href="/dashboard" aria-label="ProView overview">
            <ProViewBrand />
          </Link>
          <form
            className="header-search"
            role="search"
            aria-label={user.role === 'ADMIN' ? 'User account search' : 'Course search'}
            action={user.role === 'ADMIN' ? '/admin/users' : '/courses'}
            method="get"
          >
            <input
              key={`${pathname}:${searchParams.get('search') ?? ''}`}
              name="search"
              type="search"
              aria-label={
                user.role === 'ADMIN' ? 'Search user accounts' : 'Search courses and offerings'
              }
              placeholder={
                user.role === 'ADMIN' ? 'Search user accounts…' : 'Search courses and offerings…'
              }
              defaultValue={searchParams.get('search') ?? ''}
              maxLength={200}
            />
            <button type="submit" aria-label="Search">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 6 6" />
              </svg>
            </button>
          </form>
          <div className="topbar-actions">
            <Link className="notification-link" href="/notifications">
              Notifications
            </Link>
            <Link className="user-menu" href="/profile" aria-label={`Profile: ${user.displayName}`}>
              <strong>{user.displayName}</strong>
            </Link>
            <button
              className="text-button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
          <button
            className="button secondary mobile-menu"
            aria-label="Toggle navigation"
            aria-controls="workspace-navigation"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            Menu <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
          </button>
        </div>
        <div className="navigation-bar">
          <div className="navigation-inner">
            <nav
              id="workspace-navigation"
              className={`workspace-navigation ${expanded ? 'is-open' : ''}`}
              aria-label="Main navigation"
            >
              {navigation
                .filter((item) => !item.roles || item.roles.includes(user.role))
                .map((item) => (
                  <Link
                    key={item.href}
                    className={`nav-link ${current?.href === item.href ? 'active' : ''}`}
                    href={item.href}
                    aria-current={current?.href === item.href ? 'page' : undefined}
                    onClick={() => setExpanded(false)}
                  >
                    {item.label}
                  </Link>
                ))}
            </nav>
            <span className="workspace-label">{user.role.toLowerCase()} workspace</span>
          </div>
        </div>
      </header>
      <div className="main-column">
        <main id="main-content" className="main-content">
          {logoutError ? <ErrorState error={logoutError} /> : null}
          {forbidden ? (
            <section className="panel">
              <h1>This area requires staff access.</h1>
              <p className="muted">Your account does not have access to this workspace.</p>
              <Link className="button" href="/dashboard">
                Return to overview
              </Link>
            </section>
          ) : (
            children
          )}
        </main>
        <WorkspaceFooter authenticated />
      </div>
    </div>
  );
}
