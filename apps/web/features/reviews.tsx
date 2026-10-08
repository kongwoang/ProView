'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult } from '@/lib/api/contracts';
import type {
  Submission,
  RubricRevision,
  ReviewRevision,
  Offering,
  Group,
  Member,
  Conflict,
} from '@/lib/api/domain';
import { PageHeader, Section, Field, EmptyState, StatusBadge } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import Table from '@/components/upstream/Table';
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

interface ReviewView {
  id: string;
  submissionId: string;
  submissionVersionId: string;
  reviewerLabel: string;
  assignmentId?: string;
  draftRevision?: ReviewRevision | null;
  submittedRevision: ReviewRevision | null;
  supersededAt: string | null;
}
interface AssignmentItem {
  id: string;
  submissionId: string;
  submissionVersionId: string;
  offeringId: string;
  projectTitle: string;
  stageName: string;
  deadline: string | null;
  timezone: string;
  status: string;
  reviewerType: string;
  reviewerLabel: string;
  reviewerGroupId: string | null;
  reviewerUserId: string | null;
  required: boolean;
  reviewId: string | null;
  conflicts: Conflict[];
}
interface AssignmentReview {
  assignment: {
    id: string;
    submissionId: string;
    submissionVersionId: string;
    status: string;
    projectTitle: string;
    stageName: string;
    deadline: string | null;
    timezone: string;
  };
  rubric: RubricRevision;
  review: ReviewView | null;
}

export function ReviewsPage() {
  const query = useResource<{ items: AssignmentItem[] }>('assignments', '/reviewer-assignments');
  return (
    <>
      <PageHeader
        title="Your reviews"
        description="Read the assigned version, use the rubric, and share constructive feedback."
      />
      <Section title="Review assignments">
        <QueryState query={query}>
          {(data) =>
            data.items.length ? (
              <Table
                caption="Review assignments"
                headings={[
                  { id: 'title', content: 'Project' },
                  { id: 'deadline', content: 'Deadline' },
                  { id: 'status', content: 'Status' },
                  { id: 'actions', content: 'Actions' },
                ]}
              >
                {data.items.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <strong>{assignment.projectTitle}</strong>
                      <p>
                        {assignment.stageName} · {assignment.reviewerLabel}
                      </p>
                    </td>
                    <td>{dateTime(assignment.deadline, assignment.timezone)}</td>
                    <td>
                      <StatusBadge status={assignment.status} />
                    </td>
                    <td>
                      {['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(assignment.status) && (
                        <Link className="button secondary" href={`/reviews/${assignment.id}`}>
                          {assignment.status === 'SUBMITTED' ? 'View review' : 'Open review'} →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <EmptyState
                title="No assigned reviews yet"
                description="Your instructor will assign your team a project to review."
              />
            )
          }
        </QueryState>
      </Section>
    </>
  );
}

export function ReviewEditorPage({ id }: { id: string }) {
  const { api } = useSession();
  const action = useAction();
  const query = useResource<AssignmentReview>(
    'assignment-review',
    `/reviewer-assignments/${id}/review`,
  );
  const [showPdf, setShowPdf] = useState(true);
  const [coi, setCoi] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRevisionRef = useRef<number | null>(null);
  return (
    <QueryState query={query}>
      {(data) => {
        const draft = data.review?.draftRevision;
        const submitted = data.review?.submittedRevision;
        const revision = draft ?? submitted;
        const editable = !!draft || !submitted;
        if (draftRevisionRef.current === null) draftRevisionRef.current = draft?.revision ?? 0;
        async function save(submit = false) {
          const form = formRef.current;
          if (!form || !form.reportValidity()) return;
          if (
            submit &&
            !window.confirm(
              'Submit this review? The submitted revision is final unless an instructor authorizes a correction.',
            )
          )
            return;
          const f = new FormData(form);
          await action.run(
            async () => {
              const saved = await api.put<{ id: string; revision: number }>(
                `/reviewer-assignments/${id}/review`,
                {
                  revision: draftRevisionRef.current ?? 0,
                  strengths: formText(f, 'strengths'),
                  weaknesses: formText(f, 'weaknesses'),
                  overallComment: formText(f, 'overallComment'),
                  ...(formText(f, 'recommendation')
                    ? { recommendation: formText(f, 'recommendation') }
                    : {}),
                  responses: data.rubric.criteria
                    .filter((c) => formText(f, `score-${c.id}`) !== '')
                    .map((c) => ({
                      criterionId: c.id,
                      score: Number(f.get(`score-${c.id}`)),
                      comment: formText(f, `comment-${c.id}`),
                    })),
                },
              );
              draftRevisionRef.current = saved.revision;
              if (submit)
                await api.post(`/reviews/${saved.id}/submit`, { revision: saved.revision });
              return saved;
            },
            submit
              ? 'Review submitted.'
              : 'Draft saved to the server. Your team can continue from this revision.',
          );
        }
        return (
          <>
            <PageHeader
              eyebrow={`${data.assignment.stageName} · REVIEW ASSIGNMENT`}
              title={data.assignment.projectTitle}
              description={`Due ${dateTime(data.assignment.deadline, data.assignment.timezone)} · Your review is bound to the assigned PDF version.`}
              actions={<StatusBadge status={data.assignment.status} />}
            />
            {action.feedback}
            <div className="button-row" style={{ marginBottom: 20 }}>
              <Link
                className="button secondary"
                href={`/submissions/${data.assignment.submissionId}`}
              >
                Submission workspace
              </Link>
              <button className="button secondary" onClick={() => setShowPdf(!showPdf)}>
                {showPdf ? 'Hide' : 'Show'} document
              </button>
              {editable && (
                <button className="text-button" onClick={() => setCoi(!coi)}>
                  Declare conflict of interest
                </button>
              )}
            </div>
            {coi && (
              <Section title="Conflict of interest">
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    if (
                      window.confirm(
                        'Declare this conflict? Review access will be suspended while the instructor decides.',
                      )
                    )
                      void action.run(
                        () =>
                          api.post(`/reviewer-assignments/${id}/conflicts`, {
                            reason: formText(f, 'reason'),
                          }),
                        'Conflict declared. Your instructor will review it.',
                      );
                  }}
                >
                  <Field label="Explain the conflict">
                    <textarea name="reason" maxLength={4000} required />
                  </Field>
                  <SpinnerButton type="submit" loading={action.pending}>
                    Submit declaration
                  </SpinnerButton>
                </form>
              </Section>
            )}
            <div className={showPdf ? 'two-column' : ''}>
              {showPdf && (
                <Section title="Assigned document">
                  <AuthorizedPdf
                    path={`/versions/${data.assignment.submissionVersionId}/file`}
                    title={data.assignment.projectTitle}
                  />
                </Section>
              )}
              <Section title={editable ? 'Your review draft' : 'Submitted review'}>
                <form
                  ref={formRef}
                  key={revision?.id ?? 'new'}
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <fieldset
                    disabled={!editable || action.pending}
                    style={{ border: 0, padding: 0, margin: 0 }}
                  >
                    <div className="form-stack">
                      {data.rubric.criteria.map((criterion) => {
                        const response = revision?.responses.find(
                          (r) => r.criterionId === criterion.id,
                        );
                        return (
                          <div className="panel" key={criterion.id}>
                            <Field
                              label={`${criterion.title} (${criterion.scoreMin}–${criterion.scoreMax})`}
                              help={criterion.description}
                            >
                              <input
                                name={`score-${criterion.id}`}
                                type="number"
                                step="0.01"
                                min={Number(criterion.scoreMin)}
                                max={Number(criterion.scoreMax)}
                                defaultValue={response?.score ?? ''}
                              />
                            </Field>
                            <Field label="Criterion feedback">
                              <textarea
                                name={`comment-${criterion.id}`}
                                maxLength={10000}
                                defaultValue={response?.comment}
                              />
                            </Field>
                            <p className="small muted">
                              Weight: {criterion.weight}.{' '}
                              {criterion.required
                                ? 'Score required for final submission.'
                                : 'Optional criterion.'}{' '}
                              {criterion.requireComment ? 'Comment required.' : ''}
                            </p>
                          </div>
                        );
                      })}
                      <Field label="Strengths">
                        <textarea
                          name="strengths"
                          maxLength={15000}
                          defaultValue={revision?.strengths}
                        />
                      </Field>
                      <Field label="Areas for improvement">
                        <textarea
                          name="weaknesses"
                          maxLength={15000}
                          defaultValue={revision?.weaknesses}
                        />
                      </Field>
                      <Field label="Overall comments">
                        <textarea
                          name="overallComment"
                          maxLength={15000}
                          defaultValue={revision?.overallComment}
                        />
                      </Field>
                      {data.rubric.recommendationOptions.length > 0 && (
                        <Field label="Recommendation">
                          <select
                            name="recommendation"
                            defaultValue={revision?.recommendation ?? ''}
                          >
                            <option value="">Choose a recommendation</option>
                            {data.rubric.recommendationOptions.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>
                  </fieldset>
                  {editable && (
                    <div className="form-actions">
                      <SpinnerButton type="submit" loading={action.pending} className="secondary">
                        Save draft
                      </SpinnerButton>
                      <SpinnerButton loading={action.pending} onClick={() => void save(true)}>
                        Submit review
                      </SpinnerButton>
                    </div>
                  )}
                  {!editable && (
                    <p className="muted small">
                      Submitted {dateTime(submitted?.submittedAt, data.assignment.timezone)}. This
                      revision is read-only.
                    </p>
                  )}
                </form>
              </Section>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}

export function SubmissionReviews({ submission }: { submission: Submission }) {
  const { api, user } = useSession();
  const action = useAction();
  const staff = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';
  const query = useResource<{ items: ReviewView[] }>(
    'reviews',
    `/submissions/${submission.id}/reviews`,
  );
  const [release, setRelease] = useState(false);
  const [correction, setCorrection] = useState<string | null>(null);
  return (
    <>
      {action.feedback}
      <Section
        title="Reviews"
        actions={
          staff && !submission.reviewsReleasedAt ? (
            <button className="button small" onClick={() => setRelease(!release)}>
              Release reviews
            </button>
          ) : undefined
        }
      >
        {release && (
          <form
            className="form-stack panel"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                window.confirm(
                  'Release submitted reviews to the authors and close this review round?',
                )
              )
                void action.run(
                  () =>
                    api.post(`/submissions/${submission.id}/reviews/release`, {
                      revision: submission.revision,
                      ...(formText(f, 'reason') ? { reason: formText(f, 'reason') } : {}),
                      ...(formDate(f, 'rebuttalDeadline', submission.offering.timezone)
                        ? {
                            rebuttalDeadline: formDate(
                              f,
                              'rebuttalDeadline',
                              submission.offering.timezone,
                            ),
                          }
                        : {}),
                    }),
                  'Reviews released.',
                );
            }}
          >
            <Field label="Reason for incomplete reviews or waived rebuttal (if needed)">
              <textarea name="reason" />
            </Field>
            <Field
              label="Optional new rebuttal deadline"
              help={`Time in ${submission.offering.timezone}`}
            >
              <input type="datetime-local" name="rebuttalDeadline" />
            </Field>
            <SpinnerButton type="submit" loading={action.pending}>
              Confirm release
            </SpinnerButton>
          </form>
        )}
        <QueryState query={query}>
          {(data) =>
            data.items.length ? (
              data.items.map((review) => (
                <article className="review-card" key={review.id}>
                  <header>
                    <strong>{review.reviewerLabel}</strong>
                    <span className="status-badge">
                      {review.supersededAt
                        ? 'PREVIOUS CYCLE'
                        : review.submittedRevision
                          ? 'SUBMITTED'
                          : 'DRAFT'}
                    </span>
                  </header>
                  {review.submittedRevision ? (
                    <ReviewContent revision={review.submittedRevision} />
                  ) : (
                    <p className="muted small">Review not submitted yet.</p>
                  )}
                  {staff && review.submittedRevision && !review.draftRevision && (
                    <button className="text-button" onClick={() => setCorrection(review.id)}>
                      Authorize correction
                    </button>
                  )}
                  {correction === review.id && (
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action
                          .run(
                            () =>
                              api.post(`/reviews/${review.id}/correction-authorizations`, {
                                reason: formText(f, 'reason'),
                                deadline: formDate(f, 'deadline', submission.offering.timezone),
                              }),
                            'Correction authorized.',
                          )
                          .then(() => setCorrection(null));
                      }}
                    >
                      <Field label="Correction reason">
                        <textarea name="reason" required />
                      </Field>
                      <Field
                        label="Correction deadline"
                        help={`Time in ${submission.offering.timezone}`}
                      >
                        <input name="deadline" type="datetime-local" required />
                      </Field>
                      <SpinnerButton type="submit" loading={action.pending}>
                        Authorize correction
                      </SpinnerButton>
                    </form>
                  )}
                </article>
              ))
            ) : (
              <EmptyState
                title="No reviews available yet"
                description="Submitted reviews will be visible here according to the course release policy."
              />
            )
          }
        </QueryState>
      </Section>
    </>
  );
}

function ReviewContent({ revision }: { revision: ReviewRevision }) {
  return (
    <>
      <div className="score-grid">
        {revision.responses.map((response) => (
          <div key={response.criterionId} className="score-item">
            {response.criterionTitle ?? response.criterion?.title ?? 'Criterion'}
            <strong>{response.score}</strong>
            <p>{response.comment}</p>
          </div>
        ))}
      </div>
      <h3>Strengths</h3>
      <p className="review-content">{revision.strengths || '—'}</p>
      <h3>Areas for improvement</h3>
      <p className="review-content">{revision.weaknesses || '—'}</p>
      <h3>Overall comments</h3>
      <p className="review-content">{revision.overallComment || '—'}</p>
      {revision.recommendation && (
        <p className="inline-info">Recommendation: {revision.recommendation}</p>
      )}
    </>
  );
}

interface AssignmentPlan {
  id: string;
  status: string;
  pairs: { submissionId: string; reviewerGroupId: string }[];
  excludedPairs: { submissionId: string; reviewerGroupId: string; reason: string }[];
  workloadBefore: Record<string, number>;
  workloadAfter: Record<string, number>;
  unmetDemand: { submissionId: string; missing: number }[];
}
export function ReviewManagementPage() {
  const { api } = useSession();
  const action = useAction();
  const [offeringId, setOfferingId] = useState('');
  const [plan, setPlan] = useState<AssignmentPlan | null>(null);
  const [replacement, setReplacement] = useState<AssignmentItem | null>(null);
  const offerings = useResource<PageResult<Offering>>('offerings', '/offerings?pageSize=100');
  const chosen = offeringId || offerings.data?.items[0]?.id || '';
  const offering = useResource<Offering>('offering', `/offerings/${chosen}`, !!chosen);
  const assignments = useResource<{ items: AssignmentItem[] }>(
    'assignments',
    `/reviewer-assignments?offeringId=${chosen}`,
    !!chosen,
  );
  const submissions = useResource<PageResult<Submission> | Submission[]>(
    'offering-submissions',
    `/offerings/${chosen}/submissions?pageSize=100`,
    !!chosen,
  );
  const groups = useResource<Group[]>('groups', `/offerings/${chosen}/groups`, !!chosen);
  const roster = useResource<Member[]>('roster', `/offerings/${chosen}/roster`, !!chosen);
  return (
    <>
      <PageHeader
        eyebrow="REVIEW COORDINATION"
        title="Review management"
        description="Balance review workloads, resolve conflicts, and monitor progress."
      />
      {action.feedback}
      <div className="filters">
        <select
          className="filter-input"
          aria-label="Review management course"
          value={chosen}
          onChange={(e) => {
            setOfferingId(e.target.value);
            setPlan(null);
          }}
        >
          <option value="">Choose a course</option>
          {offerings.data?.items.map((o) => (
            <option key={o.id} value={o.id}>
              {o.course.code} · {o.semester}
            </option>
          ))}
        </select>
      </div>
      {chosen && (
        <>
          <div className="two-column">
            <Section title="Automatic assignment">
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action
                    .run(
                      () =>
                        api.post<AssignmentPlan>(`/offerings/${chosen}/assignment-plans`, {
                          stageId: formText(f, 'stageId'),
                        }),
                      'Assignment preview generated.',
                    )
                    .then((result) => {
                      if (result) setPlan(result);
                    });
                }}
              >
                <Field label="Submission stage">
                  <select name="stageId" required>
                    {offering.data?.stages
                      .filter((s) => s.allowReviews)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <p className="muted small">
                  The planner excludes self-review and conflicts, then balances workloads. Review
                  the proposed pairs before applying them.
                </p>
                <SpinnerButton type="submit" loading={action.pending}>
                  Generate preview
                </SpinnerButton>
              </form>
            </Section>
            <Section title={replacement ? 'Assign replacement reviewer' : 'Manual assignment'}>
              <form
                className="form-stack"
                key={replacement?.id ?? 'manual'}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const [reviewerType, reviewerId] = formText(f, 'reviewer').split(':');
                  const data = {
                    submissionId: replacement?.submissionId ?? formText(f, 'submissionId'),
                    reviewerType,
                    ...(reviewerType === 'GROUP'
                      ? { reviewerGroupId: reviewerId }
                      : { reviewerUserId: reviewerId }),
                  };
                  void action
                    .run(
                      () =>
                        api.post(
                          replacement
                            ? `/reviewer-assignments/${replacement.id}/replacement`
                            : '/reviewer-assignments',
                          data,
                        ),
                      'Reviewer assigned.',
                    )
                    .then((result) => {
                      if (result) setReplacement(null);
                    });
                }}
              >
                <Field label="Submission">
                  <select
                    name="submissionId"
                    required
                    disabled={!!replacement}
                    defaultValue={replacement?.submissionId}
                  >
                    {itemsOf(submissions.data)
                      .filter((s) => ['SUBMITTED', 'UNDER_REVIEW'].includes(s.status))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.project.title} · {s.stage.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Reviewer">
                  <select name="reviewer" required>
                    <option value="">Choose a reviewer</option>
                    {groups.data?.map((g) => (
                      <option key={g.id} value={`GROUP:${g.id}`}>
                        {g.name}
                      </option>
                    ))}
                    {roster.data
                      ?.filter((m) => m.role === 'INSTRUCTOR')
                      .map((m) => (
                        <option key={m.id} value={`INSTRUCTOR:${m.userId}`}>
                          {m.user.displayName} · Instructor
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="button-row">
                  {replacement && (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setReplacement(null)}
                    >
                      Cancel replacement
                    </button>
                  )}
                  <SpinnerButton type="submit" loading={action.pending}>
                    Assign reviewer
                  </SpinnerButton>
                </div>
              </form>
            </Section>
          </div>
          {plan && (
            <Section title="Assignment preview">
              <StatusBadge status={plan.status} />
              {plan.status === 'INFEASIBLE' && (
                <p className="inline-info">
                  There are not enough eligible reviewers. Resolve the unmet demand below before
                  applying an assignment.
                </p>
              )}
              {plan.status === 'TIME_LIMIT' && (
                <p className="inline-info">
                  The search reached its limit without proving a complete solution. This does not
                  mean the assignment is impossible. Adjust the workload or assign manually.
                </p>
              )}
              <Table
                caption="Proposed review pairs"
                headings={[
                  { id: 'project', content: 'Submission' },
                  { id: 'reviewer', content: 'Reviewer group' },
                ]}
              >
                {plan.pairs.map((pair) => (
                  <tr key={`${pair.submissionId}:${pair.reviewerGroupId}`}>
                    <td>
                      {itemsOf(submissions.data).find((s) => s.id === pair.submissionId)?.project
                        .title ?? pair.submissionId}
                    </td>
                    <td>
                      {groups.data?.find((g) => g.id === pair.reviewerGroupId)?.name ??
                        pair.reviewerGroupId}
                    </td>
                  </tr>
                ))}
              </Table>
              <h3 style={{ marginTop: 20 }}>Workload before → after</h3>
              {Object.entries(plan.workloadAfter).map(([groupId, count]) => (
                <p className="small" key={groupId}>
                  {groups.data?.find((g) => g.id === groupId)?.name ?? groupId}:{' '}
                  {plan.workloadBefore[groupId]} → {count}
                </p>
              ))}
              {plan.unmetDemand.map((u) => (
                <p key={u.submissionId}>
                  Missing {u.missing} reviewer(s):{' '}
                  {itemsOf(submissions.data).find((s) => s.id === u.submissionId)?.project.title}
                </p>
              ))}
              <details>
                <summary>Excluded pairs ({plan.excludedPairs.length})</summary>
                {plan.excludedPairs.map((pair, i) => (
                  <p className="small" key={i}>
                    {groups.data?.find((g) => g.id === pair.reviewerGroupId)?.name} · {pair.reason}{' '}
                    ·{' '}
                    {
                      itemsOf(submissions.data).find((s) => s.id === pair.submissionId)?.project
                        .title
                    }
                  </p>
                ))}
              </details>
              {plan.status === 'READY' && (
                <SpinnerButton
                  loading={action.pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Apply this assignment preview? Reviewers will be notified and submission input will be locked.',
                      )
                    )
                      void action
                        .run(
                          () => api.post(`/assignment-plans/${plan.id}/apply`),
                          'Assignment plan applied.',
                        )
                        .then(() => setPlan(null));
                  }}
                >
                  Apply assignment plan
                </SpinnerButton>
              )}
            </Section>
          )}
          <Section title="Assignments & conflicts">
            <QueryState query={assignments}>
              {(data) =>
                data.items.map((a) => (
                  <article className="review-card" key={a.id}>
                    <header>
                      <div>
                        <strong>
                          <Link href={`/submissions/${a.submissionId}`}>{a.projectTitle}</Link>
                        </strong>
                        <p className="small muted">
                          {a.stageName} · {a.reviewerLabel}
                        </p>
                      </div>
                      <StatusBadge status={a.status} />
                    </header>
                    <div className="button-row">
                      <Link className="button secondary small" href={`/reviews/${a.id}`}>
                        Review details
                      </Link>
                      {['ASSIGNED', 'IN_PROGRESS'].includes(a.status) && (
                        <button
                          className="text-button"
                          disabled={action.pending}
                          onClick={() => {
                            const reason = window.prompt('Why is this assignment being cancelled?');
                            if (reason)
                              void action.run(
                                () => api.post(`/reviewer-assignments/${a.id}/cancel`, { reason }),
                                'Assignment cancelled.',
                              );
                          }}
                        >
                          Cancel assignment
                        </button>
                      )}
                      {a.status === 'REASSIGNMENT_APPROVED' && (
                        <button className="button small" onClick={() => setReplacement(a)}>
                          Select replacement
                        </button>
                      )}
                    </div>
                    {a.conflicts.map((conflict) => (
                      <div className="inline-info" key={conflict.id}>
                        <h3>Conflict declaration · {conflict.status}</h3>
                        <p className="review-content">{conflict.reason}</p>
                        {conflict.decisionNote && (
                          <p className="review-content">{conflict.decisionNote}</p>
                        )}
                        {conflict.status === 'PENDING' && (
                          <div className="button-row">
                            {['APPROVED', 'REJECTED'].map((decision) => (
                              <button
                                key={decision}
                                className="button secondary small"
                                disabled={action.pending}
                                onClick={() => {
                                  const note = window.prompt(
                                    `Reason for ${decision.toLowerCase()} conflict decision:`,
                                  );
                                  if (note)
                                    void action.run(
                                      () =>
                                        api.post(`/conflicts/${conflict.id}/decision`, {
                                          decision,
                                          note,
                                        }),
                                      'Conflict decision recorded.',
                                    );
                                }}
                              >
                                {decision === 'APPROVED'
                                  ? 'Approve reassignment'
                                  : 'Reject declaration'}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </article>
                ))
              }
            </QueryState>
          </Section>
        </>
      )}
    </>
  );
}
