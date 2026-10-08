'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/providers/session-provider';
import { authApi } from '@/lib/api/auth';
import type { PageResult } from '@/lib/api/contracts';
import type { Notification } from '@/lib/api/domain';
import { PageHeader, Section, Field, EmptyState } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import PaginationLinks from '@/components/upstream/PaginationLinks';
import { useResource, QueryState, useAction, dateTime, formText } from './shared';

export function NotificationsPage() {
  const { api } = useSession();
  const action = useAction();
  const [page, setPage] = useState(1);
  const query = useResource<PageResult<Notification> & { unread: number }>(
    'notifications',
    `/notifications?page=${page}&pageSize=20`,
  );
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates from your projects, reviews, and courses."
        actions={
          <button
            className="button secondary"
            disabled={action.pending}
            onClick={() =>
              void action.run(
                () => api.post('/notifications/read-all'),
                'All notifications marked as read.',
              )
            }
          >
            Mark all as read
          </button>
        }
      />
      {action.feedback}
      <Section title="Recent updates">
        <QueryState query={query}>
          {(data) => (
            <>
              {data.items.length ? (
                data.items.map((notification) => (
                  <article className="list-row" key={notification.id}>
                    <span className="list-dot" style={{ opacity: notification.readAt ? 0.2 : 1 }} />
                    <div className="row-content">
                      <h3>
                        {notification.targetUrl?.startsWith('/') &&
                        !notification.targetUrl.startsWith('//') ? (
                          <Link href={notification.targetUrl}>{notification.title}</Link>
                        ) : (
                          notification.title
                        )}
                      </h3>
                      <p className="muted">{notification.body}</p>
                      <p className="small muted">{dateTime(notification.createdAt)}</p>
                    </div>
                    {!notification.readAt && (
                      <button
                        className="text-button"
                        disabled={action.pending}
                        onClick={() =>
                          void action.run(
                            () => api.post(`/notifications/${notification.id}/read`),
                            'Notification marked as read.',
                          )
                        }
                      >
                        Mark read
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <EmptyState
                  title="You’re all caught up"
                  description="New workflow updates will appear here."
                />
              )}
              <PaginationLinks
                currentPage={page}
                itemsPerPage={20}
                totalCount={data.total}
                setCurrentPage={setPage}
              />
            </>
          )}
        </QueryState>
      </Section>
    </>
  );
}

interface AcademicProject {
  id: string;
  title: string;
  offering: { semester: string; course: { code: string; title: string } };
  submissions: { id: string; stage: { name: string }; grade: { overall: number | null } | null }[];
}

export function ProfilePage() {
  const { user, api, reloadUser, logout } = useSession();
  const [historyPage, setHistoryPage] = useState(1);
  const history = useResource<PageResult<AcademicProject>>(
    'profile-history',
    `/archive/own?page=${historyPage}&pageSize=5`,
    user?.role === 'STUDENT',
  );
  const action = useAction();
  if (!user) return null;
  return (
    <>
      <PageHeader
        eyebrow="YOUR ACCOUNT"
        title="Profile & security"
        description="Keep your account details up to date."
      />
      {action.feedback}
      <div className="two-column">
        <Section title="Profile">
          <form
            className="form-stack"
            key={`${user.displayName}:${user.email}`}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                const result = await authApi(api).updateProfile({
                  displayName: formText(f, 'displayName'),
                  email: formText(f, 'email'),
                });
                await reloadUser();
                return result;
              });
            }}
          >
            <Field label="Display name">
              <input name="displayName" required maxLength={120} defaultValue={user.displayName} />
            </Field>
            <Field label="Email">
              <input name="email" type="email" required defaultValue={user.email} />
            </Field>
            <Field label="Username">
              <input value={user.username} disabled readOnly />
            </Field>
            <p className="small muted">
              Role: {user.role.toLowerCase()}. Contact an administrator for role changes.
            </p>
            <SpinnerButton type="submit" loading={action.pending}>
              Save profile
            </SpinnerButton>
          </form>
        </Section>
        <Section title="Change password">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(async () => {
                await authApi(api).changePassword(
                  formText(f, 'currentPassword'),
                  formText(f, 'newPassword'),
                );
                await logout();
                return true;
              }, 'Password changed. Sign in again with your new password.');
            }}
          >
            <Field label="Current password">
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field
              label="New password"
              help="Use at least 12 characters. Changing your password signs out active sessions."
            >
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={256}
                required
              />
            </Field>
            <SpinnerButton type="submit" loading={action.pending}>
              Change password
            </SpinnerButton>
          </form>
        </Section>
      </div>
      {user.role === 'STUDENT' && (
        <Section title="Your academic history">
          <p className="muted">
            Your past project work remains available through historical group membership.
          </p>
          <QueryState query={history}>
            {(data) => (
              <>
                {data.items.length ? (
                  <div className="cards-grid">
                    {data.items.map((project) => (
                      <article className="project-card" key={project.id}>
                        <p className="eyebrow">
                          {project.offering.course.code} · {project.offering.semester}
                        </p>
                        <h3>{project.title}</h3>
                        <p className="muted small">{project.offering.course.title}</p>
                        {project.submissions
                          .filter((submission) => submission.grade)
                          .map((submission) => (
                            <p className="small" key={submission.id}>
                              {submission.stage.name} · Published grade:{' '}
                              <strong>{submission.grade!.overall ?? '—'} / 10</strong>
                            </p>
                          ))}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No completed projects yet"
                    description="Your work from closed course offerings will appear here."
                  />
                )}
                <PaginationLinks
                  currentPage={historyPage}
                  itemsPerPage={5}
                  totalCount={data.total}
                  setCurrentPage={setHistoryPage}
                />
              </>
            )}
          </QueryState>
          <Link className="button secondary" href="/archive">
            View my project archive →
          </Link>
        </Section>
      )}
    </>
  );
}
