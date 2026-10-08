'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { Criterion, Submission, Offering } from '@/lib/api/domain';
import type { PageResult } from '@/lib/api/contracts';
import { PageHeader, Section, Field, EmptyState, StatusBadge } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import {
  useResource,
  QueryState,
  useAction,
  formText,
  dateTime,
  AuthorizedPdf,
  itemsOf,
} from './shared';

interface GradeRevision {
  id: string;
  status: string;
  revision: number;
  submissionVersionId: string;
  overall: number | null;
  calculatedOverall: number | null;
  feedback: string;
  overrideReason: string | null;
  correctionReason: string | null;
  publishedAt: string | null;
  criterionScores: { criterionId: string; title: string; score: number; comment: string }[];
}
interface GradeResponse {
  id?: string;
  draft?: GradeRevision | null;
  published?: GradeRevision | null;
  grade?: GradeRevision | null;
}
interface GradingContext {
  submission: {
    id: string;
    status: string;
    submittedVersionId: string;
    reviewCycle: number;
    project: { title: string };
  };
  rubric: { id: string; criteria: Criterion[] };
  versions: { id: string; versionNumber: number }[];
  assignments: {
    id: string;
    status: string;
    reviewer: {
      kind: string;
      name?: string;
      displayName?: string;
      members?: { displayName: string }[];
    };
    review: {
      strengths: string;
      weaknesses: string;
      overallComment: string;
      responses: { title: string; score: number; comment: string }[];
    } | null;
  }[];
  rebuttal: { generalResponse: string; status: string } | null;
  discussions: { id: string; content: string; author: { displayName: string } }[];
  similarity: { status: string; percentage: number | null; notes: string } | null;
  grade: GradeResponse;
}

export function GradePanel({ submission }: { submission: Submission }) {
  const { user } = useSession();
  const staff = user?.role === 'INSTRUCTOR' || user?.role === 'ADMIN';
  const query = useResource<GradeResponse>('grade', `/submissions/${submission.id}/grade`, !staff);
  if (staff) return <GradingWorkspace id={submission.id} />;
  return (
    <QueryState query={query}>
      {(data) => (
        <Section title="Your published grade">
          {data.grade ? (
            <PublishedGrade grade={data.grade} />
          ) : (
            <EmptyState
              title="Your grade has not been published"
              description="Your instructor’s final assessment will appear here once it is ready."
            />
          )}
        </Section>
      )}
    </QueryState>
  );
}

function PublishedGrade({ grade }: { grade: GradeRevision }) {
  return (
    <>
      <div className="stat-value" style={{ marginBottom: 14 }}>
        {grade.overall ?? '—'}
        <span className="muted" style={{ fontSize: 16 }}>
          {' '}
          / 10
        </span>
      </div>
      <p className="small muted">Published {dateTime(grade.publishedAt)}</p>
      <div className="score-grid">
        {grade.criterionScores.map((score) => (
          <div className="score-item" key={score.criterionId}>
            {score.title}
            <strong>{score.score}</strong>
            <span>{score.comment}</span>
          </div>
        ))}
      </div>
      <h3>Instructor feedback</h3>
      <p className="review-content">{grade.feedback || 'No additional feedback.'}</p>
    </>
  );
}

export function GradingPage() {
  const offerings = useResource<PageResult<Offering>>('offerings', '/offerings?pageSize=100');
  const [offeringId, setOfferingId] = useState('');
  const chosen = offeringId || offerings.data?.items[0]?.id || '';
  const submissions = useResource<PageResult<Submission> | Submission[]>(
    'grading-submissions',
    `/offerings/${chosen}/submissions?pageSize=100`,
    !!chosen,
  );
  return (
    <>
      <PageHeader
        eyebrow="ASSESSMENT"
        title="Grading workspace"
        description="Review evidence and publish an assessment for the exact submitted version."
      />
      <div className="filters">
        <select
          className="filter-input"
          aria-label="Select grading course"
          value={chosen}
          onChange={(e) => setOfferingId(e.target.value)}
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
        <QueryState query={submissions}>
          {(data) =>
            itemsOf(data).length ? (
              <div className="cards-grid">
                {itemsOf(data)
                  .filter((s) => s.status !== 'DRAFT')
                  .map((s) => (
                    <article className="project-card" key={s.id}>
                      <StatusBadge status={s.status} />
                      <h3 style={{ marginTop: 14 }}>
                        <Link href={`/grading/${s.id}`}>{s.project.title}</Link>
                      </h3>
                      <p className="muted small">{s.stage.name}</p>
                      <Link className="button secondary" href={`/grading/${s.id}`}>
                        Review & grade →
                      </Link>
                    </article>
                  ))}
              </div>
            ) : (
              <EmptyState
                title="No submissions to grade"
                description="Submitted projects from this course will appear here."
              />
            )
          }
        </QueryState>
      )}
    </>
  );
}

export function GradingWorkspace({ id }: { id: string }) {
  const { api } = useSession();
  const action = useAction();
  const query = useResource<GradingContext>(
    'grading-context',
    `/submissions/${id}/grading-context`,
  );
  const [showPdf, setShowPdf] = useState(false);
  const draftRevisionRef = useRef<number | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const evidenceRef = useRef<{
    submissionVersionId: string;
    rubricRevisionId: string;
    reviewCycle: number;
  } | null>(null);
  return (
    <QueryState query={query}>
      {(context) => {
        const draft = context.grade.draft;
        const published = context.grade.published;
        if (draftRevisionRef.current === null) {
          draftRevisionRef.current = draft?.revision ?? 0;
          draftIdRef.current = draft?.id ?? null;
        }
        if (!evidenceRef.current)
          evidenceRef.current = {
            submissionVersionId: context.submission.submittedVersionId,
            rubricRevisionId: context.rubric.id,
            reviewCycle: context.submission.reviewCycle,
          };
        if (
          evidenceRef.current.reviewCycle !== context.submission.reviewCycle ||
          evidenceRef.current.submissionVersionId !== context.submission.submittedVersionId ||
          evidenceRef.current.rubricRevisionId !== context.rubric.id
        )
          return (
            <Section title="Grading evidence changed">
              <p>
                The submitted PDF, rubric or submission round has changed. Reload and review the
                current evidence before grading.
              </p>
              <button className="button" onClick={() => window.location.reload()}>
                Reload assessment
              </button>
            </Section>
          );
        return (
          <>
            {action.feedback}
            <PageHeader
              title={context.submission.project.title}
              eyebrow="CONSOLIDATED EVIDENCE"
              actions={<StatusBadge status={context.submission.status} />}
            />
            <div className="button-row" style={{ marginBottom: 20 }}>
              <Link className="button secondary" href={`/submissions/${id}`}>
                Submission workspace
              </Link>
              <button className="button secondary" onClick={() => setShowPdf(!showPdf)}>
                {showPdf ? 'Hide' : 'View'} submitted PDF
              </button>
            </div>
            {showPdf && (
              <Section title="Submitted PDF">
                <AuthorizedPdf
                  path={`/versions/${context.submission.submittedVersionId}/file`}
                  title={context.submission.project.title}
                  download
                />
              </Section>
            )}
            <div className="two-column">
              <div>
                <Section title="Review evidence">
                  {context.assignments.length ? (
                    context.assignments.map((assignment) => (
                      <article className="review-card" key={assignment.id}>
                        <header>
                          <strong>
                            {assignment.reviewer.name ||
                              assignment.reviewer.displayName ||
                              'Instructor reviewer'}
                          </strong>
                          <StatusBadge status={assignment.status} />
                        </header>
                        {assignment.reviewer.members && (
                          <p className="small muted">
                            {assignment.reviewer.members.map((m) => m.displayName).join(', ')}
                          </p>
                        )}
                        {assignment.review ? (
                          <>
                            <p className="review-content">{assignment.review.overallComment}</p>
                            <h3>Strengths</h3>
                            <p className="review-content">{assignment.review.strengths}</p>
                            <h3>Areas for improvement</h3>
                            <p className="review-content">{assignment.review.weaknesses}</p>
                            <div className="score-grid">
                              {assignment.review.responses.map((r, i) => (
                                <div className="score-item" key={i}>
                                  {r.title}
                                  <strong>{r.score}</strong>
                                  <p>{r.comment}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="muted small">Review not submitted.</p>
                        )}
                      </article>
                    ))
                  ) : (
                    <p className="muted">No reviewer assignments.</p>
                  )}
                </Section>
                <Section title="Author response">
                  <p className="review-content">
                    {context.rebuttal?.generalResponse || 'No rebuttal available.'}
                  </p>
                  {context.rebuttal && <StatusBadge status={context.rebuttal.status} />}
                </Section>
                <Section title="Discussion">
                  {context.discussions.map((m) => (
                    <article className="list-row" key={m.id}>
                      <div>
                        <strong className="small">{m.author?.displayName}</strong>
                        <p className="review-content">{m.content}</p>
                      </div>
                    </article>
                  ))}
                </Section>
                <Section title="Similarity evidence">
                  {context.similarity ? (
                    <>
                      <StatusBadge status={context.similarity.status} />
                      <p className="stat-value" style={{ marginTop: 14 }}>
                        {context.similarity.percentage === null
                          ? '—'
                          : `${context.similarity.percentage}%`}
                      </p>
                      <p className="review-content">{context.similarity.notes}</p>
                      <Link href="/similarity-checks">Manage similarity check →</Link>
                    </>
                  ) : (
                    <p className="muted">No similarity check for this version.</p>
                  )}
                </Section>
              </div>
              <div>
                <Section title="Instructor assessment">
                  <form
                    key={draft?.id ?? 'new'}
                    className="form-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void action
                        .run(
                          () =>
                            api.put<GradeResponse>(`/submissions/${id}/grade`, {
                              revision: draftRevisionRef.current ?? 0,
                              ...evidenceRef.current,
                              criterionScores: context.rubric.criteria
                                .filter((criterion) => formText(f, `score-${criterion.id}`) !== '')
                                .map((criterion) => ({
                                  criterionId: criterion.id,
                                  score: Number(f.get(`score-${criterion.id}`)),
                                  comment: formText(f, `comment-${criterion.id}`),
                                })),
                              feedback: formText(f, 'feedback'),
                              ...(formText(f, 'overall')
                                ? {
                                    overall: Number(formText(f, 'overall')),
                                    overrideReason: formText(f, 'overrideReason'),
                                  }
                                : {}),
                              ...(published && !draft
                                ? { correctionReason: formText(f, 'correctionReason') }
                                : {}),
                            }),
                          'Private grade draft saved.',
                        )
                        .then((result) => {
                          if (result?.draft) {
                            draftRevisionRef.current = result.draft.revision;
                            draftIdRef.current = result.draft.id;
                          }
                        });
                    }}
                  >
                    {context.rubric.criteria.map((criterion) => {
                      const score = draft?.criterionScores.find(
                        (s) => s.criterionId === criterion.id,
                      );
                      return (
                        <div key={criterion.id}>
                          <Field
                            label={`${criterion.title} · weight ${criterion.weight}`}
                            help={criterion.description}
                          >
                            <input
                              name={`score-${criterion.id}`}
                              type="number"
                              min={Number(criterion.scoreMin)}
                              max={Number(criterion.scoreMax)}
                              step="0.01"
                              required={criterion.required}
                              defaultValue={score?.score ?? ''}
                            />
                          </Field>
                          <Field label={`${criterion.title} feedback`}>
                            <textarea
                              name={`comment-${criterion.id}`}
                              defaultValue={score?.comment}
                            />
                          </Field>
                        </div>
                      );
                    })}
                    <Field label="Overall feedback">
                      <textarea name="feedback" defaultValue={draft?.feedback} />
                    </Field>
                    <Field label="Optional overall override (0–10)">
                      <input
                        name="overall"
                        type="number"
                        min={0}
                        max={10}
                        step="0.01"
                        defaultValue={draft?.overrideReason ? (draft.overall ?? '') : ''}
                      />
                    </Field>
                    <Field label="Override reason">
                      <textarea name="overrideReason" defaultValue={draft?.overrideReason ?? ''} />
                    </Field>
                    {published && !draft && (
                      <Field label="Reason for correcting the published grade">
                        <textarea name="correctionReason" required />
                      </Field>
                    )}
                    <SpinnerButton type="submit" loading={action.pending}>
                      Save private draft
                    </SpinnerButton>
                  </form>
                  {draft && (
                    <div className="inline-info">
                      <p>
                        Draft overall: <strong>{draft.overall ?? 'Incomplete'} / 10</strong>
                      </p>
                      <p className="small">
                        Calculated score: {draft.calculatedOverall ?? 'Incomplete'}. Students cannot
                        see this draft.
                      </p>
                      <SpinnerButton
                        loading={action.pending}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Publish this assessment? Students will see the grade and feedback. The submitted PDF version will be finalized.',
                            )
                          )
                            void action
                              .run(
                                () =>
                                  api.post(`/grades/${context.grade.id}/publish`, {
                                    revision: draftRevisionRef.current ?? 0,
                                    gradeRevisionId: draftIdRef.current ?? draft.id,
                                  }),
                                'Grade published.',
                              )
                              .then((result) => {
                                if (result) {
                                  draftRevisionRef.current = 0;
                                  draftIdRef.current = null;
                                }
                              });
                        }}
                      >
                        Publish grade
                      </SpinnerButton>
                    </div>
                  )}
                </Section>
                {published && (
                  <Section title="Published assessment">
                    <PublishedGrade grade={published} />
                  </Section>
                )}
              </div>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}
