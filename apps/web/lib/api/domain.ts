import type { AllowedAction, ReviewerIdentity, SessionUser } from './contracts';
import type { components } from './generated';

export interface Course {
  id: string;
  code: string;
  title: string;
  description: string;
}
export interface Criterion {
  id: string;
  title: string;
  description: string;
  weight: string | number;
  scoreMin: string | number;
  scoreMax: string | number;
  required: boolean;
  requireComment: boolean;
}
export interface RubricRevision {
  id: string;
  revisionNumber: number;
  requireRecommendation: boolean;
  recommendationOptions: string[];
  requireOverallComment: boolean;
  criteria: Criterion[];
}
export interface Stage {
  id: string;
  name: string;
  sequence: number;
  openAt: string;
  submissionDeadline: string;
  reviewDeadline: string | null;
  rebuttalDeadline: string | null;
  allowReviews: boolean;
  allowRebuttal: boolean;
  requireSimilarityCheck: boolean;
  peerReviewCount: number;
  revision: number;
  rubricRevisionId: string;
  rubricRevision: RubricRevision;
}
export interface Member {
  id: string;
  userId: string;
  role: string;
  endedAt: string | null;
  user: SessionUser;
}
export interface Group {
  id: string;
  name: string;
  revision: number;
  membershipLockedAt: string | null;
  project?: Project;
  members: {
    id: string;
    userId: string;
    leftAt: string | null;
    user?: SessionUser;
    membership?: Member;
  }[];
}
export interface Offering {
  id: string;
  courseId: string;
  semester: string;
  academicYear: string;
  termStartAt: string;
  termEndAt: string;
  timezone: string;
  status: string;
  anonymityMode: string;
  revision: number;
  course: Course;
  stages: Stage[];
  groups: Group[];
}
export interface Project {
  id: string;
  title: string;
  description: string;
  group: Group;
  offering: Offering;
  submissions: Submission[];
  stages?: Stage[];
}
export interface SubmissionVersion {
  id: string;
  versionNumber: number;
  changeNote: string;
  uploadedAt: string;
  file?: { displayName: string; sizeBytes: number; sha256: string };
}
export interface Submission {
  id: string;
  projectId: string;
  stageId: string;
  status: string;
  revision: number;
  project: Project;
  group?: Group;
  offering: Offering;
  stage: Stage;
  versions: SubmissionVersion[];
  submittedVersionId: string | null;
  latestDraftVersionId: string | null;
  submittedAt: string | null;
  reviewsReleasedAt: string | null;
  reopenUntil: string | null;
  allowedActions: AllowedAction[];
}
export interface CriterionResponse {
  criterionId: string;
  criterionTitle?: string;
  score: string | number;
  comment: string;
  criterion?: Criterion;
}
export interface ReviewRevision {
  id: string;
  revision: number;
  revisionNumber?: number;
  status: string;
  strengths: string;
  weaknesses: string;
  overallComment: string;
  recommendation: string | null;
  responses: CriterionResponse[];
  submittedAt?: string;
}
export interface Review {
  id: string;
  submissionId: string;
  submissionVersionId: string;
  reviewer: ReviewerIdentity;
  draftRevision?: ReviewRevision | null;
  submittedRevision?: ReviewRevision | null;
  revision?: ReviewRevision;
  status?: string;
}
export interface Assignment {
  id: string;
  submissionId: string;
  submissionVersionId: string;
  status: string;
  reviewerType: string;
  reviewerGroupId?: string;
  reviewerUserId?: string;
  reviewer?: ReviewerIdentity;
  reviewerGroup?: Group;
  submission: Submission;
  version: SubmissionVersion;
  rubricRevision: RubricRevision;
  review: Review | null;
  conflicts?: Conflict[];
}
export interface Conflict {
  id: string;
  reason: string;
  status: string;
  decisionNote: string | null;
  assignmentId: string;
}
export type Notification = components['schemas']['NotificationDto'];
