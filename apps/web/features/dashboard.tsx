'use client';

import Link from 'next/link';
import { useSession } from '@/providers/session-provider';
import { PageHeader, Section, EmptyState, StatusBadge } from '@/components/ui';
import Table from '@/components/upstream/Table';
import { useResource, QueryState, dateTime } from './shared';

interface Dashboard {
  offerings: {
    id: string;
    role: string;
    status: string;
    semester: string;
    academicYear: string;
    course: { id: string; code: string; title: string };
  }[];
  projects: {
    id: string;
    title: string;
    group: { id: string; name: string };
    offering: { id: string; semester: string; course: { code: string; title: string } };
  }[];
  upcomingDeadlines: {
    offeringId: string;
    stageId: string;
    stageName: string;
    courseCode: string;
    type: string;
    at: string;
    timezone: string;
  }[];
  assignedReviews: {
    id: string;
    status: string;
    submissionId: string;
    submissionVersionId: string;
    projectTitle: string;
    stageName: string;
    reviewDeadline: string | null;
    timezone: string;
  }[];
  notifications: { unread: number };
  counts: {
    activeOfferings: number;
    assignedReviews: number;
    pendingConflicts: number;
    pendingSimilarity: number;
    gradingQueue: number;
    users?: number;
    courses?: number;
  };
}

export function DashboardPage() {
  const { user } = useSession();
  const query = useResource<Dashboard>('dashboard', '/dashboard');
  const student = user?.role === 'STUDENT';
  const admin = user?.role === 'ADMIN';
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title={`Hello, ${user?.displayName.split(' ')[0] ?? 'there'}.`}
        description="Here’s what’s happening in your workspace."
        actions={
          <span className="muted small">
            {new Intl.DateTimeFormat('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date())}
          </span>
        }
      />
      <QueryState query={query}>
        {(data) => (
          <>
            <div className="stats-grid">
              {[
                {
                  label: admin ? 'User accounts' : 'Active courses',
                  value: admin ? data.counts.users : data.counts.activeOfferings,
                  note: admin ? 'Across the workspace' : 'Your current offerings',
                  icon: '▤',
                  href: admin ? '/admin/users' : '/courses',
                },
                {
                  label: admin ? 'Course catalog' : 'Assigned reviews',
                  value: admin ? data.counts.courses : data.counts.assignedReviews,
                  note: admin ? 'Reusable course identities' : 'Ready for your feedback',
                  icon: '✎',
                  href: admin ? '/admin/courses' : '/reviews',
                },
                {
                  label: student ? 'My projects' : 'Awaiting grades',
                  value: student ? data.projects.length : data.counts.gradingQueue,
                  note: student ? 'Your team’s work' : 'Projects to evaluate',
                  icon: '✓',
                  href: student ? '/projects' : '/grading',
                },
                {
                  label: student ? 'New updates' : 'Similarity queue',
                  value: student ? data.notifications.unread : data.counts.pendingSimilarity,
                  note: student ? 'Unread notifications' : 'Manual checks to complete',
                  icon: '≋',
                  href: student ? '/notifications' : '/similarity-checks',
                },
              ].map((stat) => (
                <Link
                  className="stat-card"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  href={stat.href}
                  key={stat.label}
                >
                  <p className="stat-label">{stat.label}</p>
                  <span className="stat-icon" aria-hidden="true">
                    {stat.icon}
                  </span>
                  <div className="stat-value">{stat.value ?? 0}</div>
                  <p className="stat-note">
                    {stat.note} <span aria-hidden="true">↗</span>
                  </p>
                </Link>
              ))}
            </div>
            <div className="content-grid">
              <div>
                <Section
                  title={student ? 'Your current projects' : 'Course spaces'}
                  actions={
                    <Link href={student ? '/projects' : '/courses'} className="link-arrow">
                      View all →
                    </Link>
                  }
                >
                  {student ? (
                    data.projects.length ? (
                      data.projects.map((project) => (
                        <article
                          className="project-card"
                          style={{ marginBottom: 12 }}
                          key={project.id}
                        >
                          <p className="eyebrow">
                            {project.offering.course.code} · {project.offering.semester}
                          </p>
                          <h3>
                            <Link href={`/projects/${project.id}`}>{project.title}</Link>
                          </h3>
                          <footer>
                            <span className="muted small">{project.group.name}</span>
                            <Link className="link-arrow" href={`/projects/${project.id}`}>
                              Open project →
                            </Link>
                          </footer>
                        </article>
                      ))
                    ) : (
                      <EmptyState
                        title="Your projects will appear here"
                        description="Join a course group to start your first project."
                      />
                    )
                  ) : data.offerings.length ? (
                    data.offerings.map((offering) => (
                      <div className="list-row" key={offering.id}>
                        <span className="avatar">{offering.course.code.slice(0, 2)}</span>
                        <div className="row-content">
                          <h3>
                            <Link href={`/offerings/${offering.id}`}>{offering.course.title}</Link>
                          </h3>
                          <p className="muted">
                            {offering.course.code} · {offering.semester} {offering.academicYear}
                          </p>
                        </div>
                        <StatusBadge status={offering.status} />
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="No active course memberships"
                      description="Create a course offering or use the administration tools to get started."
                    />
                  )}
                </Section>
                <Section
                  title="Reviews assigned to you"
                  actions={
                    <Link className="link-arrow" href="/reviews">
                      All reviews →
                    </Link>
                  }
                >
                  {data.assignedReviews.length ? (
                    <Table
                      caption="Your assigned reviews"
                      headings={[
                        { id: 'project', content: 'Project' },
                        { id: 'deadline', content: 'Due' },
                        { id: 'status', content: 'Status' },
                      ]}
                    >
                      {data.assignedReviews.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            <Link href={`/reviews/${assignment.id}`}>
                              {assignment.projectTitle}
                            </Link>
                            <p>{assignment.stageName}</p>
                          </td>
                          <td className="small">
                            {dateTime(assignment.reviewDeadline, assignment.timezone)}
                          </td>
                          <td>
                            <StatusBadge status={assignment.status} />
                          </td>
                        </tr>
                      ))}
                    </Table>
                  ) : (
                    <EmptyState
                      title="No reviews waiting"
                      description="Your assigned reviews will show up here when they are ready."
                    />
                  )}
                </Section>
              </div>
              <div>
                <Section title="Upcoming deadlines">
                  {data.upcomingDeadlines.length ? (
                    data.upcomingDeadlines.slice(0, 7).map((deadline) => (
                      <div className="list-row" key={`${deadline.stageId}:${deadline.type}`}>
                        <div className="deadline-date">
                          {new Date(deadline.at).getDate()}
                          <small>
                            {new Intl.DateTimeFormat('en', { month: 'short' }).format(
                              new Date(deadline.at),
                            )}
                          </small>
                        </div>
                        <div className="row-content">
                          <h3>
                            <Link href={`/offerings/${deadline.offeringId}`}>
                              {deadline.stageName}
                            </Link>
                          </h3>
                          <p className="muted">
                            {deadline.courseCode} · {deadline.type.toLowerCase()}
                          </p>
                          <p className="muted small">{dateTime(deadline.at, deadline.timezone)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="Room to focus" description="No upcoming course deadlines." />
                  )}
                </Section>
                <Section title="Your next step">
                  <p className="muted small">
                    {student
                      ? 'A helpful review is specific, constructive, and grounded in the rubric. Make room for your teammates’ ideas.'
                      : 'Review assignments and resolve conflicts early so every project receives thoughtful feedback.'}
                  </p>
                  <Link className="link-arrow" href={student ? '/reviews' : '/review-management'}>
                    {student ? 'Go to reviews' : 'Manage review assignments'} →
                  </Link>
                </Section>
              </div>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}
