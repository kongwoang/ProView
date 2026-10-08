-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('INSTRUCTOR', 'STUDENT');

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnonymityMode" AS ENUM ('NAMED', 'ANONYMOUS_TO_AUTHORS');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REBUTTAL_OPEN', 'REVIEW_COMPLETED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "FileState" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewerType" AS ENUM ('GROUP', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED', 'REASSIGNMENT_APPROVED', 'REASSIGNED', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConflictStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "RebuttalStatus" AS ENUM ('DRAFT', 'FINALIZED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SimilarityStatus" AS ENUM ('PENDING', 'SUBMITTED_EXTERNALLY', 'COMPLETED', 'FAILED', 'WAIVED');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('READY', 'INFEASIBLE', 'TIME_LIMIT', 'APPLIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "parentId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "rotatedAt" TIMESTAMPTZ(3),
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "semester" VARCHAR(80) NOT NULL,
    "academicYear" VARCHAR(32) NOT NULL,
    "termStartAt" TIMESTAMPTZ(3) NOT NULL,
    "termEndAt" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "anonymityMode" "AnonymityMode" NOT NULL DEFAULT 'ANONYMOUS_TO_AUTHORS',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMembership" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectGroup" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "membershipLockedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "membershipRole" "MembershipRole" NOT NULL DEFAULT 'STUDENT',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),
    "changeReason" TEXT,
    "changedById" UUID,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricRevision" (
    "id" UUID NOT NULL,
    "rubricId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "requireRecommendation" BOOLEAN NOT NULL DEFAULT false,
    "recommendationOptions" JSONB NOT NULL DEFAULT '[]',
    "requireOverallComment" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "weight" DECIMAL(8,4) NOT NULL,
    "scoreMin" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "scoreMax" DECIMAL(8,4) NOT NULL DEFAULT 10,
    "sequence" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "requireComment" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionStage" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "openAt" TIMESTAMPTZ(3) NOT NULL,
    "submissionDeadline" TIMESTAMPTZ(3) NOT NULL,
    "reviewDeadline" TIMESTAMPTZ(3),
    "rebuttalDeadline" TIMESTAMPTZ(3),
    "allowReviews" BOOLEAN NOT NULL DEFAULT true,
    "allowRebuttal" BOOLEAN NOT NULL DEFAULT true,
    "requireSimilarityCheck" BOOLEAN NOT NULL DEFAULT false,
    "peerReviewCount" INTEGER NOT NULL DEFAULT 2,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SubmissionStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "latestDraftVersionId" UUID,
    "submittedVersionId" UUID,
    "submittedById" UUID,
    "submittedAt" TIMESTAMPTZ(3),
    "inputLockedAt" TIMESTAMPTZ(3),
    "reviewsReleasedAt" TIMESTAMPTZ(3),
    "finalizedAt" TIMESTAMPTZ(3),
    "reopenUntil" TIMESTAMPTZ(3),
    "reviewCycle" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersion" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "uploadedById" UUID NOT NULL,
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeNote" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersionAuthor" (
    "id" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "groupMemberId" UUID NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionVersionAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionFile" (
    "id" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "state" "FileState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewerAssignment" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "reviewCycle" INTEGER NOT NULL,
    "reviewerType" "ReviewerType" NOT NULL,
    "reviewerGroupId" UUID,
    "reviewerUserId" UUID,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "aliasNumber" INTEGER NOT NULL,
    "previousAssignmentId" UUID,
    "assignedById" UUID NOT NULL,
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReviewerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictOfInterestDeclaration" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "declaredById" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ConflictStatus" NOT NULL DEFAULT 'PENDING',
    "previousAssignmentStatus" "AssignmentStatus" NOT NULL,
    "decidedById" UUID,
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictOfInterestDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "reviewCycle" INTEGER NOT NULL,
    "draftRevisionId" UUID,
    "submittedRevisionId" UUID,
    "releasedAt" TIMESTAMPTZ(3),
    "supersededAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRevision" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "strengths" TEXT NOT NULL DEFAULT '',
    "weaknesses" TEXT NOT NULL DEFAULT '',
    "overallComment" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT,
    "submittedById" UUID,
    "submittedAt" TIMESTAMPTZ(3),
    "correctionReason" TEXT,
    "correctionAuthorizedById" UUID,
    "correctionDeadline" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReviewRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewCriterionResponse" (
    "id" UUID NOT NULL,
    "reviewRevisionId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ReviewCriterionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rebuttal" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "reviewCycle" INTEGER NOT NULL,
    "generalResponse" TEXT NOT NULL DEFAULT '',
    "status" "RebuttalStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" UUID NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3),
    "reopenUntil" TIMESTAMPTZ(3),
    "reopenReason" TEXT,
    "reopenedById" UUID,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Rebuttal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebuttalReviewResponse" (
    "id" UUID NOT NULL,
    "rebuttalId" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "reviewCycle" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "RebuttalReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionMessage" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "reviewId" UUID,
    "reviewCycle" INTEGER NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimilarityCheck" (
    "id" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "status" "SimilarityStatus" NOT NULL DEFAULT 'PENDING',
    "percentage" DECIMAL(5,2),
    "resultDate" TIMESTAMPTZ(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "reason" TEXT,
    "submittedExternallyAt" TIMESTAMPTZ(3),
    "updatedById" UUID,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SimilarityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimilarityCheckHistory" (
    "id" UUID NOT NULL,
    "similarityCheckId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "SimilarityStatus" NOT NULL,
    "percentage" DECIMAL(5,2),
    "resultDate" TIMESTAMPTZ(3),
    "notes" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilarityCheckHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimilarityResultFile" (
    "id" UUID NOT NULL,
    "similarityCheckId" UUID NOT NULL,
    "displayName" VARCHAR(255) NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "state" "FileState" NOT NULL DEFAULT 'PENDING',
    "uploadedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimilarityResultFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "draftRevisionId" UUID,
    "publishedRevisionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeRevision" (
    "id" UUID NOT NULL,
    "gradeId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "status" "GradeStatus" NOT NULL DEFAULT 'DRAFT',
    "calculatedOverall" DECIMAL(5,2),
    "overall" DECIMAL(5,2),
    "overrideReason" TEXT,
    "feedback" TEXT NOT NULL DEFAULT '',
    "graderId" UUID NOT NULL,
    "publishedById" UUID,
    "publishedAt" TIMESTAMPTZ(3),
    "correctionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GradeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeCriterionScore" (
    "id" UUID NOT NULL,
    "gradeRevisionId" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "rubricRevisionId" UUID NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "GradeCriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivePublication" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "submissionVersionId" UUID NOT NULL,
    "approvedById" UUID NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedById" UUID,
    "revokeReason" TEXT,
    "allowDownload" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArchivePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" VARCHAR(100) NOT NULL,
    "requestId" VARCHAR(100),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseOwner" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "scope" VARCHAR(200) NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentPlan" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "status" "PlanStatus" NOT NULL,
    "snapshotHash" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "appliedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AssignmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportPreview" (
    "id" UUID NOT NULL,
    "offeringId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "offeringRevision" INTEGER NOT NULL,
    "inputHash" VARCHAR(64) NOT NULL,
    "rows" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "committedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RosterImportPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_parentId_key" ON "AuthSession"("parentId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_idx" ON "AuthSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_familyId_idx" ON "AuthSession"("familyId");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_code_key" ON "Course"("code");

-- CreateIndex
CREATE INDEX "CourseOffering_courseId_status_termStartAt_idx" ON "CourseOffering"("courseId", "status", "termStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_courseId_semester_academicYear_key" ON "CourseOffering"("courseId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "CourseMembership_userId_endedAt_idx" ON "CourseMembership"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "CourseMembership_offeringId_role_endedAt_idx" ON "CourseMembership"("offeringId", "role", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMembership_id_offeringId_role_userId_key" ON "CourseMembership"("id", "offeringId", "role", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroup_offeringId_name_key" ON "ProjectGroup"("offeringId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectGroup_id_offeringId_key" ON "ProjectGroup"("id", "offeringId");

-- CreateIndex
CREATE INDEX "GroupMember_groupId_leftAt_idx" ON "GroupMember"("groupId", "leftAt");

-- CreateIndex
CREATE INDEX "GroupMember_membershipId_idx" ON "GroupMember"("membershipId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_offeringId_idx" ON "GroupMember"("userId", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_groupId_key" ON "Project"("groupId");

-- CreateIndex
CREATE INDEX "Project_offeringId_idx" ON "Project"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_offeringId_key" ON "Project"("id", "offeringId");

-- CreateIndex
CREATE INDEX "Rubric_offeringId_idx" ON "Rubric"("offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_id_offeringId_key" ON "Rubric"("id", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricRevision_rubricId_revisionNumber_key" ON "RubricRevision"("rubricId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RubricRevision_id_offeringId_key" ON "RubricRevision"("id", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCriterion_rubricRevisionId_sequence_key" ON "RubricCriterion"("rubricRevisionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCriterion_id_rubricRevisionId_key" ON "RubricCriterion"("id", "rubricRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionStage_offeringId_sequence_key" ON "SubmissionStage"("offeringId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionStage_id_offeringId_key" ON "SubmissionStage"("id", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_latestDraftVersionId_key" ON "Submission"("latestDraftVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_submittedVersionId_key" ON "Submission"("submittedVersionId");

-- CreateIndex
CREATE INDEX "Submission_stageId_status_idx" ON "Submission"("stageId", "status");

-- CreateIndex
CREATE INDEX "Submission_offeringId_status_idx" ON "Submission"("offeringId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_projectId_stageId_key" ON "Submission"("projectId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_id_offeringId_key" ON "Submission"("id", "offeringId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_id_projectId_key" ON "Submission"("id", "projectId");

-- CreateIndex
CREATE INDEX "SubmissionVersion_uploadedById_idx" ON "SubmissionVersion"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_submissionId_versionNumber_key" ON "SubmissionVersion"("submissionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersion_id_submissionId_key" ON "SubmissionVersion"("id", "submissionId");

-- CreateIndex
CREATE INDEX "SubmissionVersionAuthor_userId_idx" ON "SubmissionVersionAuthor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionVersionAuthor_submissionVersionId_userId_key" ON "SubmissionVersionAuthor"("submissionVersionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_submissionVersionId_key" ON "SubmissionFile"("submissionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionFile_storageKey_key" ON "SubmissionFile"("storageKey");

-- CreateIndex
CREATE INDEX "SubmissionFile_state_createdAt_idx" ON "SubmissionFile"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerAssignment_previousAssignmentId_key" ON "ReviewerAssignment"("previousAssignmentId");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_reviewerGroupId_status_idx" ON "ReviewerAssignment"("reviewerGroupId", "status");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_reviewerUserId_status_idx" ON "ReviewerAssignment"("reviewerUserId", "status");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_offeringId_status_idx" ON "ReviewerAssignment"("offeringId", "status");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_submissionVersionId_idx" ON "ReviewerAssignment"("submissionVersionId");

-- CreateIndex
CREATE INDEX "ReviewerAssignment_rubricRevisionId_idx" ON "ReviewerAssignment"("rubricRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerAssignment_submissionId_reviewCycle_aliasNumber_key" ON "ReviewerAssignment"("submissionId", "reviewCycle", "aliasNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewerAssignment_id_submissionId_submissionVersionId_rubr_key" ON "ReviewerAssignment"("id", "submissionId", "submissionVersionId", "rubricRevisionId", "reviewCycle");

-- CreateIndex
CREATE INDEX "ConflictOfInterestDeclaration_assignmentId_idx" ON "ConflictOfInterestDeclaration"("assignmentId");

-- CreateIndex
CREATE INDEX "ConflictOfInterestDeclaration_status_createdAt_idx" ON "ConflictOfInterestDeclaration"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_assignmentId_key" ON "Review"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_draftRevisionId_key" ON "Review"("draftRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_submittedRevisionId_key" ON "Review"("submittedRevisionId");

-- CreateIndex
CREATE INDEX "Review_submissionId_reviewCycle_idx" ON "Review"("submissionId", "reviewCycle");

-- CreateIndex
CREATE UNIQUE INDEX "Review_id_submissionId_reviewCycle_key" ON "Review"("id", "submissionId", "reviewCycle");

-- CreateIndex
CREATE UNIQUE INDEX "Review_id_rubricRevisionId_key" ON "Review"("id", "rubricRevisionId");

-- CreateIndex
CREATE INDEX "ReviewRevision_rubricRevisionId_idx" ON "ReviewRevision"("rubricRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_reviewId_revisionNumber_key" ON "ReviewRevision"("reviewId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_id_reviewId_key" ON "ReviewRevision"("id", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRevision_id_rubricRevisionId_key" ON "ReviewRevision"("id", "rubricRevisionId");

-- CreateIndex
CREATE INDEX "ReviewCriterionResponse_criterionId_idx" ON "ReviewCriterionResponse"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCriterionResponse_reviewRevisionId_criterionId_key" ON "ReviewCriterionResponse"("reviewRevisionId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "Rebuttal_submissionId_reviewCycle_key" ON "Rebuttal"("submissionId", "reviewCycle");

-- CreateIndex
CREATE UNIQUE INDEX "Rebuttal_id_submissionId_reviewCycle_key" ON "Rebuttal"("id", "submissionId", "reviewCycle");

-- CreateIndex
CREATE INDEX "RebuttalReviewResponse_reviewId_idx" ON "RebuttalReviewResponse"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "RebuttalReviewResponse_rebuttalId_reviewId_key" ON "RebuttalReviewResponse"("rebuttalId", "reviewId");

-- CreateIndex
CREATE INDEX "DiscussionMessage_submissionId_reviewCycle_createdAt_idx" ON "DiscussionMessage"("submissionId", "reviewCycle", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionMessage_reviewId_idx" ON "DiscussionMessage"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarityCheck_submissionVersionId_key" ON "SimilarityCheck"("submissionVersionId");

-- CreateIndex
CREATE INDEX "SimilarityCheck_status_createdAt_idx" ON "SimilarityCheck"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarityCheckHistory_similarityCheckId_revision_key" ON "SimilarityCheckHistory"("similarityCheckId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarityResultFile_storageKey_key" ON "SimilarityResultFile"("storageKey");

-- CreateIndex
CREATE INDEX "SimilarityResultFile_similarityCheckId_createdAt_idx" ON "SimilarityResultFile"("similarityCheckId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_submissionId_key" ON "Grade"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_draftRevisionId_key" ON "Grade"("draftRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_publishedRevisionId_key" ON "Grade"("publishedRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_id_submissionId_key" ON "Grade"("id", "submissionId");

-- CreateIndex
CREATE INDEX "GradeRevision_submissionVersionId_idx" ON "GradeRevision"("submissionVersionId");

-- CreateIndex
CREATE INDEX "GradeRevision_rubricRevisionId_idx" ON "GradeRevision"("rubricRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRevision_gradeId_revisionNumber_key" ON "GradeRevision"("gradeId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRevision_id_gradeId_key" ON "GradeRevision"("id", "gradeId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeRevision_id_rubricRevisionId_key" ON "GradeRevision"("id", "rubricRevisionId");

-- CreateIndex
CREATE INDEX "GradeCriterionScore_criterionId_idx" ON "GradeCriterionScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeCriterionScore_gradeRevisionId_criterionId_key" ON "GradeCriterionScore"("gradeRevisionId", "criterionId");

-- CreateIndex
CREATE INDEX "ArchivePublication_projectId_revokedAt_idx" ON "ArchivePublication"("projectId", "revokedAt");

-- CreateIndex
CREATE INDEX "ArchivePublication_submissionVersionId_idx" ON "ArchivePublication"("submissionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx" ON "Notification"("recipientId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_idempotencyKey_key" ON "OutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_availableAt_leaseUntil_idx" ON "OutboxEvent"("processedAt", "availableAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_scope_key_key" ON "IdempotencyRecord"("actorId", "scope", "key");

-- CreateIndex
CREATE INDEX "AssignmentPlan_offeringId_createdAt_idx" ON "AssignmentPlan"("offeringId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentPlan_stageId_idx" ON "AssignmentPlan"("stageId");

-- CreateIndex
CREATE INDEX "RosterImportPreview_offeringId_createdAt_idx" ON "RosterImportPreview"("offeringId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AuthSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectGroup" ADD CONSTRAINT "ProjectGroup_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CourseMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricRevision" ADD CONSTRAINT "RubricRevision_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricRevisionId_fkey" FOREIGN KEY ("rubricRevisionId") REFERENCES "RubricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionStage" ADD CONSTRAINT "SubmissionStage_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionStage" ADD CONSTRAINT "SubmissionStage_rubricRevisionId_fkey" FOREIGN KEY ("rubricRevisionId") REFERENCES "RubricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SubmissionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_latestDraftVersionId_fkey" FOREIGN KEY ("latestDraftVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedVersionId_fkey" FOREIGN KEY ("submittedVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersionAuthor" ADD CONSTRAINT "SubmissionVersionAuthor_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_rubricRevisionId_fkey" FOREIGN KEY ("rubricRevisionId") REFERENCES "RubricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_reviewerGroupId_fkey" FOREIGN KEY ("reviewerGroupId") REFERENCES "ProjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_previousAssignmentId_fkey" FOREIGN KEY ("previousAssignmentId") REFERENCES "ReviewerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictOfInterestDeclaration" ADD CONSTRAINT "ConflictOfInterestDeclaration_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ReviewerAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "ReviewRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_submittedRevisionId_fkey" FOREIGN KEY ("submittedRevisionId") REFERENCES "ReviewRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_rubricRevisionId_fkey" FOREIGN KEY ("rubricRevisionId") REFERENCES "RubricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCriterionResponse" ADD CONSTRAINT "ReviewCriterionResponse_reviewRevisionId_fkey" FOREIGN KEY ("reviewRevisionId") REFERENCES "ReviewRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewCriterionResponse" ADD CONSTRAINT "ReviewCriterionResponse_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rebuttal" ADD CONSTRAINT "Rebuttal_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuttalReviewResponse" ADD CONSTRAINT "RebuttalReviewResponse_rebuttalId_fkey" FOREIGN KEY ("rebuttalId") REFERENCES "Rebuttal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebuttalReviewResponse" ADD CONSTRAINT "RebuttalReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarityCheck" ADD CONSTRAINT "SimilarityCheck_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarityCheckHistory" ADD CONSTRAINT "SimilarityCheckHistory_similarityCheckId_fkey" FOREIGN KEY ("similarityCheckId") REFERENCES "SimilarityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimilarityResultFile" ADD CONSTRAINT "SimilarityResultFile_similarityCheckId_fkey" FOREIGN KEY ("similarityCheckId") REFERENCES "SimilarityCheck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "GradeRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "GradeRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_rubricRevisionId_fkey" FOREIGN KEY ("rubricRevisionId") REFERENCES "RubricRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCriterionScore" ADD CONSTRAINT "GradeCriterionScore_gradeRevisionId_fkey" FOREIGN KEY ("gradeRevisionId") REFERENCES "GradeRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeCriterionScore" ADD CONSTRAINT "GradeCriterionScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivePublication" ADD CONSTRAINT "ArchivePublication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivePublication" ADD CONSTRAINT "ArchivePublication_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "SubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentPlan" ADD CONSTRAINT "AssignmentPlan_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentPlan" ADD CONSTRAINT "AssignmentPlan_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "SubmissionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportPreview" ADD CONSTRAINT "RosterImportPreview_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "CourseOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "user_normalized_keys" CHECK ("email" = lower(btrim("email")) AND "username" = lower(btrim("username")) AND length("username") > 0);

ALTER TABLE "CourseOffering" ADD CONSTRAINT "offering_term_order" CHECK ("termStartAt" < "termEndAt");

ALTER TABLE "CourseMembership" ADD CONSTRAINT "membership_interval" CHECK ("endedAt" IS NULL OR "endedAt" >= "joinedAt");

ALTER TABLE "GroupMember" ADD CONSTRAINT "group_member_student" CHECK ("membershipRole" = 'STUDENT');

ALTER TABLE "GroupMember" ADD CONSTRAINT "group_member_interval" CHECK ("leftAt" IS NULL OR "leftAt" >= "joinedAt");

ALTER TABLE "RubricRevision" ADD CONSTRAINT "rubric_revision_positive" CHECK ("revisionNumber" > 0);

ALTER TABLE "RubricCriterion" ADD CONSTRAINT "criterion_score_range" CHECK ("scoreMax" > "scoreMin" AND "weight" >= 0 AND "sequence" > 0);

ALTER TABLE "SubmissionStage" ADD CONSTRAINT "stage_configuration" CHECK ("sequence" > 0 AND "peerReviewCount" >= 0 AND "openAt" < "submissionDeadline" AND (NOT "allowRebuttal" OR "allowReviews") AND (("allowReviews" AND "reviewDeadline" IS NOT NULL AND "reviewDeadline" > "submissionDeadline") OR (NOT "allowReviews" AND "peerReviewCount" = 0)) AND (NOT "allowRebuttal" OR ("rebuttalDeadline" IS NOT NULL AND "rebuttalDeadline" > "reviewDeadline")));

ALTER TABLE "Submission" ADD CONSTRAINT "submission_cycle_positive" CHECK ("reviewCycle" > 0 AND "revision" >= 0);

ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "version_number_positive" CHECK ("versionNumber" > 0);

ALTER TABLE "SubmissionFile" ADD CONSTRAINT "SubmissionFile_pdf_metadata" CHECK ("sizeBytes" > 0 AND "mimeType" = 'application/pdf' AND "sha256" ~ '^[0-9a-f]{64}$' AND "storageKey" !~ '(^/|(^|/)\.\.(/|$))');

ALTER TABLE "SimilarityResultFile" ADD CONSTRAINT "SimilarityResultFile_pdf_metadata" CHECK ("sizeBytes" > 0 AND "mimeType" = 'application/pdf' AND "sha256" ~ '^[0-9a-f]{64}$' AND "storageKey" !~ '(^/|(^|/)\.\.(/|$))');

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_target_xor" CHECK (("reviewerType" = 'GROUP' AND "reviewerGroupId" IS NOT NULL AND "reviewerUserId" IS NULL) OR ("reviewerType" = 'INSTRUCTOR' AND "reviewerUserId" IS NOT NULL AND "reviewerGroupId" IS NULL));

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_positive_numbers" CHECK ("reviewCycle" > 0 AND "aliasNumber" > 0);

ALTER TABLE "ConflictOfInterestDeclaration" ADD CONSTRAINT "coi_reason_nonempty" CHECK (length(btrim("reason")) > 0);

ALTER TABLE "ConflictOfInterestDeclaration" ADD CONSTRAINT "coi_decision_actor" CHECK (("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedById" IS NULL) OR ("status" <> 'PENDING' AND "decidedAt" IS NOT NULL AND "decidedById" IS NOT NULL AND length(btrim("decisionNote")) > 0));

ALTER TABLE "ReviewRevision" ADD CONSTRAINT "submitted_review_evidence" CHECK ("status" <> 'SUBMITTED' OR ("submittedById" IS NOT NULL AND "submittedAt" IS NOT NULL));

ALTER TABLE "ReviewRevision" ADD CONSTRAINT "review_correction_authorization" CHECK ("revisionNumber" = 1 OR ("revisionNumber" > 1 AND "correctionAuthorizedById" IS NOT NULL AND length(btrim("correctionReason")) > 0 AND "correctionDeadline" IS NOT NULL));

ALTER TABLE "SimilarityCheck" ADD CONSTRAINT "SimilarityCheck_percentage" CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100));

ALTER TABLE "SimilarityCheck" ADD CONSTRAINT "SimilarityCheck_result_required" CHECK (("status" <> 'COMPLETED' OR "resultDate" IS NOT NULL) AND ("status" NOT IN ('FAILED', 'WAIVED') OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)));

ALTER TABLE "SimilarityCheckHistory" ADD CONSTRAINT "SimilarityCheckHistory_percentage" CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100));

ALTER TABLE "SimilarityCheckHistory" ADD CONSTRAINT "SimilarityCheckHistory_result_required" CHECK (("status" <> 'COMPLETED' OR "resultDate" IS NOT NULL) AND ("status" NOT IN ('FAILED', 'WAIVED') OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)));

ALTER TABLE "GradeRevision" ADD CONSTRAINT "grade_score_range" CHECK (("overall" IS NULL OR "overall" BETWEEN 0 AND 10) AND ("calculatedOverall" IS NULL OR "calculatedOverall" BETWEEN 0 AND 10));

ALTER TABLE "GradeRevision" ADD CONSTRAINT "published_grade_evidence" CHECK ("status" <> 'PUBLISHED' OR ("overall" IS NOT NULL AND "calculatedOverall" IS NOT NULL AND "publishedById" IS NOT NULL AND "publishedAt" IS NOT NULL AND ("overall" = "calculatedOverall" OR ("overrideReason" IS NOT NULL AND length(btrim("overrideReason")) > 0))));

ALTER TABLE "ArchivePublication" ADD CONSTRAINT "archive_revoke_evidence" CHECK (("revokedAt" IS NULL AND "revokedById" IS NULL) OR ("revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND "revokeReason" IS NOT NULL AND length(btrim("revokeReason")) > 0));

CREATE UNIQUE INDEX "membership_one_active" ON "CourseMembership" ("offeringId", "userId") WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "group_member_one_active" ON "GroupMember" ("offeringId", "userId") WHERE "leftAt" IS NULL;

CREATE UNIQUE INDEX "assignment_active_reviewerGroupId" ON "ReviewerAssignment" ("submissionId", "reviewCycle", "reviewerGroupId") WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED', 'SUBMITTED') AND "reviewerGroupId" IS NOT NULL;

CREATE UNIQUE INDEX "assignment_active_reviewerUserId" ON "ReviewerAssignment" ("submissionId", "reviewCycle", "reviewerUserId") WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS', 'COI_REQUESTED', 'SUBMITTED') AND "reviewerUserId" IS NOT NULL;

CREATE UNIQUE INDEX "coi_one_pending" ON "ConflictOfInterestDeclaration" ("assignmentId") WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "archive_one_live_project" ON "ArchivePublication" ("projectId") WHERE "revokedAt" IS NULL;

ALTER TABLE "GroupMember" ADD CONSTRAINT "group_member_offering_fk" FOREIGN KEY ("groupId", "offeringId") REFERENCES "ProjectGroup" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupMember" ADD CONSTRAINT "group_member_membership_context_fk" FOREIGN KEY ("membershipId", "offeringId", "membershipRole", "userId") REFERENCES "CourseMembership" ("id", "offeringId", "role", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Project" ADD CONSTRAINT "project_group_offering_fk" FOREIGN KEY ("groupId", "offeringId") REFERENCES "ProjectGroup" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RubricRevision" ADD CONSTRAINT "rubric_revision_offering_fk" FOREIGN KEY ("rubricId", "offeringId") REFERENCES "Rubric" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionStage" ADD CONSTRAINT "stage_rubric_offering_fk" FOREIGN KEY ("rubricRevisionId", "offeringId") REFERENCES "RubricRevision" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "submission_project_offering_fk" FOREIGN KEY ("projectId", "offeringId") REFERENCES "Project" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "submission_stage_offering_fk" FOREIGN KEY ("stageId", "offeringId") REFERENCES "SubmissionStage" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "submission_draft_version_fk" FOREIGN KEY ("latestDraftVersionId", "id") REFERENCES "SubmissionVersion" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "submission_submitted_version_fk" FOREIGN KEY ("submittedVersionId", "id") REFERENCES "SubmissionVersion" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_version_context_fk" FOREIGN KEY ("submissionVersionId", "submissionId") REFERENCES "SubmissionVersion" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_offering_fk" FOREIGN KEY ("submissionId", "offeringId") REFERENCES "Submission" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_group_offering_fk" FOREIGN KEY ("reviewerGroupId", "offeringId") REFERENCES "ProjectGroup" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "assignment_rubric_offering_fk" FOREIGN KEY ("rubricRevisionId", "offeringId") REFERENCES "RubricRevision" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "review_assignment_context_fk" FOREIGN KEY ("assignmentId", "submissionId", "submissionVersionId", "rubricRevisionId", "reviewCycle") REFERENCES "ReviewerAssignment" ("id", "submissionId", "submissionVersionId", "rubricRevisionId", "reviewCycle") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "review_draft_revision_fk" FOREIGN KEY ("draftRevisionId", "id") REFERENCES "ReviewRevision" ("id", "reviewId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review" ADD CONSTRAINT "review_submitted_revision_fk" FOREIGN KEY ("submittedRevisionId", "id") REFERENCES "ReviewRevision" ("id", "reviewId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewRevision" ADD CONSTRAINT "review_revision_rubric_fk" FOREIGN KEY ("reviewId", "rubricRevisionId") REFERENCES "Review" ("id", "rubricRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewCriterionResponse" ADD CONSTRAINT "review_response_revision_rubric_fk" FOREIGN KEY ("reviewRevisionId", "rubricRevisionId") REFERENCES "ReviewRevision" ("id", "rubricRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewCriterionResponse" ADD CONSTRAINT "review_response_criterion_rubric_fk" FOREIGN KEY ("criterionId", "rubricRevisionId") REFERENCES "RubricCriterion" ("id", "rubricRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RebuttalReviewResponse" ADD CONSTRAINT "rebuttal_response_context_fk" FOREIGN KEY ("rebuttalId", "submissionId", "reviewCycle") REFERENCES "Rebuttal" ("id", "submissionId", "reviewCycle") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RebuttalReviewResponse" ADD CONSTRAINT "rebuttal_response_review_context_fk" FOREIGN KEY ("reviewId", "submissionId", "reviewCycle") REFERENCES "Review" ("id", "submissionId", "reviewCycle") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "discussion_review_context_fk" FOREIGN KEY ("reviewId", "submissionId", "reviewCycle") REFERENCES "Review" ("id", "submissionId", "reviewCycle") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD CONSTRAINT "grade_draft_revision_fk" FOREIGN KEY ("draftRevisionId", "id") REFERENCES "GradeRevision" ("id", "gradeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grade" ADD CONSTRAINT "grade_published_revision_fk" FOREIGN KEY ("publishedRevisionId", "id") REFERENCES "GradeRevision" ("id", "gradeId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeRevision" ADD CONSTRAINT "grade_revision_submission_fk" FOREIGN KEY ("gradeId", "submissionId") REFERENCES "Grade" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeRevision" ADD CONSTRAINT "grade_revision_version_fk" FOREIGN KEY ("submissionVersionId", "submissionId") REFERENCES "SubmissionVersion" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeCriterionScore" ADD CONSTRAINT "grade_score_revision_rubric_fk" FOREIGN KEY ("gradeRevisionId", "rubricRevisionId") REFERENCES "GradeRevision" ("id", "rubricRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeCriterionScore" ADD CONSTRAINT "grade_score_criterion_rubric_fk" FOREIGN KEY ("criterionId", "rubricRevisionId") REFERENCES "RubricCriterion" ("id", "rubricRevisionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArchivePublication" ADD CONSTRAINT "archive_submission_project_fk" FOREIGN KEY ("submissionId", "projectId") REFERENCES "Submission" ("id", "projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArchivePublication" ADD CONSTRAINT "archive_version_submission_fk" FOREIGN KEY ("submissionVersionId", "submissionId") REFERENCES "SubmissionVersion" ("id", "submissionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentPlan" ADD CONSTRAINT "assignment_plan_stage_offering_fk" FOREIGN KEY ("stageId", "offeringId") REFERENCES "SubmissionStage" ("id", "offeringId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_changedById_fk" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fk" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_uploadedById_fk" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionVersionAuthor" ADD CONSTRAINT "SubmissionVersionAuthor_userId_fk" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_reviewerUserId_fk" FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewerAssignment" ADD CONSTRAINT "ReviewerAssignment_assignedById_fk" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConflictOfInterestDeclaration" ADD CONSTRAINT "ConflictOfInterestDeclaration_declaredById_fk" FOREIGN KEY ("declaredById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConflictOfInterestDeclaration" ADD CONSTRAINT "ConflictOfInterestDeclaration_decidedById_fk" FOREIGN KEY ("decidedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_submittedById_fk" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReviewRevision" ADD CONSTRAINT "ReviewRevision_correctionAuthorizedById_fk" FOREIGN KEY ("correctionAuthorizedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Rebuttal" ADD CONSTRAINT "Rebuttal_authorId_fk" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Rebuttal" ADD CONSTRAINT "Rebuttal_reopenedById_fk" FOREIGN KEY ("reopenedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DiscussionMessage" ADD CONSTRAINT "DiscussionMessage_authorId_fk" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SimilarityCheck" ADD CONSTRAINT "SimilarityCheck_updatedById_fk" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SimilarityCheckHistory" ADD CONSTRAINT "SimilarityCheckHistory_actorId_fk" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SimilarityResultFile" ADD CONSTRAINT "SimilarityResultFile_uploadedById_fk" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_graderId_fk" FOREIGN KEY ("graderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeRevision" ADD CONSTRAINT "GradeRevision_publishedById_fk" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArchivePublication" ADD CONSTRAINT "ArchivePublication_approvedById_fk" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ArchivePublication" ADD CONSTRAINT "ArchivePublication_revokedById_fk" FOREIGN KEY ("revokedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_actorId_fk" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentPlan" ADD CONSTRAINT "AssignmentPlan_createdById_fk" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RosterImportPreview" ADD CONSTRAINT "RosterImportPreview_createdById_fk" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubmissionVersionAuthor" ADD CONSTRAINT "version_author_group_member_fk" FOREIGN KEY ("groupMemberId") REFERENCES "GroupMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION proview_immutable_row() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME USING ERRCODE = '23514'; END; $$;

CREATE TRIGGER "AuditLog_immutable" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();

CREATE TRIGGER "SubmissionVersion_immutable" BEFORE UPDATE OR DELETE ON "SubmissionVersion" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();

CREATE TRIGGER "SubmissionVersionAuthor_immutable" BEFORE UPDATE OR DELETE ON "SubmissionVersionAuthor" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();

CREATE TRIGGER "SimilarityCheckHistory_immutable" BEFORE UPDATE OR DELETE ON "SimilarityCheckHistory" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();

CREATE TRIGGER "DiscussionMessage_immutable" BEFORE UPDATE OR DELETE ON "DiscussionMessage" FOR EACH ROW EXECUTE FUNCTION proview_immutable_row();

CREATE FUNCTION proview_locked_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (TG_TABLE_NAME = 'ReviewRevision' AND OLD."status"::text = 'SUBMITTED') OR
    (TG_TABLE_NAME = 'GradeRevision' AND OLD."status"::text = 'PUBLISHED') THEN
   RAISE EXCEPTION '% evidence is immutable', TG_TABLE_NAME USING ERRCODE = '23514';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER "ReviewRevision_locked" BEFORE UPDATE OR DELETE ON "ReviewRevision" FOR EACH ROW EXECUTE FUNCTION proview_locked_evidence();

CREATE TRIGGER "GradeRevision_locked" BEFORE UPDATE OR DELETE ON "GradeRevision" FOR EACH ROW EXECUTE FUNCTION proview_locked_evidence();

CREATE FUNCTION proview_score_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE criterion "RubricCriterion"; locked boolean;
BEGIN
 IF TG_TABLE_NAME = 'ReviewCriterionResponse' THEN
   SELECT "status" = 'SUBMITTED' INTO locked FROM "ReviewRevision" WHERE "id" = COALESCE(NEW."reviewRevisionId", OLD."reviewRevisionId");
 ELSE
   SELECT "status" = 'PUBLISHED' INTO locked FROM "GradeRevision" WHERE "id" = COALESCE(NEW."gradeRevisionId", OLD."gradeRevisionId");
 END IF;
 IF locked THEN RAISE EXCEPTION 'Published scores are immutable' USING ERRCODE = '23514'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 SELECT * INTO criterion FROM "RubricCriterion" WHERE "id" = NEW."criterionId";
 IF NEW."score" < criterion."scoreMin" OR NEW."score" > criterion."scoreMax" THEN
   RAISE EXCEPTION 'Score outside criterion range' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER "ReviewCriterionResponse_guard" BEFORE INSERT OR UPDATE OR DELETE ON "ReviewCriterionResponse" FOR EACH ROW EXECUTE FUNCTION proview_score_guard();

CREATE TRIGGER "GradeCriterionScore_guard" BEFORE INSERT OR UPDATE OR DELETE ON "GradeCriterionScore" FOR EACH ROW EXECUTE FUNCTION proview_score_guard();

CREATE FUNCTION proview_rubric_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE locked boolean;
BEGIN
 IF TG_TABLE_NAME = 'RubricRevision' THEN locked := OLD."publishedAt" IS NOT NULL;
 ELSE SELECT "publishedAt" IS NOT NULL INTO locked FROM "RubricRevision" WHERE "id" = COALESCE(NEW."rubricRevisionId", OLD."rubricRevisionId"); END IF;
 IF locked THEN RAISE EXCEPTION 'Published rubric is immutable' USING ERRCODE = '23514'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER "RubricRevision_locked" BEFORE UPDATE OR DELETE ON "RubricRevision" FOR EACH ROW EXECUTE FUNCTION proview_rubric_guard();

CREATE TRIGGER "RubricCriterion_locked" BEFORE INSERT OR UPDATE OR DELETE ON "RubricCriterion" FOR EACH ROW EXECUTE FUNCTION proview_rubric_guard();

CREATE FUNCTION proview_ready_file_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."state" = 'READY' THEN RAISE EXCEPTION 'Ready file metadata is immutable' USING ERRCODE = '23514'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;

CREATE TRIGGER "SubmissionFile_ready_immutable" BEFORE UPDATE OR DELETE ON "SubmissionFile" FOR EACH ROW EXECUTE FUNCTION proview_ready_file_guard();

CREATE TRIGGER "SimilarityResultFile_ready_immutable" BEFORE UPDATE OR DELETE ON "SimilarityResultFile" FOR EACH ROW EXECUTE FUNCTION proview_ready_file_guard();
