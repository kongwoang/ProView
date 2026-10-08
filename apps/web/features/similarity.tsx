'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult } from '@/lib/api/contracts';
import type { Course } from '@/lib/api/domain';
import { PageHeader, Section, Field, EmptyState, StatusBadge } from '@/components/ui';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import Table from '@/components/upstream/Table';
import PaginationLinks from '@/components/upstream/PaginationLinks';
import {
  useResource,
  QueryState,
  useAction,
  dateTime,
  formText,
  formDate,
  AuthorizedPdf,
} from './shared';

interface SimilarityCheck {
  id: string;
  status: string;
  revision: number;
  percentage: number | null;
  resultDate: string | null;
  notes: string;
  reason: string | null;
  version: { id: string; versionNumber: number };
  submissionId: string;
  project: { id: string; title: string };
  stage: { id: string; name: string };
  offering: { id: string; semester: string; course: Course };
  resultFiles: { id: string; displayName: string }[];
}
export function SimilarityPage() {
  const { api } = useSession();
  const action = useAction();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const query = useResource<PageResult<SimilarityCheck>>(
    'similarity',
    `/similarity-checks?page=${page}&pageSize=20${status ? `&status=${status}` : ''}&search=${encodeURIComponent(search)}`,
  );
  const selected = query.data?.items.find((item) => item.id === selectedId);
  return (
    <>
      <PageHeader
        eyebrow="FINAL REPORT QUALITY"
        title="Similarity checks"
        description="Record the results of your manual COOPY workflow for each submitted PDF version."
      />
      {action.feedback}
      <div className="inline-info">
        Download the submitted report, check it in COOPY outside ProView, then record the result
        here. Each check belongs to one exact PDF version.
      </div>
      <div className="filters">
        <input
          className="filter-input"
          placeholder="Search project…"
          aria-label="Search similarity checks"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="filter-input"
          aria-label="Check status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['PENDING', 'SUBMITTED_EXTERNALLY', 'COMPLETED', 'FAILED', 'WAIVED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <Section title="Report queue">
        <QueryState query={query}>
          {(data) => (
            <>
              {data.items.length ? (
                <Table
                  caption="Similarity queue"
                  headings={[
                    { id: 'project', content: 'Project / version' },
                    { id: 'status', content: 'Status' },
                    { id: 'score', content: 'Similarity' },
                    { id: 'actions', content: 'Actions' },
                  ]}
                >
                  {data.items.map((check) => (
                    <tr key={check.id}>
                      <td>
                        <Link prefetch={false} href={`/submissions/${check.submissionId}`}>
                          {check.project.title}
                        </Link>
                        <p>
                          {check.offering.course.code} · {check.stage.name} · v
                          {check.version.versionNumber}
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={check.status} />
                      </td>
                      <td>
                        {check.percentage === null ? '—' : `${check.percentage}%`}
                        <p>{dateTime(check.resultDate)}</p>
                      </td>
                      <td>
                        <button
                          className="button secondary"
                          onClick={() => {
                            setSelectedId(check.id);
                            setPdfPath(null);
                          }}
                        >
                          Manage check
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <EmptyState
                  title="No reports in this queue"
                  description="Final reports that require a similarity check appear here after submission."
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
      {selected && (
        <Section
          title={`${selected.project.title} · version ${selected.version.versionNumber}`}
          actions={
            <button
              className="text-button"
              onClick={() => {
                setSelectedId(null);
                setPdfPath(null);
              }}
            >
              Close
            </button>
          }
        >
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => setPdfPath(`/versions/${selected.version.id}/file`)}
            >
              View submitted PDF
            </button>
            {selected.status === 'PENDING' && (
              <SpinnerButton
                loading={action.pending}
                onClick={() =>
                  void action.run(
                    () =>
                      api.post(`/similarity-checks/${selected.id}/mark-external`, {
                        revision: selected.revision,
                      }),
                    'Marked as submitted externally.',
                  )
                }
              >
                Mark submitted to COOPY
              </SpinnerButton>
            )}
          </div>
          <form
            className="form-stack"
            key={`${selected.id}:${selected.revision}`}
            style={{ marginTop: 22 }}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const operation = formText(f, 'operation');
              if (window.confirm(`Record this similarity check as ${operation}?`))
                void action.run(
                  () =>
                    api.post(`/similarity-checks/${selected.id}/${operation}`, {
                      revision: selected.revision,
                      ...(formText(f, 'percentage')
                        ? { percentage: Number(formText(f, 'percentage')) }
                        : {}),
                      ...(formDate(f, 'resultDate')
                        ? { resultDate: formDate(f, 'resultDate') }
                        : {}),
                      notes: formText(f, 'notes'),
                      reason: formText(f, 'reason'),
                    }),
                  'Similarity check updated.',
                );
            }}
          >
            <div className="form-grid">
              <Field label="Action">
                <select name="operation">
                  <option value="complete">Complete result</option>
                  <option value="fail">Record failure</option>
                  <option value="waive">Waive requirement</option>
                  <option value="retry">Retry check</option>
                </select>
              </Field>
              <Field label="Similarity percentage">
                <input
                  name="percentage"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={selected.percentage ?? ''}
                />
              </Field>
              <Field label="Result date">
                <input name="resultDate" type="datetime-local" />
              </Field>
              <Field label="Reason (required for failure, waiver, retry)">
                <input name="reason" defaultValue={selected.reason ?? ''} />
              </Field>
            </div>
            <Field label="Notes">
              <textarea name="notes" defaultValue={selected.notes} />
            </Field>
            <SpinnerButton type="submit" loading={action.pending}>
              Record action
            </SpinnerButton>
          </form>
          <hr />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void action.run(
                () =>
                  api.request(`/similarity-checks/${selected.id}/result-files`, {
                    method: 'POST',
                    body: form,
                  }),
                'Result PDF attached.',
              );
            }}
          >
            <Field label="Attach COOPY result PDF">
              <input name="file" type="file" accept="application/pdf,.pdf" required />
            </Field>
            <SpinnerButton type="submit" loading={action.pending}>
              Attach result
            </SpinnerButton>
          </form>
          {selected.resultFiles.map((file) => (
            <div className="list-row" key={file.id}>
              <div className="row-content">{file.displayName}</div>
              <button
                className="text-button"
                onClick={() =>
                  setPdfPath(`/similarity-checks/${selected.id}/result-files/${file.id}/file`)
                }
              >
                View result
              </button>
            </div>
          ))}
          {pdfPath && (
            <div style={{ marginTop: 20 }}>
              <AuthorizedPdf path={pdfPath} title={selected.project.title} download />
            </div>
          )}
        </Section>
      )}
    </>
  );
}
