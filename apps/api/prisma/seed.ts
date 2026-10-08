import { Prisma, PrismaClient } from '@prisma/client';
import { hash, argon2id } from 'argon2';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

/** Stable identifiers let fixtures, API tests and screenshots refer to the same records. */
export function demoId(label: string): string {
  const digest = createHash('sha256').update(`proview-demo:${label}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

const db = new PrismaClient();
const day = 86_400_000;
const base = new Date(process.env.DEMO_SEED_DATE ?? new Date().toISOString());
const at = (offset: number) => new Date(base.getTime() + offset * day);
const id = demoId;

async function main() {
  if (!['local', 'test'].includes(process.env.APP_ENV ?? '') || process.env.SEED_DEMO !== 'true') {
    throw new Error('Demo seed requires APP_ENV=local or test and explicit SEED_DEMO=true. Production is forbidden.');
  }
  if (!Number.isFinite(base.getTime())) throw new Error('DEMO_SEED_DATE must be an ISO date');
  if (await db.auditLog.findUnique({ where: { id: id('seed-complete') } })) {
    console.log('ProView demo already seeded; existing data and passwords were preserved.');
    return;
  }
  const passwordHash = await hash(process.env.DEMO_PASSWORD ?? 'ProViewDemo!2026', { type: argon2id });
  const assetPath = path.join(__dirname, 'assets/demo-report.pdf');
  const pdf = await readFile(assetPath);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  const storageRoot = path.resolve(__dirname, '..', process.env.STORAGE_LOCAL_PATH ?? '../../.data/files');
  await mkdir(path.join(storageRoot, 'demo'), { recursive: true });
  await copyFile(assetPath, path.join(storageRoot, 'demo/report.pdf'));

  await db.$transaction(async (tx) => {
    await tx.user.createMany({ data: [
      { id: id('admin'), email: 'admin@proview.local', username: 'admin', displayName: 'Demo Administrator', role: 'ADMIN', passwordHash },
      { id: id('instructor'), email: 'instructor@proview.local', username: 'instructor', displayName: 'Dr. Minh Nguyen', role: 'INSTRUCTOR', passwordHash },
      ...Array.from({ length: 12 }, (_, i) => ({ id: id(`student${i + 1}`), email: `student${i + 1}@proview.local`, username: `student${i + 1}`, displayName: ['An Nguyen', 'Binh Tran', 'Chi Le', 'Dung Pham', 'Giang Ho', 'Hanh Vo', 'Khanh Do', 'Linh Bui', 'Minh Dao', 'Phuong Vu', 'Quang Dang', 'Trang Mai'][i]!, role: 'STUDENT' as const, passwordHash })),
    ] });
    await tx.course.create({ data: { id: id('course'), code: 'IT3120E', title: 'Systems Analysis and Design', description: 'Course project submission and peer review.' } });
    for (const cohort of ['active', 'past', 'later'] as const) {
      const offset = cohort === 'past' ? -365 : cohort === 'later' ? 180 : 0;
      await tx.courseOffering.create({ data: { id: id(`${cohort}-offering`), courseId: id('course'), semester: cohort === 'past' ? 'Past cohort' : cohort === 'later' ? 'Later cohort' : 'Current cohort', academicYear: String(base.getUTCFullYear() + (cohort === 'past' ? -1 : 0)), termStartAt: at(offset - 30), termEndAt: at(offset + 90), status: cohort === 'past' ? 'CLOSED' : 'ACTIVE', anonymityMode: 'ANONYMOUS_TO_AUTHORS' } });
      await tx.courseMembership.create({ data: { id: id(`${cohort}-instructor`), offeringId: id(`${cohort}-offering`), userId: id('instructor'), role: 'INSTRUCTOR', joinedAt: at(offset - 30) } });
      const students = cohort === 'past' ? [1, 2, 3, 4, 5, 6] : cohort === 'later' ? [10, 11, 12] : Array.from({ length: 12 }, (_, i) => i + 1);
      await tx.courseMembership.createMany({ data: students.map((n) => ({ id: id(`${cohort}-membership-${n}`), offeringId: id(`${cohort}-offering`), userId: id(`student${n}`), role: 'STUDENT' as const, joinedAt: at(offset - 30), endedAt: cohort === 'past' ? at(-240) : null })) });
      await tx.rubric.create({ data: { id: id(`${cohort}-rubric`), offeringId: id(`${cohort}-offering`), name: 'Project quality rubric', description: 'Requirements, architecture, clarity, and validation.' } });
      await tx.rubricRevision.create({ data: { id: id(`${cohort}-rubric-v1`), offeringId: id(`${cohort}-offering`), rubricId: id(`${cohort}-rubric`), revisionNumber: 1, requireRecommendation: true, recommendationOptions: ['STRONG', 'SATISFACTORY', 'NEEDS_REVISION'] } });
      await tx.rubricCriterion.createMany({ data: ['Requirements', 'Architecture', 'Clarity', 'Validation'].map((title, i) => ({ id: id(`${cohort}-criterion-${i + 1}`), rubricRevisionId: id(`${cohort}-rubric-v1`), title, weight: new Prisma.Decimal(i < 2 ? 30 : 20), scoreMin: new Prisma.Decimal(0), scoreMax: new Prisma.Decimal(10), sequence: i + 1, required: true })) });
      await tx.rubricRevision.update({ where: { id: id(`${cohort}-rubric-v1`) }, data: { publishedAt: at(offset - 25) } });
      for (const [n, name] of [[1, 'Proposal'], [2, 'Final Report']] as const) {
        await tx.submissionStage.create({ data: { id: id(`${cohort}-stage-${n}`), offeringId: id(`${cohort}-offering`), rubricRevisionId: id(`${cohort}-rubric-v1`), name, sequence: n, openAt: at(offset - 20), submissionDeadline: at(offset + 7), reviewDeadline: n === 1 ? at(offset + 14) : null, rebuttalDeadline: n === 1 ? at(offset + 21) : null, allowReviews: n === 1, allowRebuttal: n === 1, peerReviewCount: n === 1 ? 2 : 0, requireSimilarityCheck: n === 2 } });
      }
      const count = cohort === 'active' ? 4 : cohort === 'past' ? 2 : 1;
      for (let group = 1; group <= count; group++) {
        const prefix = `${cohort}-group-${group}`;
        await tx.projectGroup.create({ data: { id: id(prefix), offeringId: id(`${cohort}-offering`), name: ['Orbit', 'Atlas', 'Nova', 'Prism'][group - 1]!, membershipLockedAt: cohort === 'past' ? at(-355) : cohort === 'active' && group < 4 ? at(-2) : null } });
        const members = cohort === 'later' ? [10, 11, 12] : [(group - 1) * 3 + 1, (group - 1) * 3 + 2, (group - 1) * 3 + 3];
        await tx.groupMember.createMany({ data: members.map((n) => ({ id: id(`${prefix}-member-${n}`), groupId: id(prefix), offeringId: id(`${cohort}-offering`), userId: id(`student${n}`), membershipId: id(`${cohort}-membership-${n}`), joinedAt: at(offset - 25), leftAt: cohort === 'past' ? at(-240) : null })) });
        await tx.project.create({ data: { id: id(`${prefix}-project`), groupId: id(prefix), offeringId: id(`${cohort}-offering`), title: ['Campus Resource Booking', 'Library Study Planner', 'Community Volunteering Portal', 'Laboratory Inventory'][group - 1]!, description: 'An academic systems analysis project with a documented architecture and validation plan.' } });
      }
    }

    async function submission(cohort: string, group: number, stage: number, status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REBUTTAL_OPEN' | 'FINALIZED', versions = 1) {
      const prefix = `${cohort}-group-${group}`;
      const key = `${prefix}-submission-${stage}`;
      const offset = cohort === 'past' ? -355 : -2;
      await tx.submission.create({ data: { id: id(key), projectId: id(`${prefix}-project`), offeringId: id(`${cohort}-offering`), stageId: id(`${cohort}-stage-${stage}`) } });
      for (let v = 1; v <= versions; v++) {
        const versionId = id(`${key}-v${v}`);
        await tx.submissionVersion.create({ data: { id: versionId, submissionId: id(key), versionNumber: v, uploadedById: id(`student${(group - 1) * 3 + 1}`), uploadedAt: at(offset), changeNote: v === 1 ? 'Initial report' : 'Improved requirements and architecture diagrams', file: { create: { id: id(`${key}-file-${v}`), displayName: `report-v${v}.pdf`, sizeBytes: pdf.length, sha256, storageKey: `demo/${key}-v${v}.pdf`, state: 'READY' } } } });
        await copyFile(assetPath, path.join(storageRoot, `demo/${key}-v${v}.pdf`));
        if (status !== 'DRAFT') {
          await tx.submissionVersionAuthor.createMany({ data: [1, 2, 3].map((n) => { const student = (group - 1) * 3 + n; return { submissionVersionId: versionId, userId: id(`student${student}`), groupMemberId: id(`${prefix}-member-${student}`), capturedAt: at(offset) }; }) });
        }
      }
      await tx.submission.update({ where: { id: id(key) }, data: { status, latestDraftVersionId: id(`${key}-v${versions}`), ...(status !== 'DRAFT' ? { submittedVersionId: id(`${key}-v${versions}`), submittedById: id(`student${(group - 1) * 3 + 1}`), submittedAt: at(offset) } : {}), ...(status === 'UNDER_REVIEW' || status === 'REBUTTAL_OPEN' || status === 'FINALIZED' ? { inputLockedAt: at(offset) } : {}), ...(status === 'REBUTTAL_OPEN' ? { reviewsReleasedAt: at(-1) } : {}), ...(status === 'FINALIZED' ? { finalizedAt: at(offset + 1) } : {}) } });
      return key;
    }
    const proposal = await submission('active', 1, 1, 'REBUTTAL_OPEN', 2);
    const draftReviewSubmission = await submission('active', 2, 1, 'UNDER_REVIEW');
    await submission('active', 3, 1, 'SUBMITTED');
    await submission('active', 4, 1, 'DRAFT');
    const finalPending = await submission('active', 1, 2, 'SUBMITTED', 2);
    const finalCompleted = await submission('active', 2, 2, 'FINALIZED');
    const pastReport = await submission('past', 1, 2, 'FINALIZED');
    const pastHidden = await submission('past', 2, 2, 'FINALIZED');

    async function review(key: string, reviewerGroup: number, aliasNumber: number, submitted: boolean) {
      const assignmentId = id(`${key}-assignment-${reviewerGroup}`);
      const reviewId = id(`${key}-review-${reviewerGroup}`);
      const revisionId = id(`${key}-review-${reviewerGroup}-v1`);
      const versionNumber = key === proposal ? 2 : 1;
      await tx.reviewerAssignment.create({ data: { id: assignmentId, submissionId: id(key), submissionVersionId: id(`${key}-v${versionNumber}`), offeringId: id('active-offering'), rubricRevisionId: id('active-rubric-v1'), reviewCycle: 1, reviewerType: 'GROUP', reviewerGroupId: id(`active-group-${reviewerGroup}`), status: submitted ? 'SUBMITTED' : 'IN_PROGRESS', aliasNumber, assignedById: id('instructor') } });
      await tx.review.create({ data: { id: reviewId, assignmentId, submissionId: id(key), submissionVersionId: id(`${key}-v${versionNumber}`), rubricRevisionId: id('active-rubric-v1'), reviewCycle: 1 } });
      await tx.reviewRevision.create({ data: { id: revisionId, reviewId, rubricRevisionId: id('active-rubric-v1'), revisionNumber: 1, strengths: 'Clear scope and traceable requirements.', weaknesses: 'Include more failure cases in validation.', overallComment: 'A strong starting point with a coherent system design.', recommendation: 'SATISFACTORY', responses: { create: [1, 2, 3, 4].map((n) => ({ criterionId: id(`active-criterion-${n}`), rubricRevisionId: id('active-rubric-v1'), score: new Prisma.Decimal(8), comment: 'Evidence is clear and relevant.' })) } } });
      if (submitted) await tx.reviewRevision.update({ where: { id: revisionId }, data: { status: 'SUBMITTED', submittedById: id(`student${(reviewerGroup - 1) * 3 + 1}`), submittedAt: at(-1) } });
      await tx.review.update({ where: { id: reviewId }, data: submitted ? { submittedRevisionId: revisionId, releasedAt: at(-1) } : { draftRevisionId: revisionId } });
      return reviewId;
    }
    const releasedReview = await review(proposal, 2, 1, true);
    await review(proposal, 3, 2, true);
    await review(draftReviewSubmission, 4, 1, false);
    await tx.rebuttal.create({ data: { id: id('active-rebuttal'), submissionId: id(proposal), reviewCycle: 1, authorId: id('student1'), generalResponse: 'Thank you for the feedback. We added failure cases and clarified the design boundaries.', responses: { create: { reviewId: releasedReview, submissionId: id(proposal), reviewCycle: 1, content: 'The next version will include the requested validation scenarios.' } } } });
    await tx.discussionMessage.create({ data: { id: id('discussion'), submissionId: id(proposal), reviewId: releasedReview, reviewCycle: 1, authorId: id('student4'), content: 'Please connect the test cases to the numbered requirements.' } });

    for (const [key, version, status] of [[finalPending, 1, 'COMPLETED'], [finalPending, 2, 'PENDING'], [finalCompleted, 1, 'COMPLETED'], [pastReport, 1, 'COMPLETED'], [pastHidden, 1, 'WAIVED']] as const) {
      await tx.similarityCheck.create({ data: { id: id(`${key}-similarity-v${version}`), submissionVersionId: id(`${key}-v${version}`), status, ...(status === 'COMPLETED' ? { percentage: new Prisma.Decimal('12.50'), submittedExternallyAt: at(-2), resultDate: at(-1), notes: 'Manual COOPY result: textual similarity only; not an automatic plagiarism finding.', updatedById: id('instructor') } : {}), ...(status === 'WAIVED' ? { reason: 'Historical pilot report predates the similarity process.', updatedById: id('instructor') } : {}) } });
    }
    const gradeId = id('past-grade');
    const gradeRevisionId = id('past-grade-v1');
    await tx.grade.create({ data: { id: gradeId, submissionId: id(pastReport) } });
    await tx.gradeRevision.create({ data: { id: gradeRevisionId, gradeId, submissionId: id(pastReport), submissionVersionId: id(`${pastReport}-v1`), rubricRevisionId: id('past-rubric-v1'), revisionNumber: 1, graderId: id('instructor'), calculatedOverall: new Prisma.Decimal('8.5'), overall: new Prisma.Decimal('8.5'), feedback: 'Strong analysis with clear architecture and useful validation evidence.', scores: { create: [1, 2, 3, 4].map((n) => ({ criterionId: id(`past-criterion-${n}`), rubricRevisionId: id('past-rubric-v1'), score: new Prisma.Decimal('8.5'), comment: 'Good supporting evidence.' })) } } });
    await tx.gradeRevision.update({ where: { id: gradeRevisionId }, data: { status: 'PUBLISHED', publishedAt: at(-250), publishedById: id('instructor') } });
    await tx.grade.update({ where: { id: gradeId }, data: { publishedRevisionId: gradeRevisionId } });
    await tx.archivePublication.createMany({ data: [
      { id: id('past-publication'), projectId: id('past-group-1-project'), submissionId: id(pastReport), submissionVersionId: id(`${pastReport}-v1`), approvedById: id('instructor'), approvedAt: at(-240), allowDownload: false },
      { id: id('past-revoked-publication'), projectId: id('past-group-2-project'), submissionId: id(pastHidden), submissionVersionId: id(`${pastHidden}-v1`), approvedById: id('instructor'), approvedAt: at(-240), revokedById: id('instructor'), revokedAt: at(-230), revokeReason: 'Consent withdrawn for the demonstration archive.', allowDownload: false },
    ] });
    await tx.notification.create({ data: { id: id('notification'), recipientId: id('student1'), type: 'REVIEWS_RELEASED', title: 'Reviews are available', body: 'Your Proposal reviews are ready. You can now write a rebuttal.', targetUrl: `/submissions/${id(proposal)}`, deduplicationKey: 'seed:reviews:student1' } });
    await tx.auditLog.create({ data: { id: id('seed-complete'), actorId: id('admin'), action: 'DEMO_SEEDED', entityType: 'Course', entityId: id('course'), metadata: { demoDate: base.toISOString(), version: 1 } } });
  }, { timeout: 60_000 });
  console.log('Seeded 14 demo accounts, 3 cohorts, 7 projects, versioned PDFs, peer reviews, rebuttal, similarity checks and published archive evidence.');
  console.log('Demo password: the configured DEMO_PASSWORD, or ProViewDemo!2026 when unset. Local/test only.');
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.$disconnect(); });
