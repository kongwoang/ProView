import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { PolicyService } from '../src/modules/policies/policy.service';
import { DeadlineRemindersService } from '../src/modules/notifications/deadline-reminders.service';
import { RebuttalsService } from '../src/modules/reviews/rebuttals.service';
config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const enabled = process.env.RUN_HTTP_TESTS === 'true';
const base = process.env.API_TEST_URL ?? 'http://127.0.0.1:3001/api/v1';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic HTTP fixtures are inspected by explicit runtime assertions.
type JsonRecord = Record<string, any>; // HTTP test assertions intentionally inspect untrusted, dynamic JSON.

async function request(
  token: string | null,
  url: string,
  method = 'GET',
  body?: unknown,
  expected = 200,
): Promise<JsonRecord> {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      Origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = (await response.json()) as JsonRecord;
  assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(value)}`);
  return value;
}
const login = async (identifier: string) =>
  (
    await request(null, '/auth/login', 'POST', {
      identifier,
      password: process.env.DEMO_PASSWORD ?? 'ProViewDemo!2026',
    })
  ).accessToken as string;

// Real Nest HTTP + PostgreSQL; creates an isolated offering, never edits the demonstration evidence.
test(
  'review workflow: assignment proof/apply, conflicts, anonymous reviews, correction, rebuttal and discussion',
  { skip: !enabled, timeout: 120_000 },
  async () => {
    const db = new PrismaClient();
    try {
      const staff = await login('instructor');
      const tokens = [] as string[];
      for (let n = 1; n <= 5; n++) tokens.push(await login(`student${n}`));
      const instructor = await db.user.findUniqueOrThrow({ where: { username: 'instructor' } });
      const users = await Promise.all(
        [1, 2, 3, 4].map((n) => db.user.findUniqueOrThrow({ where: { username: `student${n}` } })),
      );
      const fixture = await db.$transaction(async (tx) => {
        const now = Date.now();
        const course = await tx.course.findUniqueOrThrow({ where: { code: 'IT3120E' } });
        const offering = await tx.courseOffering.create({
          data: {
            courseId: course.id,
            semester: `Review acceptance ${randomUUID()}`,
            academicYear: '2026',
            termStartAt: new Date(now - 86400_000),
            termEndAt: new Date(now + 60 * 86400_000),
            status: 'ACTIVE',
          },
        });
        await tx.courseMembership.create({
          data: { offeringId: offering.id, userId: instructor.id, role: 'INSTRUCTOR' },
        });
        const rubric = await tx.rubric.create({
          data: { offeringId: offering.id, name: 'Acceptance rubric' },
        });
        const rubricRevision = await tx.rubricRevision.create({
          data: {
            offeringId: offering.id,
            rubricId: rubric.id,
            revisionNumber: 1,
            requireOverallComment: true,
            requireRecommendation: true,
            recommendationOptions: ['SATISFACTORY'],
          },
        });
        const criterion = await tx.rubricCriterion.create({
          data: {
            rubricRevisionId: rubricRevision.id,
            title: 'Evidence',
            weight: 100,
            scoreMin: 0,
            scoreMax: 10,
            sequence: 1,
            requireComment: true,
          },
        });
        await tx.rubricRevision.update({
          where: { id: rubricRevision.id },
          data: { publishedAt: new Date() },
        });
        const stage = await tx.submissionStage.create({
          data: {
            offeringId: offering.id,
            rubricRevisionId: rubricRevision.id,
            name: 'Proposal',
            sequence: 1,
            openAt: new Date(now - 86400_000),
            submissionDeadline: new Date(now + 86400_000),
            reviewDeadline: new Date(now + 2 * 86400_000),
            rebuttalDeadline: new Date(now + 3 * 86400_000),
            peerReviewCount: 1,
          },
        });
        const groups = [],
          submissions = [];
        for (const [index, user] of users.entries()) {
          const membership = await tx.courseMembership.create({
            data: { offeringId: offering.id, userId: user.id, role: 'STUDENT' },
          });
          const group = await tx.projectGroup.create({
            data: {
              offeringId: offering.id,
              name: `Team ${index + 1}`,
              membershipLockedAt: new Date(),
            },
          });
          const member = await tx.groupMember.create({
            data: {
              groupId: group.id,
              offeringId: offering.id,
              membershipId: membership.id,
              userId: user.id,
            },
          });
          const project = await tx.project.create({
            data: {
              offeringId: offering.id,
              groupId: group.id,
              title: `Acceptance report ${index + 1}`,
            },
          });
          const submission = await tx.submission.create({
            data: { offeringId: offering.id, projectId: project.id, stageId: stage.id },
          });
          const version = await tx.submissionVersion.create({
            data: { submissionId: submission.id, versionNumber: 1, uploadedById: user.id },
          });
          await tx.submissionVersionAuthor.create({
            data: { submissionVersionId: version.id, userId: user.id, groupMemberId: member.id },
          });
          await tx.submission.update({
            where: { id: submission.id },
            data: {
              status: 'SUBMITTED',
              submittedVersionId: version.id,
              submittedById: user.id,
              submittedAt: new Date(),
            },
          });
          groups.push(group);
          submissions.push(submission);
        }
        return { offering, stage, criterion, groups, submissions };
      });
      const { offering, stage, groups, submissions, criterion } = fixture;
      await request(
        tokens[0]!,
        `/offerings/${offering.id}/assignment-plans`,
        'POST',
        { stageId: stage.id },
        403,
      );
      const plan = await request(
        staff,
        `/offerings/${offering.id}/assignment-plans`,
        'POST',
        { stageId: stage.id },
        201,
      );
      assert.equal(plan.status, 'READY');
      assert.equal(plan.objective.reciprocalPairs, 0);
      assert.equal(plan.pairs.length, 4);
      await request(staff, `/assignment-plans/${plan.id}/apply`, 'POST', {}, 201);
      const repeat = await request(staff, `/assignment-plans/${plan.id}/apply`, 'POST', {}, 201);
      assert.equal(repeat.alreadyApplied, true);
      const assignments = (await request(staff, `/reviewer-assignments?offeringId=${offering.id}`))
        .items as JsonRecord[];
      assert.equal(assignments.length, 4);
      const assignment = assignments.find((a) => a.submissionId === submissions[0]!.id)!;
      const reviewerIndex = groups.findIndex((g) => g.id === assignment.reviewerGroupId);
      const reviewerToken = tokens[reviewerIndex]!;
      await request(
        tokens[0]!,
        `/reviewer-assignments/${assignment.id}/review`,
        'GET',
        undefined,
        404,
      );
      await request(
        tokens[4]!,
        `/submissions/${submissions[0]!.id}/reviews`,
        'GET',
        undefined,
        404,
      );
      await request(
        staff,
        '/reviewer-assignments',
        'POST',
        { submissionId: submissions[0]!.id, reviewerType: 'GROUP', reviewerGroupId: groups[0]!.id },
        422,
      );
      const conflict = await request(
        reviewerToken,
        `/reviewer-assignments/${assignment.id}/conflicts`,
        'POST',
        { reason: 'Prior collaboration may bias this assessment.' },
        201,
      );
      await request(
        reviewerToken,
        `/reviewer-assignments/${assignment.id}/review`,
        'GET',
        undefined,
        404,
      );
      await request(
        staff,
        `/conflicts/${conflict.id}/decision`,
        'POST',
        { decision: 'REJECTED', note: 'Reviewed the context; participation did not overlap.' },
        201,
      );
      await request(
        staff,
        `/conflicts/${conflict.id}/decision`,
        'POST',
        { decision: 'APPROVED', note: 'Duplicate decision' },
        409,
      );
      const secondConflict = await request(
        reviewerToken,
        `/reviewer-assignments/${assignment.id}/conflicts`,
        'POST',
        { reason: 'New concrete conflict evidence.' },
        201,
      );
      await request(
        staff,
        `/conflicts/${secondConflict.id}/decision`,
        'POST',
        { decision: 'APPROVED', note: 'Reassignment required.' },
        201,
      );
      const replacementIndex = groups.findIndex((g, i) => i !== 0 && i !== reviewerIndex);
      const replacement = await request(
        staff,
        `/reviewer-assignments/${assignment.id}/replacement`,
        'POST',
        {
          submissionId: submissions[0]!.id,
          reviewerType: 'GROUP',
          reviewerGroupId: groups[replacementIndex]!.id,
        },
        201,
      );
      const reviewer = tokens[replacementIndex]!;
      await request(
        reviewerToken,
        `/reviewer-assignments/${assignment.id}/review`,
        'GET',
        undefined,
        404,
      );
      const draft = {
        revision: 0,
        strengths: 'Evidence is traceable.',
        weaknesses: 'More failure scenarios would help.',
        overallComment: 'A clear and testable design.',
        recommendation: 'SATISFACTORY',
        responses: [
          { criterionId: criterion.id, score: 8, comment: 'Good architecture evidence.' },
        ],
      };
      const saved = await request(
        reviewer,
        `/reviewer-assignments/${replacement.id}/review`,
        'PUT',
        draft,
      );
      await request(reviewer, `/reviewer-assignments/${replacement.id}/review`, 'PUT', draft, 409);
      await request(
        reviewer,
        `/reviewer-assignments/${replacement.id}/review`,
        'PUT',
        {
          ...draft,
          revision: saved.revision,
          responses: [{ criterionId: criterion.id, score: 11, comment: 'Invalid score.' }],
        },
        422,
      );
      assert.equal(
        (await request(tokens[0]!, `/submissions/${submissions[0]!.id}/reviews`)).items.length,
        0,
      );
      await request(
        reviewer,
        `/reviews/${saved.id}/submit`,
        'POST',
        { revision: saved.revision },
        201,
      );
      await request(
        reviewer,
        `/reviews/${saved.id}/submit`,
        'POST',
        { revision: saved.revision },
        201,
      );
      await request(
        reviewer,
        `/reviewer-assignments/${replacement.id}/review`,
        'PUT',
        { ...draft, revision: saved.revision },
        409,
      );
      const current = await db.submission.findUniqueOrThrow({ where: { id: submissions[0]!.id } });
      await request(
        staff,
        `/submissions/${current.id}/reviews/release`,
        'POST',
        { revision: current.revision },
        201,
      );
      const visible = await request(tokens[0]!, `/submissions/${current.id}/reviews`);
      assert.equal(visible.items.length, 1);
      assert.match(visible.items[0].reviewerLabel, /^Reviewer /);
      const anonymousJSON = JSON.stringify(visible);
      for (const secret of [
        'reviewerGroupId',
        'reviewerUserId',
        'submittedById',
        'assignmentId',
        groups[replacementIndex]!.id,
        users[replacementIndex]!.id,
      ])
        assert.ok(!anonymousJSON.includes(secret), `anonymous leak: ${secret}`);
      const staffView = await request(staff, `/submissions/${current.id}/reviews`);
      assert.equal(staffView.items[0].reviewerGroupId, groups[replacementIndex]!.id);
      await request(
        reviewer,
        `/submissions/${current.id}/discussions`,
        'POST',
        { reviewId: saved.id, content: 'Please expand the edge-case tests.' },
        201,
      );
      const messages = await request(tokens[0]!, `/submissions/${current.id}/discussions`);
      assert.equal(messages.items[0].authorLabel, `Reviewer ${replacement.aliasNumber}`);
      assert.ok(!JSON.stringify(messages).includes(users[replacementIndex]!.id));
      const rebuttal = await request(tokens[0]!, `/submissions/${current.id}/rebuttal`);
      await request(
        reviewer,
        `/submissions/${current.id}/rebuttal`,
        'PUT',
        { revision: 0, generalResponse: 'Impersonation', responses: [] },
        404,
      );
      const response = await request(tokens[0]!, `/submissions/${current.id}/rebuttal`, 'PUT', {
        revision: rebuttal.revision,
        generalResponse: 'We added the requested test coverage.',
        responses: [{ reviewId: saved.id, content: 'See new boundary cases.' }],
      });
      await request(
        tokens[0]!,
        `/rebuttals/${rebuttal.id}/finalize`,
        'POST',
        { revision: response.revision },
        201,
      );
      await request(
        tokens[0]!,
        `/submissions/${current.id}/rebuttal`,
        'PUT',
        { revision: response.revision, generalResponse: 'Overwrite finalized', responses: [] },
        409,
      );
      await request(
        staff,
        `/rebuttals/${rebuttal.id}/reopen`,
        'POST',
        {
          reason: 'Additional response opportunity',
          deadline: new Date(Date.now() + 86400_000).toISOString(),
          acknowledgePublishedGrade: false,
        },
        201,
      );
      const reopened = await request(tokens[0]!, `/submissions/${current.id}/rebuttal`);
      assert.equal(reopened.history[0].generalResponse, 'We added the requested test coverage.');
      await request(
        staff,
        `/reviews/${saved.id}/correction-authorizations`,
        'POST',
        {
          reason: 'Reviewer requested a factual correction.',
          deadline: new Date(Date.now() + 86400_000).toISOString(),
        },
        201,
      );
      const correction = await request(reviewer, `/reviewer-assignments/${replacement.id}/review`);
      assert.equal(correction.review.submittedRevision.overallComment, draft.overallComment);
      const correctionSaved = await request(
        reviewer,
        `/reviewer-assignments/${replacement.id}/review`,
        'PUT',
        {
          ...draft,
          revision: correction.review.draftRevision.revision,
          overallComment: 'Corrected factual assessment.',
        },
      );
      await request(
        reviewer,
        `/reviews/${saved.id}/submit`,
        'POST',
        { revision: correctionSaved.revision },
        201,
      );
      const history = await request(tokens[0]!, `/reviews/${saved.id}/revisions`);
      assert.equal(history.items.length, 2);
      assert.equal(history.items[0].overallComment, draft.overallComment);
      assert.equal(history.items[1].overallComment, 'Corrected factual assessment.');
      assert.ok(!JSON.stringify(history).includes('submittedById'));
      // A roster/group revision change invalidates a preview rather than silently recomputing its plan.
      const stalePlan = await request(
        staff,
        `/offerings/${offering.id}/assignment-plans`,
        'POST',
        { stageId: stage.id },
        201,
      );
      await db.courseOffering.update({
        where: { id: offering.id },
        data: { revision: { increment: 1 } },
      });
      await request(staff, `/assignment-plans/${stalePlan.id}/apply`, 'POST', {}, 409);
      assert.ok(
        (await db.auditLog.count({ where: { action: 'REVIEW_SUBMITTED', entityId: saved.id } })) ===
          1,
      );
      const temporaryInstructor = await db.user.create({
        data: {
          username: `reviewer_${randomUUID().slice(0, 8)}`,
          email: `reviewer-${randomUUID()}@example.test`,
          displayName: 'Temporary reviewer instructor',
          role: 'INSTRUCTOR',
          passwordHash: instructor.passwordHash,
        },
      });
      const temporaryMembership = await db.courseMembership.create({
        data: { userId: temporaryInstructor.id, offeringId: offering.id, role: 'INSTRUCTOR' },
      });
      const instructorAssignment = await request(
        staff,
        '/reviewer-assignments',
        'POST',
        {
          submissionId: submissions[2]!.id,
          reviewerType: 'INSTRUCTOR',
          reviewerUserId: temporaryInstructor.id,
        },
        201,
      );
      const temporaryToken = await login(temporaryInstructor.username);
      await request(temporaryToken, `/reviewer-assignments/${instructorAssignment.id}/review`);
      await db.courseMembership.update({
        where: { id: temporaryMembership.id },
        data: { endedAt: new Date() },
      });
      await request(
        temporaryToken,
        `/reviewer-assignments/${instructorAssignment.id}/review`,
        'GET',
        undefined,
        404,
      );
      assert.equal((await request(temporaryToken, '/reviewer-assignments')).items.length, 0);
      assert.equal((await request(temporaryToken, '/dashboard')).assignedReviews.length, 0);
      const prisma = db as PrismaService;
      const auditService = new AuditService(prisma);
      const reminder = new DeadlineRemindersService(prisma, auditService);
      const reminderTime = new Date(stage.reviewDeadline!.getTime() - 3600_000);
      await reminder.enqueue(reminderTime);
      await reminder.enqueue(reminderTime);
      const pendingAssignment = assignments.find((a) => a.submissionId !== current.id)!;
      const reminderKey = `review-deadline:${pendingAssignment.id}:${stage.reviewDeadline!.toISOString()}`;
      assert.equal(await db.outboxEvent.count({ where: { idempotencyKey: reminderKey } }), 1);
      await auditService.deliver();
      await auditService.deliver();
      assert.equal(
        await db.notification.count({ where: { deduplicationKey: { startsWith: reminderKey } } }),
        1,
      );
      await db.rebuttal.update({
        where: { id: rebuttal.id },
        data: { reopenUntil: new Date(Date.now() - 1000) },
      });
      const rebuttalService = new RebuttalsService(prisma, new PolicyService(prisma), auditService);
      await rebuttalService.expire();
      await rebuttalService.expire();
      assert.equal(
        (await db.rebuttal.findUniqueOrThrow({ where: { id: rebuttal.id } })).status,
        'EXPIRED',
      );
      assert.equal(await db.rebuttalSnapshot.count({ where: { rebuttalId: rebuttal.id } }), 2);
      assert.equal(
        await db.auditLog.count({ where: { action: 'REBUTTAL_EXPIRED', entityId: rebuttal.id } }),
        1,
      );
      async function waitForHttpLock(tx: Prisma.TransactionClient) {
        for (let attempt = 0; attempt < 100; attempt++) {
          await tx.$executeRaw`SELECT pg_stat_clear_snapshot()`;
          const rows = await tx.$queryRaw<
            { count: bigint }[]
          >`SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FOR UPDATE%'`;
          if (Number(rows[0]!.count) > 0) return;
          await pause(20);
        }
        assert.fail('The real HTTP operation must be waiting for the submission lock');
      }
      const publishTarget = await db.submission.findUniqueOrThrow({
        where: { id: current.id },
        include: { stage: true },
      });
      const pendingGrade = await request(staff, `/submissions/${publishTarget.id}/grade`, 'PUT', {
        revision: 0,
        reviewCycle: publishTarget.reviewCycle,
        submissionVersionId: publishTarget.submittedVersionId,
        rubricRevisionId: publishTarget.stage.rubricRevisionId,
        criterionScores: [{ criterionId: criterion.id, score: 8, comment: 'Exact evidence' }],
      });
      let publishRequest: Promise<JsonRecord> | undefined;
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${publishTarget.id}::uuid FOR UPDATE`;
          publishRequest = request(
            staff,
            `/grades/${pendingGrade.id}/publish`,
            'POST',
            { revision: pendingGrade.draft.revision, gradeRevisionId: pendingGrade.draft.id },
            409,
          );
          void publishRequest.catch(() => undefined);
          await waitForHttpLock(tx);
          await tx.grade.update({
            where: { id: pendingGrade.id },
            data: { draftRevisionId: null },
          });
          await tx.submission.update({
            where: { id: publishTarget.id },
            data: { reviewCycle: { increment: 1 }, revision: { increment: 1 } },
          });
        },
        { timeout: 10_000 },
      );
      await publishRequest;
      assert.equal(
        (await db.gradeRevision.findUniqueOrThrow({ where: { id: pendingGrade.draft.id } })).status,
        'DRAFT',
      );
      // Hold an actual row lock, let HTTP grading wait, then reopen the evidence before it acquires the lock.
      const gradeTarget = await db.submission.findUniqueOrThrow({
        where: { id: submissions[1]!.id },
        include: { stage: true },
      });
      let gradeRequest: Promise<JsonRecord> | undefined;
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Submission" WHERE id = ${gradeTarget.id}::uuid FOR UPDATE`;
          gradeRequest = request(
            staff,
            `/submissions/${gradeTarget.id}/grade`,
            'PUT',
            {
              revision: 0,
              reviewCycle: gradeTarget.reviewCycle,
              submissionVersionId: gradeTarget.submittedVersionId,
              rubricRevisionId: gradeTarget.stage.rubricRevisionId,
              criterionScores: [],
            },
            409,
          );
          void gradeRequest.catch(() => undefined);
          await waitForHttpLock(tx);
          await tx.submission.update({
            where: { id: gradeTarget.id },
            data: {
              status: 'DRAFT',
              submittedVersionId: null,
              inputLockedAt: null,
              reviewCycle: { increment: 1 },
              revision: { increment: 1 },
            },
          });
        },
        { timeout: 10_000 },
      );
      await gradeRequest;
      assert.equal(await db.grade.count({ where: { submissionId: gradeTarget.id } }), 0);
      console.log(`Review HTTP acceptance fixture ${offering.id}: all checks passed.`);
    } finally {
      await db.$disconnect();
    }
  },
);
