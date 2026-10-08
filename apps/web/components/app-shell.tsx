'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '@/providers/session-provider';
import type { Role } from '@/lib/api/contracts';
import LoadingSpinner from './upstream/LoadingSpinner';
import { ErrorState } from './ui';

const navigation: { label: string; href: string; icon: string; roles?: Role[] }[] = [
  { label: 'Overview', href: '/dashboard', icon: '◫' },
  { label: 'Courses', href: '/courses', icon: '▤', roles: ['STUDENT', 'INSTRUCTOR'] },
  { label: 'My projects', href: '/projects', icon: '▧', roles: ['STUDENT'] },
  { label: 'Reviews', href: '/reviews', icon: '✎', roles: ['STUDENT'] },
  { label: 'Review management', href: '/review-management', icon: '✎', roles: ['INSTRUCTOR'] },
  { label: 'Grading', href: '/grading', icon: '✓', roles: ['INSTRUCTOR'] },
  { label: 'Similarity checks', href: '/similarity-checks', icon: '≋', roles: ['INSTRUCTOR'] },
  { label: 'Archive', href: '/archive', icon: '▱', roles: ['STUDENT', 'INSTRUCTOR'] },
  { label: 'Users', href: '/admin/users', icon: '♧', roles: ['ADMIN'] },
  { label: 'Course catalog', href: '/admin/courses', icon: '▤', roles: ['ADMIN'] },
  { label: 'Audit logs', href: '/admin/audit', icon: '≡', roles: ['ADMIN'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useSession();
  const pathname = usePathname();
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
      <aside className={`sidebar ${expanded ? 'is-open' : ''}`}>
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">P</span>
          <span>
            Pro<span className="brand-light">View</span>
            <small>PROJECT REVIEW WORKSPACE</small>
          </span>
        </Link>
        <div className="workspace-label">{user.role.toLowerCase()} workspace</div>
        <nav aria-label="Main navigation">
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
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <strong>Better projects, together.</strong>
            <p>Thoughtful feedback. Clear progress. A record of your work.</p>
          </div>
          <Link className="source-link" href="/source">
            Source &amp; acknowledgments ↗
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              ☰
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span> <strong>{current?.label || 'Project workspace'}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <Link className="notification-link" href="/notifications" aria-label="Notifications">
              ♧
            </Link>
            <Link className="user-menu" href="/profile">
              <span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{user.role.toLowerCase()}</small>
              </span>
            </Link>
            <button
              className="text-button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>
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
        <footer className="workspace-footer">
          <span>ProView · A place for ideas to grow</span>
          <Link href="/source">Open source</Link>
        </footer>
      </div>
    </div>
  );
}
