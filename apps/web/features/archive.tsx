'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSession } from '@/providers/session-provider';
import type { PageResult } from '@/lib/api/contracts';
import type { Course } from '@/lib/api/domain';
import { PageHeader, Section, EmptyState, StatusBadge } from '@/components/ui';
import PaginationLinks from '@/components/upstream/PaginationLinks';
import { useResource, QueryState, useAction, dateTime, AuthorizedPdf } from './shared';

interface ArchiveOffering {
  id: string;
  semester: string;
  academicYear?: string;
  course: Course;
}
interface ArchiveProject {
  id: string;
  title: string;
  description?: string;
  offering: ArchiveOffering;
  submissions: {
    id: string;
    status?: string;
    stage: { name: string };
    version: { id: string; versionNumber: number; canView?: boolean } | null;
    grade?: { overall: number | null; feedback: string } | null;
  }[];
  publications?: { id: string; submissionVersionId: string; allowDownload: boolean }[];
}
interface Publication {
  id: string;
  project: { id: string; title: string; description: string };
  offering: ArchiveOffering;
  stage: { name: string };
  version: { id: string; versionNumber: number };
  approvedAt: string;
  allowDownload: boolean;
}
export function ArchivePage() {
  const { user, api } = useSession();
  const action = useAction();
  const staff = user?.role !== 'STUDENT';
  const [tab, setTab] = useState(staff ? 'manage' : 'own');
  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState('');
  const [courseId, setCourseId] = useState('');
  const courses = useResource<PageResult<Course>>('courses', '/courses?pageSize=100');
  const [student, setStudent] = useState('');
  const [page, setPage] = useState(1);
  const [pdf, setPdf] = useState<{ path: string; title: string; download: boolean } | null>(null);
  const params = `page=${page}&pageSize=12&search=${encodeURIComponent(search)}&semester=${encodeURIComponent(semester)}${courseId ? `&courseId=${courseId}` : ''}${staff && tab !== 'own' && student ? `&student=${encodeURIComponent(student)}` : ''}`;
  const projects = useResource<PageResult<ArchiveProject>>(
    'archive-projects',
    `/archive/${tab}?${params}`,
    tab !== 'references',
  );
  const references = useResource<PageResult<Publication>>(
    'archive-references',
    `/archive/references?${params}`,
    tab === 'references',
  );
  return (
    <>
      <PageHeader
        eyebrow="WORK THAT LIVES ON"
        title="Project archive"
        description="Revisit your project history and learn from approved work across semesters."
      />
      {action.feedback}
      <div className="tabs">
        {[
          ['own', 'My history'],
          ['references', 'Reference library'],
          ...(staff ? [['manage', 'Publication management']] : []),
        ].map(([value, label]) => (
          <button
            key={value}
            className={`tab ${tab === value ? 'active' : ''}`}
            onClick={() => {
              setTab(value);
              setPage(1);
              setPdf(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filters">
        <select
          className="filter-input"
          aria-label="Archive course"
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All courses</option>
          {courses.data?.items.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} · {course.title}
            </option>
          ))}
        </select>
        <input
          className="filter-input"
          placeholder="Search project title…"
          aria-label="Search archive"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <input
          className="filter-input"
          placeholder="Semester"
          aria-label="Filter semester"
          value={semester}
          onChange={(e) => {
            setSemester(e.target.value);
            setPage(1);
          }}
        />
        {staff && tab !== 'own' && (
          <input
            className="filter-input"
            placeholder="Student name"
            aria-label="Search by student"
            value={student}
            onChange={(e) => {
              setStudent(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>
      {tab === 'references' ? (
        <QueryState query={references}>
          {(data) => (
            <>
              {data.items.length ? (
                <div className="cards-grid">
                  {data.items.map((p) => (
                    <article className="project-card" key={p.id}>
                      <p className="eyebrow">
                        {p.offering.course.code} · {p.offering.semester}
                      </p>
                      <h3>{p.project.title}</h3>
                      <p className="muted small">{p.project.description}</p>
                      <p className="meta">
                        {p.stage.name} · version {p.version.versionNumber} · Approved{' '}
                        {dateTime(p.approvedAt)}
                      </p>
                      <button
                        className="button secondary"
                        onClick={() =>
                          setPdf({
                            path: `/archive/publications/${p.id}/file`,
                            title: p.project.title,
                            download: false,
                          })
                        }
                      >
                        Read report →
                      </button>
                      {p.allowDownload && (
                        <button
                          className="text-button"
                          onClick={() => {
                            void action.run(async () => {
                              const blob = await api.file(`/archive/publications/${p.id}/download`);
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = 'report.pdf';
                              link.click();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                              return true;
                            }, 'Download ready.');
                          }}
                        >
                          Download PDF
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No reference reports available"
                  description="Approved reports from previous offerings of your course appear here when your cohort is eligible."
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
      ) : (
        <QueryState query={projects}>
          {(data) => (
            <>
              {data.items.length ? (
                data.items.map((project) => (
                  <Section key={project.id} title={project.title}>
                    <p className="muted small">
                      {project.offering.course.code} · {project.offering.semester}{' '}
                      {project.offering.academicYear}
                    </p>
                    {project.submissions.map((submission) => {
                      const publication = project.publications?.find(
                        (p) => p.submissionVersionId === submission.version?.id,
                      );
                      return (
                        <div className="list-row" key={submission.id}>
                          <div className="row-content">
                            <h3>
                              <Link href={`/submissions/${submission.id}`}>
                                {submission.stage.name}
                              </Link>
                            </h3>
                            <p className="muted">
                              Version {submission.version?.versionNumber ?? '—'}
                              {submission.grade?.overall !== undefined &&
                              submission.grade?.overall !== null
                                ? ` · Grade ${submission.grade.overall}/10`
                                : ''}
                            </p>
                            {submission.grade?.feedback && (
                              <p className="review-content">{submission.grade.feedback}</p>
                            )}
                            {publication && <StatusBadge status="PUBLISHED" />}
                          </div>
                          <div className="button-row">
                            {tab === 'own' && submission.version?.canView && (
                              <button
                                className="button secondary small"
                                onClick={() =>
                                  setPdf({
                                    path: `/versions/${submission.version!.id}/file`,
                                    title: project.title,
                                    download: true,
                                  })
                                }
                              >
                                View PDF
                              </button>
                            )}
                            {tab === 'manage' && submission.version && (
                              <>
                                {publication ? (
                                  <>
                                    <button
                                      className="button secondary small"
                                      disabled={action.pending}
                                      onClick={() => {
                                        const reason = window.prompt(
                                          'Reason for revoking reference access:',
                                        );
                                        if (reason)
                                          void action.run(
                                            () =>
                                              api.post(
                                                `/archive/publications/${publication.id}/revoke`,
                                                { reason },
                                              ),
                                            'Reference access revoked.',
                                          );
                                      }}
                                    >
                                      Revoke
                                    </button>
                                    <button
                                      className="button secondary small"
                                      disabled={action.pending}
                                      onClick={() =>
                                        void action.run(
                                          () =>
                                            api.post('/archive/publications', {
                                              submissionVersionId: submission.version!.id,
                                              allowDownload: !publication.allowDownload,
                                            }),
                                          'Download policy updated.',
                                        )
                                      }
                                    >
                                      {publication.allowDownload
                                        ? 'Disable downloads'
                                        : 'Allow downloads'}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="button small"
                                    disabled={action.pending}
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          'Publish this report as a reference for eligible later cohorts?',
                                        )
                                      )
                                        void action.run(
                                          () =>
                                            api.post('/archive/publications', {
                                              submissionVersionId: submission.version!.id,
                                              allowDownload: false,
                                            }),
                                          'Reference report published.',
                                        );
                                    }}
                                  >
                                    Approve reference
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Section>
                ))
              ) : (
                <EmptyState
                  title="No archived projects found"
                  description="Projects from closed or archived offerings are shown here."
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
      )}
      {pdf && (
        <Section
          title={pdf.title}
          actions={
            <button className="text-button" onClick={() => setPdf(null)}>
              Close PDF
            </button>
          }
        >
          <AuthorizedPdf path={pdf.path} title={pdf.title} download={pdf.download} />
        </Section>
      )}
    </>
  );
}
