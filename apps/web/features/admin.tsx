'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult, SessionUser } from '@/lib/api/contracts';
import type { Course } from '@/lib/api/domain';
import { PageHeader, Section, Field, StatusBadge, EmptyState } from '@/components/ui';
import Table from '@/components/upstream/Table';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import PaginationLinks from '@/components/upstream/PaginationLinks';
import { useResource, QueryState, useAction, dateTime, formText } from './shared';

interface ManagedUser extends SessionUser {
  isActive: boolean;
  createdAt: string;
}
export function AdminUsersPage() {
  const { api } = useSession();
  const action = useAction();
  const [page, setPage] = useState(1);
  const searchFromUrl = useSearchParams().get('search') ?? '';
  const [search, setSearch] = useState(searchFromUrl);
  useEffect(() => {
    setSearch(searchFromUrl);
    setPage(1);
  }, [searchFromUrl]);
  const [edit, setEdit] = useState<ManagedUser | 'new' | null>(null);
  const [reset, setReset] = useState<ManagedUser | null>(null);
  const query = useResource<PageResult<ManagedUser>>(
    'users',
    `/users?page=${page}&pageSize=20&search=${encodeURIComponent(search)}`,
  );
  const current = typeof edit === 'object' ? edit : null;
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="User accounts"
        description="Manage access, roles, and account security."
        actions={
          <button className="button" onClick={() => setEdit('new')}>
            + Create account
          </button>
        }
      />
      {action.feedback}
      {edit && (
        <Section title={current ? 'Edit account' : 'Create account'}>
          <form
            key={current?.id ?? 'new'}
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const data = {
                email: formText(f, 'email'),
                displayName: formText(f, 'displayName'),
                role: formText(f, 'role'),
              };
              void action
                .run(() =>
                  current
                    ? api.patch(`/users/${current.id}`, { ...data, isActive: f.has('isActive') })
                    : api.post('/users', {
                        ...data,
                        username: formText(f, 'username'),
                        password: formText(f, 'password'),
                      }),
                )
                .then((result) => {
                  if (result) setEdit(null);
                });
            }}
          >
            <div className="form-grid">
              <Field label="Full name">
                <input name="displayName" required defaultValue={current?.displayName} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required defaultValue={current?.email} />
              </Field>
              {!current && (
                <>
                  <Field label="Username">
                    <input name="username" required autoComplete="off" />
                  </Field>
                  <Field label="Initial password">
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
              <Field label="Role">
                <select name="role" defaultValue={current?.role ?? 'STUDENT'}>
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Administrator</option>
                </select>
              </Field>
            </div>
            {current && (
              <label className="check-field">
                <input name="isActive" type="checkbox" defaultChecked={current.isActive} />
                Account active
              </label>
            )}
            <div className="form-actions">
              <button className="button secondary" type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <SpinnerButton type="submit" loading={action.pending}>
                Save account
              </SpinnerButton>
            </div>
          </form>
        </Section>
      )}
      {reset && (
        <Section title={`Reset password · ${reset.displayName}`}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (window.confirm('Reset this password and revoke all active sessions?'))
                void action
                  .run(
                    () =>
                      api.post(`/users/${reset.id}/password-reset`, {
                        newPassword: formText(f, 'newPassword'),
                      }),
                    'Password reset; active sessions revoked.',
                  )
                  .then(() => setReset(null));
            }}
          >
            <Field label="New password">
              <input
                name="newPassword"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
              />
            </Field>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={() => setReset(null)}>
                Cancel
              </button>
              <SpinnerButton type="submit" loading={action.pending}>
                Reset password
              </SpinnerButton>
            </div>
          </form>
        </Section>
      )}
      <input
        className="filter-input"
        style={{ marginBottom: 20 }}
        aria-label="Search users"
        placeholder="Search by name, username, or email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Section title="Accounts">
        <QueryState query={query}>
          {(data) => (
            <>
              <Table
                caption="User accounts"
                headings={[
                  { id: 'name', content: 'Account' },
                  { id: 'role', content: 'Role' },
                  { id: 'status', content: 'Status' },
                  { id: 'actions', content: 'Actions' },
                ]}
              >
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.displayName}</strong>
                      <p>
                        {u.email} · {u.username}
                      </p>
                    </td>
                    <td>{u.role}</td>
                    <td>
                      <StatusBadge status={u.isActive ? 'ACTIVE' : 'DEACTIVATED'} />
                    </td>
                    <td>
                      <div className="button-row">
                        <button className="button secondary" onClick={() => setEdit(u)}>
                          Edit
                        </button>
                        <button className="button secondary" onClick={() => setReset(u)}>
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
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

export function AdminCoursesPage() {
  const { api } = useSession();
  const action = useAction();
  const [edit, setEdit] = useState<Course | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const query = useResource<PageResult<Course>>(
    'courses',
    `/courses?pageSize=100&search=${encodeURIComponent(search)}`,
  );
  const current = typeof edit === 'object' ? edit : null;
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Course catalog"
        description="Stable course identities shared across semester offerings."
        actions={
          <>
            <Link className="button secondary" href="/courses">
              Manage offerings
            </Link>
            <button className="button" onClick={() => setEdit('new')}>
              + Add course
            </button>
          </>
        }
      />
      {action.feedback}
      {edit && (
        <Section title={current ? 'Edit course' : 'Add course'}>
          <form
            key={current?.id ?? 'new'}
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const data = {
                code: formText(f, 'code'),
                title: formText(f, 'title'),
                description: formText(f, 'description'),
              };
              void action
                .run(() =>
                  current ? api.patch(`/courses/${current.id}`, data) : api.post('/courses', data),
                )
                .then((result) => {
                  if (result) setEdit(null);
                });
            }}
          >
            <div className="form-grid">
              <Field label="Course code">
                <input name="code" required defaultValue={current?.code} />
              </Field>
              <Field label="Course title">
                <input name="title" required defaultValue={current?.title} />
              </Field>
            </div>
            <Field label="Description">
              <textarea name="description" defaultValue={current?.description} />
            </Field>
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <SpinnerButton type="submit" loading={action.pending}>
                Save course
              </SpinnerButton>
            </div>
          </form>
        </Section>
      )}
      <input
        className="filter-input"
        aria-label="Search catalog"
        placeholder="Search catalog…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 20 }}
      />
      <Section title="Catalog">
        <QueryState query={query}>
          {(data) =>
            data.items.length ? (
              <Table
                caption="Course catalog"
                headings={[
                  { id: 'code', content: 'Code' },
                  { id: 'title', content: 'Course' },
                  { id: 'actions', content: 'Actions' },
                ]}
              >
                {data.items.map((course) => (
                  <tr key={course.id}>
                    <td>{course.code}</td>
                    <td>
                      <strong>{course.title}</strong>
                      <p>{course.description}</p>
                    </td>
                    <td>
                      <button className="button secondary" onClick={() => setEdit(course)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState
                title="No courses in the catalog"
                description="Create a course before instructors create semester offerings."
              />
            )
          }
        </QueryState>
      </Section>
    </>
  );
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  createdAt: string;
  details: Record<string, unknown>;
}
export function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const query = useResource<PageResult<AuditEntry>>(
    'audit',
    `/audit-logs?page=${page}&pageSize=30&action=${encodeURIComponent(action)}&entityType=${encodeURIComponent(entityType)}`,
  );
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Audit trail"
        description="A chronological record of protected workflow changes."
      />
      <div className="filters">
        <input
          className="filter-input"
          aria-label="Filter action"
          placeholder="Action, e.g. GRADE_PUBLISHED"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="filter-input"
          aria-label="Filter entity type"
          placeholder="Entity type, e.g. Submission"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <Section title="Recorded events">
        <QueryState query={query}>
          {(data) => (
            <>
              <Table
                caption="Audit events"
                headings={[
                  { id: 'time', content: 'Time' },
                  { id: 'action', content: 'Action' },
                  { id: 'entity', content: 'Resource' },
                  { id: 'actor', content: 'Actor' },
                ]}
              >
                {data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateTime(entry.createdAt)}</td>
                    <td>{entry.action}</td>
                    <td>
                      {entry.entityType}
                      <p>{entry.entityId}</p>
                    </td>
                    <td className="small">{entry.actorId}</td>
                  </tr>
                ))}
              </Table>
              <PaginationLinks
                currentPage={page}
                itemsPerPage={30}
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
