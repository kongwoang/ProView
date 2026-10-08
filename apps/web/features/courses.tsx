'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult } from '@/lib/api/contracts';
import type { Course, Offering, Member, Group, Stage, RubricRevision } from '@/lib/api/domain';
import { PageHeader, Section, Field, EmptyState, StatusBadge } from '@/components/ui';
import Table from '@/components/upstream/Table';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import PaginationLinks from '@/components/upstream/PaginationLinks';
import {
  useResource,
  useAction,
  QueryState,
  itemsOf,
  dateTime,
  dateInput,
  formText,
  formNumber,
  formDate,
} from './shared';

export function CoursesPage() {
  const { user, api } = useSession();
  const [page, setPage] = useState(1);
  const searchFromUrl = useSearchParams().get('search') ?? '';
  const [search, setSearch] = useState(searchFromUrl);
  useEffect(() => {
    setSearch(searchFromUrl);
    setPage(1);
  }, [searchFromUrl]);
  const [create, setCreate] = useState(false);
  const [copySearch, setCopySearch] = useState('');
  const copySources = useResource<PageResult<Offering>>(
    'copy-sources',
    `/offerings?pageSize=100&search=${encodeURIComponent(copySearch)}`,
    create,
  );
  const offerings = useResource<PageResult<Offering>>(
    'offerings',
    `/offerings?page=${page}&pageSize=12&search=${encodeURIComponent(search)}`,
  );
  const catalog = useResource<PageResult<Course>>('courses', '/courses?pageSize=100');
  const instructors = useResource<PageResult<import('@/lib/api/contracts').SessionUser>>(
    'instructors',
    '/users?pageSize=100',
    user?.role === 'ADMIN',
  );
  const action = useAction();
  const staff = user?.role !== 'STUDENT';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await action.run(
      () =>
        api.post<Offering>('/offerings', {
          ...(user?.role === 'ADMIN'
            ? { instructorIds: form.getAll('instructorIds').map(String) }
            : {}),
          courseId: formText(form, 'courseId'),
          semester: formText(form, 'semester'),
          academicYear: formText(form, 'academicYear'),
          termStartAt: formDate(form, 'termStartAt', formText(form, 'timezone')),
          termEndAt: formDate(form, 'termEndAt', formText(form, 'timezone')),
          timezone: formText(form, 'timezone'),
          anonymityMode: formText(form, 'anonymityMode'),
          ...(formText(form, 'copyFromOfferingId')
            ? { copyFromOfferingId: formText(form, 'copyFromOfferingId') }
            : {}),
        }),
      'Course offering created.',
    );
    if (result) setCreate(false);
  }
  return (
    <>
      <PageHeader
        title="Your courses"
        description="Course spaces, project teams, and milestones in one place."
        actions={
          staff ? (
            <button className="button" onClick={() => setCreate(!create)}>
              + New offering
            </button>
          ) : undefined
        }
      />
      {action.feedback}
      {create && (
        <Section title="Create a course offering">
          <form className="form-stack" onSubmit={(event) => void submit(event)}>
            <div className="form-grid">
              <Field label="Course">
                <select name="courseId" required>
                  <option value="">Choose from catalog</option>
                  {itemsOf(catalog.data).map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.code} — {course.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Semester">
                <input name="semester" required placeholder="Fall" />
              </Field>
              <Field label="Academic year">
                <input name="academicYear" required placeholder="2026–2027" />
              </Field>
              <Field label="Timezone">
                <input name="timezone" defaultValue="Asia/Ho_Chi_Minh" required />
              </Field>
              <Field label="Term starts" help="Times use the offering timezone entered above.">
                <input name="termStartAt" type="datetime-local" required />
              </Field>
              <Field label="Term ends" help="Times use the offering timezone entered above.">
                <input name="termEndAt" type="datetime-local" required />
              </Field>
              <Field label="Reviewer identities to authors">
                <select name="anonymityMode">
                  <option value="ANONYMOUS_TO_AUTHORS">Anonymous</option>
                  <option value="NAMED">Named</option>
                </select>
              </Field>
              <Field
                label="Find source offering"
                help="Search by course or semester to copy an older offering."
              >
                <input
                  value={copySearch}
                  onChange={(event) => setCopySearch(event.target.value)}
                  placeholder="Course or semester…"
                />
              </Field>
              <QueryState query={copySources}>
                {(sources) => (
                  <Field label="Copy configuration from">
                    <select name="copyFromOfferingId">
                      <option value="">Start with default stages</option>
                      {sources.items.map((o) => (
                        <option value={o.id} key={o.id}>
                          {o.course.code} · {o.semester} {o.academicYear}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </QueryState>
            </div>
            {user?.role === 'ADMIN' && (
              <fieldset>
                <legend>Assigned instructors</legend>
                {instructors.data?.items
                  .filter((u) => u.role === 'INSTRUCTOR')
                  .map((u) => (
                    <label className="check-field" key={u.id}>
                      <input type="checkbox" name="instructorIds" value={u.id} />
                      {u.displayName}
                    </label>
                  ))}
              </fieldset>
            )}
            <div className="form-actions">
              <SpinnerButton type="submit" loading={action.pending}>
                Create offering
              </SpinnerButton>
            </div>
          </form>
        </Section>
      )}
      <div className="filters">
        <input
          className="filter-input"
          aria-label="Search courses"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <QueryState query={offerings}>
        {(data) => (
          <>
            {data.items.length ? (
              <div className="cards-grid">
                {data.items.map((offering) => (
                  <article className="project-card" key={offering.id}>
                    <h3>
                      <Link href={`/offerings/${offering.id}`}>{offering.course.title}</Link>
                    </h3>
                    <div className="section-heading">
                      <span className="eyebrow">{offering.course.code}</span>
                      <StatusBadge status={offering.status} />
                    </div>
                    <p className="meta">
                      {offering.semester} · {offering.academicYear}
                    </p>
                    <p className="muted small">
                      {offering.course.description || 'Course projects and peer review.'}
                    </p>
                    <footer>
                      <span className="small muted">{offering.timezone}</span>
                      <Link className="link-arrow" href={`/offerings/${offering.id}`}>
                        Open course →
                      </Link>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No courses yet"
                description="Your course offerings will appear here when you are enrolled."
              />
            )}
            <PaginationLinks
              currentPage={page}
              itemsPerPage={12}
              totalCount={data.total}
              setCurrentPage={setPage}
            />
          </>
        )}
      </QueryState>
    </>
  );
}

export function OfferingPage({ id }: { id: string }) {
  const { user, api } = useSession();
  const query = useResource<Offering>('offering', `/offerings/${id}`);
  const [tab, setTab] = useState('Overview');
  const action = useAction();
  const staff = user?.role !== 'STUDENT';
  return (
    <QueryState query={query}>
      {(offering) => (
        <>
          <PageHeader
            eyebrow={`${offering.course.code} · ${offering.semester} ${offering.academicYear}`}
            title={offering.course.title}
            description={`Course timezone: ${offering.timezone}`}
            actions={<StatusBadge status={offering.status} />}
          />
          <div className="tabs" role="tablist">
            {[
              'Overview',
              ...(staff ? ['Roster', 'Groups', 'Stages & rubrics', 'Settings'] : ['Groups']),
            ].map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                className={`tab ${tab === name ? 'active' : ''}`}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {action.feedback}
          {tab === 'Overview' && (
            <div className="two-column">
              <Section title="Course milestones">
                {offering.stages.map((stage) => (
                  <div className="timeline-item" key={stage.id}>
                    <h3>{stage.name}</h3>
                    <p className="muted">
                      Submissions: {dateTime(stage.openAt, offering.timezone)} →{' '}
                      {dateTime(stage.submissionDeadline, offering.timezone)}
                    </p>
                    {stage.allowReviews && (
                      <p className="muted">
                        Review deadline: {dateTime(stage.reviewDeadline, offering.timezone)}
                      </p>
                    )}
                    {stage.allowRebuttal && (
                      <p className="muted">
                        Rebuttal deadline: {dateTime(stage.rebuttalDeadline, offering.timezone)}
                      </p>
                    )}
                    <span className="status-badge">
                      {stage.requireSimilarityCheck ? 'Similarity required' : 'Peer review'}
                    </span>
                  </div>
                ))}
              </Section>
              <Section title="About this course">
                <p className="muted">
                  {offering.course.description ||
                    'Work with your team to submit, review, and improve your course projects.'}
                </p>
                <div className="inline-info">
                  Reviewer identities are{' '}
                  {offering.anonymityMode === 'NAMED'
                    ? 'visible to authors'
                    : 'anonymous to authors'}
                  . Instructors can always see reviewer identities.
                </div>
                <p className="small muted">
                  Term: {dateTime(offering.termStartAt, offering.timezone)} —{' '}
                  {dateTime(offering.termEndAt, offering.timezone)}
                </p>
                <Link className="button secondary" href="/projects">
                  View my projects →
                </Link>
              </Section>
            </div>
          )}
          {tab === 'Roster' && staff && <Roster offeringId={id} />}
          {tab === 'Groups' && <Groups offeringId={id} staff={staff} />}
          {tab === 'Stages & rubrics' && staff && <StageSettings offering={offering} />}
          {tab === 'Settings' && staff && (
            <Section title="Offering settings">
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  if (
                    window.confirm(
                      'Apply these course settings? Changing the status may close student workflows.',
                    )
                  )
                    void action.run(() =>
                      api.patch(`/offerings/${id}`, {
                        revision: offering.revision,
                        status: formText(form, 'status'),
                        anonymityMode: formText(form, 'anonymityMode'),
                      }),
                    );
                }}
              >
                <Field label="Status">
                  <select name="status" defaultValue={offering.status}>
                    {['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Reviewer identities">
                  <select name="anonymityMode" defaultValue={offering.anonymityMode}>
                    <option value="NAMED">Named</option>
                    <option value="ANONYMOUS_TO_AUTHORS">Anonymous to authors</option>
                  </select>
                </Field>
                <SpinnerButton type="submit" loading={action.pending}>
                  Save settings
                </SpinnerButton>
              </form>
            </Section>
          )}
        </>
      )}
    </QueryState>
  );
}

function Roster({ offeringId }: { offeringId: string }) {
  const { api } = useSession();
  const action = useAction();
  const roster = useResource<PageResult<Member> | Member[]>(
    'roster',
    `/offerings/${offeringId}/roster`,
  );
  const [preview, setPreview] = useState<{
    previewId: string;
    rows: { row: number; email: string; action: string; error?: string }[];
    summary: { total: number; add: number; existing: number; errors: number };
  } | null>(null);
  return (
    <>
      {action.feedback}
      <div className="two-column">
        <Section title="Add a member">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action.run(() =>
                api.post(`/offerings/${offeringId}/roster`, {
                  email: formText(f, 'email'),
                  role: formText(f, 'role'),
                }),
              );
            }}
          >
            <Field label="Account email">
              <input name="email" type="email" required />
            </Field>
            <Field label="Course role">
              <select name="role">
                <option value="STUDENT">Student</option>
                <option value="INSTRUCTOR">Instructor</option>
              </select>
            </Field>
            <SpinnerButton loading={action.pending} type="submit">
              Add member
            </SpinnerButton>
          </form>
        </Section>
        <Section title="Import a roster">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action
                .run(
                  () =>
                    api.post<NonNullable<typeof preview>>(
                      `/offerings/${offeringId}/roster/preview`,
                      { csv: formText(f, 'csv') },
                    ),
                  'CSV validated. Review the preview before importing.',
                )
                .then((result) => {
                  if (result) setPreview(result);
                });
            }}
          >
            <Field
              label="CSV content"
              help="Use an email column and optional role column. Accounts must already exist."
            >
              <textarea
                name="csv"
                required
                placeholder={'email,role\nstudent@example.edu,STUDENT'}
              />
            </Field>
            <SpinnerButton type="submit" loading={action.pending}>
              Validate CSV
            </SpinnerButton>
          </form>
          {preview && (
            <div className="inline-info">
              {preview.rows?.map((row, i) => (
                <p key={i}>
                  Row {row.row}: {row.email} · {row.action}
                  {row.error ? ` — ${row.error}` : ''}
                </p>
              ))}
              {preview.summary.errors === 0 && (
                <button
                  className="button"
                  disabled={action.pending}
                  onClick={() => {
                    if (window.confirm('Import this validated roster?'))
                      void action
                        .run(
                          () =>
                            api.post(`/offerings/${offeringId}/roster/import`, {
                              previewId: preview.previewId,
                            }),
                          'Roster imported.',
                        )
                        .then(() => setPreview(null));
                  }}
                >
                  Commit import
                </button>
              )}
            </div>
          )}
        </Section>
      </div>
      <Section title="Course members">
        <QueryState query={roster}>
          {(data) => (
            <Table
              caption="Course roster"
              headings={[
                { id: 'name', content: 'Member' },
                { id: 'role', content: 'Role' },
                { id: 'state', content: 'Membership' },
                { id: 'actions', content: 'Actions' },
              ]}
            >
              {itemsOf(data).map((member) => (
                <tr key={member.id}>
                  <td>
                    <strong>{member.user.displayName}</strong>
                    <p>{member.user.email}</p>
                  </td>
                  <td>{member.role}</td>
                  <td>{member.endedAt ? 'Ended' : 'Active'}</td>
                  <td>
                    {!member.endedAt && (
                      <button
                        className="button secondary"
                        disabled={action.pending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `End ${member.user.displayName}’s membership? Historical work is preserved.`,
                            )
                          )
                            void action.run(
                              () => api.delete(`/offerings/${offeringId}/roster/${member.id}`),
                              'Membership ended.',
                            );
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </QueryState>
      </Section>
    </>
  );
}

function Groups({ offeringId, staff }: { offeringId: string; staff: boolean }) {
  const { api } = useSession();
  const action = useAction();
  const groups = useResource<PageResult<Group> | Group[]>(
    'groups',
    `/offerings/${offeringId}/groups`,
  );
  const roster = useResource<PageResult<Member> | Member[]>(
    'roster',
    `/offerings/${offeringId}/roster`,
    staff,
  );
  const [edit, setEdit] = useState<Group | 'new' | null>(null);
  const selected = typeof edit === 'object' ? edit : null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: formText(f, 'name'),
      title: formText(f, 'title'),
      description: formText(f, 'description'),
      memberIds: f.getAll('memberIds').map(String),
    };
    const result = await action.run(
      () =>
        selected
          ? api.patch(`/groups/${selected.id}`, { ...data, revision: selected.revision })
          : api.post(`/offerings/${offeringId}/groups`, data),
      'Group saved.',
    );
    if (result) setEdit(null);
  }
  return (
    <>
      {action.feedback}
      <Section
        title="Project groups"
        actions={
          staff ? (
            <button className="button small" onClick={() => setEdit('new')}>
              + Create group
            </button>
          ) : undefined
        }
      >
        {edit && (
          <form
            key={selected?.id ?? 'new'}
            className="form-stack panel"
            onSubmit={(e) => void submit(e)}
          >
            <div className="form-grid">
              <Field label="Group name">
                <input name="name" required defaultValue={selected?.name} />
              </Field>
              <Field label="Project title">
                <input name="title" required defaultValue={selected?.project?.title} />
              </Field>
            </div>
            <Field label="Project description">
              <textarea name="description" defaultValue={selected?.project?.description} />
            </Field>
            <fieldset>
              <legend>Team members</legend>
              {itemsOf(roster.data)
                .filter((m) => m.role === 'STUDENT' && !m.endedAt)
                .map((m) => (
                  <label className="check-field" key={m.id}>
                    <input
                      type="checkbox"
                      name="memberIds"
                      value={m.userId}
                      defaultChecked={selected?.members.some(
                        (gm) => gm.userId === m.userId && !gm.leftAt,
                      )}
                    />
                    {m.user.displayName} ({m.user.email})
                  </label>
                ))}
            </fieldset>
            {selected?.membershipLockedAt && (
              <p className="muted small">
                Membership has historical submissions. Changes may require an explicit correction
                supported by the backend.
              </p>
            )}
            <div className="form-actions">
              <button className="button secondary" type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <SpinnerButton type="submit" loading={action.pending}>
                Save group
              </SpinnerButton>
            </div>
          </form>
        )}
        <QueryState query={groups}>
          {(data) =>
            itemsOf(data).length ? (
              <div className="cards-grid">
                {itemsOf(data).map((group) => (
                  <article className="project-card" key={group.id}>
                    <div className="section-heading">
                      <h3>{group.name}</h3>
                      {staff && (
                        <button className="text-button" onClick={() => setEdit(group)}>
                          Edit
                        </button>
                      )}
                    </div>
                    {group.project && (
                      <h3>
                        <Link href={`/projects/${group.project.id}`}>{group.project.title}</Link>
                      </h3>
                    )}
                    <p className="muted small">
                      {group.members
                        .filter((m) => !m.leftAt)
                        .map(
                          (m) =>
                            m.user?.displayName ?? m.membership?.user.displayName ?? 'Team member',
                        )
                        .join(', ')}
                    </p>
                    {group.membershipLockedAt && (
                      <span className="status-badge">Membership preserved</span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No groups yet"
                description="Create project groups and assign course members to start the workflow."
              />
            )
          }
        </QueryState>
      </Section>
    </>
  );
}

function StageSettings({ offering }: { offering: Offering }) {
  const { api } = useSession();
  const action = useAction();
  const [edit, setEdit] = useState<Stage | null>(null);
  const [rubricStage, setRubricStage] = useState<Stage | null>(null);
  return (
    <>
      {action.feedback}
      <Section
        title="Submission stages"
        actions={
          <button
            className="button small"
            onClick={() =>
              setEdit({
                ...offering.stages[0],
                id: 'new',
                name: '',
                sequence: offering.stages.length + 1,
                revision: 0,
              })
            }
          >
            + Add stage
          </button>
        }
      >
        {offering.stages.map((stage) => (
          <div className="list-row" key={stage.id}>
            <div className="row-content">
              <h3>
                {stage.sequence}. {stage.name}
              </h3>
              <p className="muted">
                Submission deadline {dateTime(stage.submissionDeadline, offering.timezone)} ·{' '}
                {stage.rubricRevision.criteria.length} rubric criteria
              </p>
              <p className="muted">
                Reviews {stage.allowReviews ? 'enabled' : 'disabled'} · Rebuttal{' '}
                {stage.allowRebuttal ? 'enabled' : 'disabled'} · Similarity{' '}
                {stage.requireSimilarityCheck ? 'required' : 'optional'}
              </p>
            </div>
            <div className="button-row">
              <button className="button secondary small" onClick={() => setEdit(stage)}>
                Edit stage
              </button>
              <button className="button secondary small" onClick={() => setRubricStage(stage)}>
                Rubric
              </button>
            </div>
          </div>
        ))}
      </Section>
      {edit && (
        <Section title={`Configure ${edit.name}`}>
          <p className="muted small">Enter all times in {offering.timezone}.</p>
          <form
            className="form-stack"
            key={edit.id}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void action
                .run(() =>
                  edit.id === 'new'
                    ? api.post(`/offerings/${offering.id}/stages`, {
                        ...stagePayload(edit),
                        name: formText(f, 'name'),
                        openAt: formDate(f, 'openAt', offering.timezone),
                        submissionDeadline: formDate(f, 'submissionDeadline', offering.timezone),
                        reviewDeadline: formDate(f, 'reviewDeadline', offering.timezone),
                        rebuttalDeadline: formDate(f, 'rebuttalDeadline', offering.timezone),
                        peerReviewCount: formNumber(f, 'peerReviewCount'),
                        allowReviews: f.has('allowReviews'),
                        allowRebuttal: f.has('allowRebuttal'),
                        requireSimilarityCheck: f.has('requireSimilarityCheck'),
                      })
                    : api.patch(`/stages/${edit.id}`, {
                        ...stagePayload(edit),
                        revision: edit.revision,
                        name: formText(f, 'name'),
                        openAt: formDate(f, 'openAt', offering.timezone),
                        submissionDeadline: formDate(f, 'submissionDeadline', offering.timezone),
                        reviewDeadline: formDate(f, 'reviewDeadline', offering.timezone),
                        rebuttalDeadline: formDate(f, 'rebuttalDeadline', offering.timezone),
                        peerReviewCount: formNumber(f, 'peerReviewCount'),
                        allowReviews: f.has('allowReviews'),
                        allowRebuttal: f.has('allowRebuttal'),
                        requireSimilarityCheck: f.has('requireSimilarityCheck'),
                      }),
                )
                .then((result) => {
                  if (result) setEdit(null);
                });
            }}
          >
            <div className="form-grid">
              <Field label="Stage name">
                <input name="name" required defaultValue={edit.name} />
              </Field>
              <Field label="Peer reviews per submission">
                <input
                  name="peerReviewCount"
                  type="number"
                  min="0"
                  max="20"
                  defaultValue={edit.peerReviewCount}
                />
              </Field>
              {(
                ['openAt', 'submissionDeadline', 'reviewDeadline', 'rebuttalDeadline'] as const
              ).map((field) => (
                <Field
                  key={field}
                  label={
                    {
                      openAt: 'Opens at',
                      submissionDeadline: 'Submission deadline',
                      reviewDeadline: 'Review deadline',
                      rebuttalDeadline: 'Rebuttal deadline',
                    }[field]
                  }
                >
                  <input
                    type="datetime-local"
                    name={field}
                    defaultValue={dateInput(edit[field], offering.timezone)}
                    required={field === 'openAt' || field === 'submissionDeadline'}
                  />
                </Field>
              ))}
            </div>
            {(['allowReviews', 'allowRebuttal', 'requireSimilarityCheck'] as const).map((field) => (
              <label className="check-field" key={field}>
                <input type="checkbox" name={field} defaultChecked={edit[field]} />
                {
                  {
                    allowReviews: 'Enable reviews',
                    allowRebuttal: 'Enable rebuttal',
                    requireSimilarityCheck:
                      'Require manual similarity check before grade publication',
                  }[field]
                }
              </label>
            ))}
            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <SpinnerButton type="submit" loading={action.pending}>
                Save stage
              </SpinnerButton>
            </div>
          </form>
        </Section>
      )}
      {rubricStage && (
        <RubricEditor
          key={rubricStage.id}
          stage={rubricStage}
          offeringId={offering.id}
          close={() => setRubricStage(null)}
        />
      )}
    </>
  );
}

function RubricEditor({
  stage,
  offeringId,
  close,
}: {
  stage: Stage;
  offeringId: string;
  close: () => void;
}) {
  const { api } = useSession();
  const action = useAction();
  const [criteria, setCriteria] = useState(
    stage.rubricRevision.criteria.map((c) => ({
      title: c.title,
      description: c.description,
      weight: Number(c.weight),
      scoreMin: Number(c.scoreMin),
      scoreMax: Number(c.scoreMax),
      required: c.required,
      requireComment: c.requireComment,
    })),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await action.run(async () => {
      const result = await api.post<{ revisions: RubricRevision[] }>(
        `/offerings/${offeringId}/rubrics`,
        {
          name: `${stage.name} rubric`,
          criteria,
          requireOverallComment: form.has('requireOverallComment'),
          requireRecommendation: form.has('requireRecommendation'),
          recommendationOptions: formText(form, 'recommendationOptions')
            .split('\n')
            .map((value) => value.trim())
            .filter(Boolean),
        },
      );
      const revision = result.revisions[0];
      await api.patch(`/stages/${stage.id}`, {
        ...stagePayload(stage),
        revision: stage.revision,
        rubricRevisionId: revision.id,
      });
      close();
      return result;
    }, 'A new immutable rubric revision is now assigned to the stage.');
  }
  return (
    <Section title={`${stage.name} · rubric`}>
      <p className="muted small">
        Saving creates a new rubric. Existing assignments and grades keep their original criteria.
      </p>
      {action.feedback}
      <form className="form-stack" onSubmit={(e) => void submit(e)}>
        <label className="check-field">
          <input
            type="checkbox"
            name="requireOverallComment"
            defaultChecked={stage.rubricRevision.requireOverallComment}
          />
          Require an overall review comment
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            name="requireRecommendation"
            defaultChecked={stage.rubricRevision.requireRecommendation}
          />
          Require a recommendation
        </label>
        <Field label="Recommendation choices (one per line)">
          <textarea
            name="recommendationOptions"
            defaultValue={stage.rubricRevision.recommendationOptions.join('\n')}
          />
        </Field>
        {criteria.map((c, index) => (
          <div className="panel" key={index}>
            <div className="form-grid">
              <Field label="Criterion title">
                <input
                  required
                  value={c.title}
                  onChange={(e) =>
                    setCriteria(
                      criteria.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
              </Field>
              {(['weight', 'scoreMin', 'scoreMax'] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    { weight: 'Weight', scoreMin: 'Minimum score', scoreMax: 'Maximum score' }[key]
                  }
                >
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={c[key]}
                    onChange={(e) =>
                      setCriteria(
                        criteria.map((x, i) =>
                          i === index ? { ...x, [key]: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Description">
              <textarea
                value={c.description}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, i) =>
                      i === index ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <label className="check-field">
              <input
                type="checkbox"
                checked={c.required}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, i) =>
                      i === index ? { ...x, required: e.target.checked } : x,
                    ),
                  )
                }
              />
              Required criterion
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={c.requireComment}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, i) =>
                      i === index ? { ...x, requireComment: e.target.checked } : x,
                    ),
                  )
                }
              />
              Require a comment
            </label>
            <button
              type="button"
              className="text-button"
              disabled={criteria.length === 1}
              onClick={() => setCriteria(criteria.filter((_, i) => i !== index))}
            >
              Remove criterion
            </button>
          </div>
        ))}
        <div className="button-row">
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setCriteria([
                ...criteria,
                {
                  title: '',
                  description: '',
                  weight: 1,
                  scoreMin: 0,
                  scoreMax: 10,
                  required: true,
                  requireComment: false,
                },
              ])
            }
          >
            + Add criterion
          </button>
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <SpinnerButton type="submit" loading={action.pending}>
            Save new rubric
          </SpinnerButton>
        </div>
      </form>
    </Section>
  );
}

function stagePayload(stage: Stage) {
  return {
    name: stage.name,
    sequence: stage.sequence,
    openAt: stage.openAt,
    submissionDeadline: stage.submissionDeadline,
    reviewDeadline: stage.reviewDeadline ?? undefined,
    rebuttalDeadline: stage.rebuttalDeadline ?? undefined,
    allowReviews: stage.allowReviews,
    allowRebuttal: stage.allowRebuttal,
    requireSimilarityCheck: stage.requireSimilarityCheck,
    peerReviewCount: stage.peerReviewCount,
    rubricRevisionId: stage.rubricRevisionId,
  };
}
