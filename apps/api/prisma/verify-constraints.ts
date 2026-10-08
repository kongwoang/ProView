import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const db = new PrismaClient();

async function main() {
  if (!['local', 'test'].includes(process.env.APP_ENV ?? ''))
    throw new Error('Constraint verification is restricted to local/test databases.');
  let passed = 0;
  async function rejected(label: string, query: string) {
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(query);
        throw new Error(`FAILED: ${label} was accepted by PostgreSQL`);
      }),
      (error: unknown) =>
        error instanceof Error &&
        !error.message.startsWith('FAILED:') &&
        /23514|23503|23505/.test(error.message),
      label,
    );
    passed += 1;
  }
  await rejected(
    'Normalized usernames',
    `UPDATE "User" SET username = ' STUDENT1 ' WHERE username = 'student1'`,
  );
  await rejected(
    'Published rubric immutable',
    `UPDATE "RubricCriterion" SET weight = 99 WHERE id = (SELECT id FROM "RubricCriterion" LIMIT 1)`,
  );
  await rejected(
    'Submission versions immutable',
    `UPDATE "SubmissionVersion" SET "changeNote" = 'rewritten' WHERE id = (SELECT id FROM "SubmissionVersion" LIMIT 1)`,
  );
  await rejected(
    'Ready PDF metadata immutable',
    `UPDATE "SubmissionFile" SET "storageKey" = 'other.pdf' WHERE id = (SELECT id FROM "SubmissionFile" LIMIT 1)`,
  );
  await rejected(
    'Cross-submission version pointer',
    `UPDATE "Submission" s SET "latestDraftVersionId" = (SELECT v.id FROM "SubmissionVersion" v WHERE v."submissionId" <> s.id AND NOT EXISTS (SELECT 1 FROM "Submission" other WHERE other."latestDraftVersionId" = v.id) LIMIT 1) WHERE s.id = (SELECT id FROM "Submission" WHERE "status" = 'DRAFT' LIMIT 1)`,
  );
  await rejected(
    'Published review immutable',
    `UPDATE "ReviewRevision" SET "overallComment" = 'rewritten' WHERE "status" = 'SUBMITTED'`,
  );
  await rejected(
    'Published review scores immutable',
    `UPDATE "ReviewCriterionResponse" r SET score = 9 FROM "ReviewRevision" v WHERE r."reviewRevisionId" = v.id AND v.status = 'SUBMITTED'`,
  );
  await rejected(
    'Draft criterion score in range',
    `UPDATE "ReviewCriterionResponse" r SET score = 11 FROM "ReviewRevision" v WHERE r."reviewRevisionId" = v.id AND v.status = 'DRAFT'`,
  );
  await rejected(
    'Published grade immutable',
    `UPDATE "GradeRevision" SET overall = 9 WHERE status = 'PUBLISHED'`,
  );
  await rejected(
    'Similarity percentage in range',
    `UPDATE "SimilarityCheck" SET percentage = 101 WHERE status = 'PENDING'`,
  );
  await rejected(
    'Waiver must carry reason',
    `UPDATE "SimilarityCheck" SET status = 'WAIVED', reason = NULL WHERE status = 'PENDING'`,
  );
  await rejected(
    'Reviewer target XOR',
    `UPDATE "ReviewerAssignment" SET "reviewerUserId" = (SELECT id FROM "User" WHERE username = 'instructor') WHERE "reviewerType" = 'GROUP'`,
  );
  await rejected(
    'Member offering context',
    `UPDATE "GroupMember" SET "offeringId" = (SELECT id FROM "CourseOffering" WHERE semester = 'Later cohort') WHERE id = (SELECT m.id FROM "GroupMember" m JOIN "CourseOffering" o ON o.id = m."offeringId" WHERE o.semester = 'Current cohort' LIMIT 1)`,
  );
  await rejected(
    'One active group per offering',
    `INSERT INTO "GroupMember" (id, "groupId", "membershipId", "offeringId", "userId", "membershipRole", "joinedAt") SELECT gen_random_uuid(), "groupId", "membershipId", "offeringId", "userId", "membershipRole", "joinedAt" FROM "GroupMember" WHERE "leftAt" IS NULL LIMIT 1`,
  );
  await rejected(
    'One active course membership',
    `INSERT INTO "CourseMembership" (id, "offeringId", "userId", role, "joinedAt") SELECT gen_random_uuid(), "offeringId", "userId", role, "joinedAt" FROM "CourseMembership" WHERE "endedAt" IS NULL LIMIT 1`,
  );
  await rejected(
    'Archive exact project/version context',
    `UPDATE "ArchivePublication" p SET "submissionVersionId" = (SELECT v.id FROM "SubmissionVersion" v WHERE v."submissionId" <> p."submissionId" LIMIT 1) WHERE p."revokedAt" IS NULL`,
  );
  await rejected(
    'Audit append-only',
    `UPDATE "AuditLog" SET action = 'REWRITTEN' WHERE action = 'DEMO_SEEDED'`,
  );
  const currentFinal = await db.submission.findFirstOrThrow({
    where: {
      project: { group: { name: 'Orbit', offering: { semester: 'Current cohort' } } },
      stage: { name: 'Final Report' },
    },
    include: {
      versions: { include: { similarityCheck: true }, orderBy: { versionNumber: 'asc' } },
    },
  });
  assert.equal(currentFinal.versions[0]?.similarityCheck?.status, 'COMPLETED');
  assert.equal(currentFinal.versions[1]?.similarityCheck?.status, 'PENDING');
  assert.equal(currentFinal.submittedVersionId, currentFinal.versions[1]?.id);
  console.log(`PASS: ${passed} PostgreSQL rejection tests plus exact-version similarity fixture.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
