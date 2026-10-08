'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult } from '@/lib/api/contracts';
import type { Project, Submission } from '@/lib/api/domain';
import { PageHeader, Section, EmptyState, StatusBadge, Field } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import {
  useResource,
  QueryState,
  useAction,
  itemsOf,
  dateTime,
  formText,
  formDate,
  AuthorizedPdf,
} from './shared';
import { SubmissionReviews } from './reviews';
import { RebuttalPanel, DiscussionPanel } from './discussion';
import { GradePanel } from './grades';

export function ProjectsPage() {
  const query = useResource<PageResult<Project> | Project[]>('projects', '/projects/mine');
  return (
    <>
      <PageHeader
        eyebrow="YOUR TEAM, YOUR WORK"
        title="My projects"
        description="Follow each project from proposal to final submission."
      />
      <QueryState query={query}>
        {(data) =>
          itemsOf(data).length ? (
            <div className="cards-grid">
              {itemsOf(data).map((project) => (
                <article className="project-card" key={project.id}>
                  <p className="eyebrow">
                    {project.offering.course.code} · {project.offering.semester}
                  </p>
                  <h3>
                    <Link href={`/projects/${project.id}`}>{project.title}</Link>
                  </h3>
                  <p className="meta">{project.group.name}</p>
                  <p className="muted small">{project.description}</p>
                  <footer>
                    <span className="muted small">
                      {project.submissions?.length ?? 0} submission stages started
                    </span>
                    <Link className="link-arrow" href={`/projects/${project.id}`}>
                      Open project →
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Your next project starts here"
              description="Your instructor will assign you to a project group. Your projects will then appear in this space."
            />
          )
        }
      </QueryState>
    </>
  );
}

export function ProjectPage({ id }: { id: string }) {
  const { api, user } = useSession();
  const router = useRouter();
  const action = useAction();
  const query = useResource<Project>('project', `/projects/${id}`);
  return (
    <QueryState query={query}>
      {(project) => (
        <>
          <PageHeader
            eyebrow={`${project.offering.course.code} · ${project.group.name}`}
            title={project.title}
            description={project.description}
            actions={
              <Link className="button secondary" href={`/offerings/${project.offering.id}`}>
                Course space ↗
              </Link>
            }
          />
          {action.feedback}
          <div className="content-grid">
            <Section title="Submission milestones">
              {(project.stages ?? project.offering.stages).map((stage) => {
                const submission = project.submissions.find((s) => s.stageId === stage.id);
                return (
                  <div className="list-row" key={stage.id}>
                    <div className="row-content">
                      <h3>{stage.name}</h3>
                      <p className="muted">
                        Due {dateTime(stage.submissionDeadline, project.offering.timezone)}
                      </p>
                      {submission && <StatusBadge status={submission.status} />}
                    </div>
                    {submission ? (
                      <Link
                        className="button secondary small"
                        href={`/submissions/${submission.id}`}
                      >
                        Open submission →
                      </Link>
                    ) : user?.role === 'STUDENT' ? (
                      <button
                        className="button small"
                        disabled={action.pending}
                        onClick={() => {
                          void action
                            .run(
                              () =>
                                api.post<Submission>(`/projects/${id}/submissions`, {
                                  stageId: stage.id,
                                }),
                              'Submission created.',
                            )
                            .then((result) => {
                              if (result) router.push(`/submissions/${result.id}`);
                            });
                        }}
                      >
                        Start submission
                      </button>
                    ) : (
                      <span className="muted small">Not started</span>
                    )}
                  </div>
                );
              })}
            </Section>
            <Section title="Project team">
              {project.group.members
                .filter((m) => !m.leftAt)
                .map((m) => (
                  <div className="list-row" key={m.id}>
                    <span className="avatar">
                      {(m.user?.displayName ?? m.membership?.user.displayName ?? 'T').slice(0, 1)}
                    </span>
                    <div className="row-content">
                      <h3>
                        {m.user?.displayName ?? m.membership?.user.displayName ?? 'Team member'}
                      </h3>
                      <p className="muted">{project.group.name}</p>
                    </div>
                  </div>
                ))}
            </Section>
          </div>
        </>
      )}
    </QueryState>
  );
}

export function SubmissionPage({ id }: { id: string }) {
  const { api, user } = useSession();
  const action = useAction();
  const query = useResource<Submission>('submission', `/submissions/${id}`);
  const [tab, setTab] = useState('Document');
  const [selectedId, setSelectedId] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showReopen, setShowReopen] = useState(false);
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setUploadProgress(0);
    const result = await action.run(
      () => api.upload<{ id: string }>(`/submissions/${id}/versions`, form, setUploadProgress),
      'PDF uploaded as a new version. Choose Submit version when it is ready for review.',
    );
    if (result) {
      setSelectedId(result.id);
      setShowUpload(false);
    }
  }
  return (
    <QueryState query={query}>
      {(submission) => {
        const currentId =
          selectedId ||
          submission.submittedVersionId ||
          submission.latestDraftVersionId ||
          submission.versions[0]?.id;
        const selected = submission.versions.find((v) => v.id === currentId);
        const can = (actionName: string) => submission.allowedActions.includes(actionName);
        const staff = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';
        return (
          <>
            <PageHeader
              eyebrow={`${submission.offering.course.code} · ${submission.stage.name}`}
              title={submission.project.title}
              description={`${submission.project.group?.name ?? submission.group?.name ?? ''} · Submission deadline ${dateTime(submission.stage.submissionDeadline, submission.offering.timezone)}`}
              actions={
                <>
                  <StatusBadge status={submission.status} />
                  {can('UPLOAD_VERSION') && (
                    <button className="button" onClick={() => setShowUpload(!showUpload)}>
                      ↑ Upload revision
                    </button>
                  )}
                </>
              }
            />
            <div className="detail-meta">
              <span>
                Current submitted version:{' '}
                <strong>
                  {submission.versions.find((v) => v.id === submission.submittedVersionId)
                    ?.versionNumber ?? 'None'}
                </strong>
              </span>
              <span>
                Latest draft:{' '}
                <strong>
                  {submission.versions.find((v) => v.id === submission.latestDraftVersionId)
                    ?.versionNumber ?? 'None'}
                </strong>
              </span>
              <span>
                Submitted {dateTime(submission.submittedAt, submission.offering.timezone)}
              </span>
              {submission.reopenUntil && (
                <span>
                  Reopened until {dateTime(submission.reopenUntil, submission.offering.timezone)}
                </span>
              )}
            </div>
            {action.feedback}
            {showUpload && (
              <Section title="Upload a new PDF version">
                <form className="form-stack" onSubmit={(e) => void upload(e)}>
                  <Field
                    label="PDF document"
                    help="Uploading preserves every previous version. Upload does not submit the document."
                  >
                    <input type="file" name="file" accept="application/pdf,.pdf" required />
                  </Field>
                  <Field label="What changed?">
                    <textarea name="changeNote" maxLength={4000} required />
                  </Field>
                  {action.pending && (
                    <label className="field">
                      Upload progress: {uploadProgress}%
                      <progress value={uploadProgress} max={100} />
                    </label>
                  )}
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setShowUpload(false)}
                    >
                      Cancel
                    </button>
                    <SpinnerButton type="submit" loading={action.pending}>
                      Upload PDF
                    </SpinnerButton>
                  </div>
                </form>
              </Section>
            )}
            <div className="tabs" role="tablist">
              {[
                'Document',
                'Reviews',
                ...(submission.stage.allowRebuttal ? ['Rebuttal'] : []),
                'Discussion',
                'Grade',
                'Version history',
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
            {tab === 'Document' && (
              <Section
                title={selected ? `Document · version ${selected.versionNumber}` : 'Document'}
                actions={
                  <div className="button-row">
                    {submission.versions.length > 0 && (
                      <select
                        aria-label="Choose document version"
                        value={currentId}
                        onChange={(e) => setSelectedId(e.target.value)}
                      >
                        {submission.versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            Version {v.versionNumber}
                            {v.id === submission.submittedVersionId ? ' · submitted' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {can('SUBMIT') && selected && (
                      <SpinnerButton
                        loading={action.pending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Submit version ${selected.versionNumber} for ${submission.stage.name}? This version will become the official submission.`,
                            )
                          )
                            void action.run(
                              () =>
                                api.post(`/submissions/${id}/submit`, {
                                  versionId: selected.id,
                                  revision: submission.revision,
                                }),
                              'Version submitted.',
                            );
                        }}
                      >
                        Submit version {selected.versionNumber}
                      </SpinnerButton>
                    )}
                  </div>
                }
              >
                {selected ? (
                  <AuthorizedPdf
                    key={currentId}
                    path={`/versions/${currentId}/file`}
                    title={`${submission.project.title} v${selected.versionNumber}`}
                    download
                  />
                ) : (
                  <EmptyState
                    title="No document uploaded"
                    description="Upload your project PDF to create the first version. Your team can review it before submission."
                  />
                )}
              </Section>
            )}
            {tab === 'Reviews' && <SubmissionReviews submission={submission} />}
            {tab === 'Rebuttal' && <RebuttalPanel submission={submission} />}
            {tab === 'Discussion' && <DiscussionPanel submissionId={id} />}
            {tab === 'Grade' && <GradePanel submission={submission} />}
            {tab === 'Version history' && (
              <Section title="Version history">
                {submission.versions.map((version) => (
                  <div className="timeline-item" key={version.id}>
                    <div className="section-heading">
                      <h3>
                        Version {version.versionNumber}{' '}
                        {version.id === submission.submittedVersionId && (
                          <StatusBadge status="SUBMITTED" />
                        )}
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => {
                          setSelectedId(version.id);
                          setTab('Document');
                        }}
                      >
                        View PDF
                      </button>
                    </div>
                    <p className="muted">
                      {dateTime(version.uploadedAt, submission.offering.timezone)} ·{' '}
                      {version.file?.displayName}
                    </p>
                    <p className="review-content">{version.changeNote}</p>
                    {version.file?.sha256 && (
                      <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
                        SHA-256: {version.file.sha256}
                      </p>
                    )}
                  </div>
                ))}
              </Section>
            )}
            {can('FINALIZE_INPUT') && (
              <div className="button-row">
                <SpinnerButton
                  loading={action.pending}
                  onClick={() => {
                    if (
                      window.confirm('Lock submission input and complete this stage for grading?')
                    )
                      void action.run(
                        () =>
                          api.post(`/submissions/${id}/finalize-input`, {
                            revision: submission.revision,
                          }),
                        'Submission input finalized.',
                      );
                  }}
                >
                  Finalize input for grading
                </SpinnerButton>
              </div>
            )}
            {staff && can('REOPEN') && (
              <div className="button-row">
                <button className="text-button" onClick={() => setShowReopen(!showReopen)}>
                  Reopen submission window
                </button>
              </div>
            )}
            {showReopen && (
              <Section title="Reopen submission">
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      window.confirm(
                        'Reopen this submission? The reason and new deadline will be recorded.',
                      )
                    )
                      void action.run(
                        () =>
                          api.post(`/submissions/${id}/reopen`, {
                            revision: submission.revision,
                            reason: formText(f, 'reason'),
                            until: formDate(f, 'until', submission.offering.timezone),
                          }),
                        'Submission window reopened.',
                      );
                  }}
                >
                  <Field label="Reason">
                    <textarea name="reason" required />
                  </Field>
                  <Field
                    label="Allow changes until"
                    help={`Time in ${submission.offering.timezone}`}
                  >
                    <input type="datetime-local" name="until" required />
                  </Field>
                  <SpinnerButton type="submit" loading={action.pending}>
                    Reopen
                  </SpinnerButton>
                </form>
              </Section>
            )}
          </>
        );
      }}
    </QueryState>
  );
}
