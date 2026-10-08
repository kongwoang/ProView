'use client';

import { useRef, useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { Submission } from '@/lib/api/domain';
import { Section, Field, EmptyState, StatusBadge } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import { useResource, QueryState, useAction, dateTime, formText, formDate } from './shared';

interface Rebuttal {
  id: string;
  generalResponse: string;
  status: string;
  revision: number;
  finalizedAt: string | null;
  deadline: string | null;
  canEdit: boolean;
  responses: { reviewId: string; content: string }[];
}
interface ReviewOption {
  id: string;
  reviewerLabel: string;
  submittedRevision: { overallComment: string } | null;
}
export function RebuttalPanel({ submission }: { submission: Submission }) {
  const { api, user } = useSession();
  const action = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  const draftRevisionRef = useRef<number | null>(null);
  const [reopen, setReopen] = useState(false);
  const query = useResource<Rebuttal | null>('rebuttal', `/submissions/${submission.id}/rebuttal`);
  const reviews = useResource<{ items: ReviewOption[] }>(
    'reviews',
    `/submissions/${submission.id}/reviews`,
  );
  return (
    <>
      {action.feedback}
      <QueryState query={query}>
        {(rebuttal) => {
          if (!rebuttal)
            return (
              <Section title="Author rebuttal">
                <EmptyState
                  title="The rebuttal window has not opened"
                  description="Your group can respond after reviews are released by the instructor."
                />
              </Section>
            );
          if (draftRevisionRef.current === null) draftRevisionRef.current = rebuttal.revision;
          async function save(finalize = false) {
            const form = formRef.current;
            if (!form || !form.reportValidity() || !rebuttal) return;
            if (
              finalize &&
              !window.confirm(
                'Finalize your group’s rebuttal? Further edits will require the instructor to reopen it.',
              )
            )
              return;
            const f = new FormData(form);
            await action.run(
              async () => {
                const saved = await api.put<{ id: string; revision: number }>(
                  `/submissions/${submission.id}/rebuttal`,
                  {
                    revision: draftRevisionRef.current ?? 0,
                    generalResponse: formText(f, 'generalResponse'),
                    responses: (reviews.data?.items ?? [])
                      .filter((r) => formText(f, `response-${r.id}`))
                      .map((r) => ({ reviewId: r.id, content: formText(f, `response-${r.id}`) })),
                  },
                );
                draftRevisionRef.current = saved.revision;
                if (finalize)
                  await api.post(`/rebuttals/${saved.id}/finalize`, { revision: saved.revision });
                return saved;
              },
              finalize ? 'Rebuttal finalized.' : 'Rebuttal draft saved to the server.',
            );
          }
          return (
            <Section title="Author rebuttal" actions={<StatusBadge status={rebuttal.status} />}>
              <p className="muted small">
                Deadline {dateTime(rebuttal.deadline)}. One shared response for your group.
              </p>
              <form
                ref={formRef}
                key={rebuttal.id}
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <fieldset
                  disabled={!rebuttal.canEdit || action.pending}
                  style={{ border: 0, padding: 0, margin: 0 }}
                >
                  <div className="form-stack">
                    <Field label="General response">
                      <textarea
                        name="generalResponse"
                        maxLength={30000}
                        defaultValue={rebuttal.generalResponse}
                        style={{ minHeight: 160 }}
                      />
                    </Field>
                    {reviews.data?.items
                      .filter((r) => r.submittedRevision)
                      .map((review) => (
                        <div key={review.id} className="panel">
                          <h3>{review.reviewerLabel}</h3>
                          <p className="review-content muted">
                            {review.submittedRevision?.overallComment}
                          </p>
                          <Field label={`Response to ${review.reviewerLabel} (optional)`}>
                            <textarea
                              name={`response-${review.id}`}
                              maxLength={15000}
                              defaultValue={
                                rebuttal.responses.find((r) => r.reviewId === review.id)?.content
                              }
                            />
                          </Field>
                        </div>
                      ))}
                  </div>
                </fieldset>
                {rebuttal.canEdit && (
                  <div className="form-actions">
                    <SpinnerButton type="submit" loading={action.pending} className="secondary">
                      Save draft
                    </SpinnerButton>
                    <SpinnerButton loading={action.pending} onClick={() => void save(true)}>
                      Finalize rebuttal
                    </SpinnerButton>
                  </div>
                )}
              </form>
              {!rebuttal.canEdit && (
                <p className="small muted" style={{ marginTop: 18 }}>
                  This response is read-only.{' '}
                  {rebuttal.finalizedAt ? `Finalized ${dateTime(rebuttal.finalizedAt)}.` : ''}
                </p>
              )}
              {user?.role !== 'STUDENT' && (
                <button className="text-button" onClick={() => setReopen(!reopen)}>
                  Reopen rebuttal
                </button>
              )}
              {reopen && (
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action
                      .run(
                        () =>
                          api.post(`/rebuttals/${rebuttal.id}/reopen`, {
                            reason: formText(f, 'reason'),
                            deadline: formDate(f, 'deadline'),
                            acknowledgePublishedGrade: f.has('acknowledgePublishedGrade'),
                          }),
                        'Rebuttal reopened.',
                      )
                      .then(() => setReopen(false));
                  }}
                >
                  <Field label="Reopening reason">
                    <textarea name="reason" required />
                  </Field>
                  <Field label="New deadline">
                    <input name="deadline" type="datetime-local" required />
                  </Field>
                  <label className="check-field">
                    <input type="checkbox" name="acknowledgePublishedGrade" />I understand that any
                    published grade stays unchanged until explicit regrading.
                  </label>
                  <SpinnerButton type="submit" loading={action.pending}>
                    Reopen response window
                  </SpinnerButton>
                </form>
              )}
            </Section>
          );
        }}
      </QueryState>
    </>
  );
}

interface Message {
  id: string;
  reviewId: string | null;
  content: string;
  createdAt: string;
  authorLabel: string;
}
export function DiscussionPanel({ submissionId }: { submissionId: string }) {
  const { api } = useSession();
  const action = useAction();
  const query = useResource<{ items: Message[] }>(
    'discussion',
    `/submissions/${submissionId}/discussions`,
  );
  const reviews = useResource<{ items: ReviewOption[] }>(
    'reviews',
    `/submissions/${submissionId}/reviews`,
  );
  const [thread, setThread] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      {action.feedback}
      <Section title="Discussion">
        <Field label="Discussion context">
          <select value={thread} onChange={(e) => setThread(e.target.value)}>
            <option value="">Submission discussion</option>
            {reviews.data?.items.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reviewerLabel}
              </option>
            ))}
          </select>
        </Field>
        <QueryState query={query}>
          {(data) => (
            <>
              <div style={{ margin: '20px 0' }}>
                {data.items.filter((m) => (m.reviewId ?? '') === thread).length ? (
                  data.items
                    .filter((m) => (m.reviewId ?? '') === thread)
                    .map((message) => (
                      <article className="list-row" key={message.id}>
                        <span className="avatar">{message.authorLabel.slice(0, 1)}</span>
                        <div className="row-content">
                          <h3>
                            {message.authorLabel}{' '}
                            <span className="muted small">· {dateTime(message.createdAt)}</span>
                          </h3>
                          <p className="review-content">{message.content}</p>
                        </div>
                      </article>
                    ))
                ) : (
                  <EmptyState
                    title="Start a focused discussion"
                    description="Use this space to clarify feedback and discuss the submitted project."
                  />
                )}
              </div>
              <form
                ref={formRef}
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void action
                    .run(
                      () =>
                        api.post(`/submissions/${submissionId}/discussions`, {
                          content: formText(f, 'content'),
                          ...(thread ? { reviewId: thread } : {}),
                        }),
                      'Message posted.',
                    )
                    .then((result) => {
                      if (result) formRef.current?.reset();
                    });
                }}
              >
                <Field label="Your message">
                  <textarea
                    name="content"
                    required
                    maxLength={10000}
                    placeholder="Add a constructive comment…"
                  />
                </Field>
                <div className="form-actions">
                  <SpinnerButton type="submit" loading={action.pending}>
                    Post message
                  </SpinnerButton>
                </div>
              </form>
            </>
          )}
        </QueryState>
      </Section>
    </>
  );
}
