# Implemented relational model

`apps/api/prisma/schema.prisma` is the generated-client contract. The SQL migration adds constraints that Prisma 6 cannot express. Records use UUIDs; instants use `timestamptz`; scores use decimals. Academic evidence references use `RESTRICT`, not cascading deletes.

| Area | Entities and association |
|---|---|
| Identity | User → AuthSession; rotating refresh tokens retain family and parent lineage |
| Course context | Course → CourseOffering → CourseMembership; history uses joined/ended intervals |
| Authorship | ProjectGroup → GroupMember; one Project per group; version authorship snapshots refer to historical group membership |
| Rubric | Rubric → RubricRevision → RubricCriterion; published revisions and criteria are immutable |
| Submission | Project × SubmissionStage → Submission → SubmissionVersion → SubmissionFile |
| Peer review | ReviewerAssignment pins exact version, rubric and cycle; Review has draft/submitted revision pointers; ReviewRevision contains response rows |
| COI | ConflictOfInterestDeclaration preserves previous assignment status, private reason and staff decision; replacement lineage is explicit |
| Rebuttal | Rebuttal is unique per submission/cycle; optional RebuttalReviewResponse is constrained to the same review context |
| Discussion | DiscussionMessage requires submission/cycle; optional review must belong to the same context |
| Similarity | SimilarityCheck is unique per exact PDF version; append-only history and separate private result files preserve corrections |
| Grading | Grade is unique per submission; GradeRevision pins exact version and rubric; published revision and criterion scores are immutable |
| Archive | ArchivePublication pins exact project/submission/version; approval and revocation are retained |
| Operations | Append-only AuditLog; OutboxEvent with lease/retry; recipient-safe Notification; IdempotencyRecord; assignment/CSV preview snapshots |

Database-enforced invariants include normalized unique account keys; one active course membership per user/offering; one active group per student/offering; student-role membership in a matching group/offering; unique project/stage submission; unique version number; contextual version pointers; group XOR instructor assignment target; active reviewer uniqueness per submission/cycle; same-context review, rubric response, rebuttal response, discussion and publication; score/percentage bounds; valid stage date configuration; valid PDF metadata; immutable ready files, versions, author snapshots, published rubrics/reviews/grades and audit/history records.

Service transactions enforce actor permissions, current membership eligibility and deadlines, active instructor membership for instructor reviewers, no self/shared-membership review, frozen author membership, exact current version and cycle at workflow mutation time, review completeness and release batches, safe corrections/reopen, positive rubric total weight, same-offering grading rubric, similarity gating before grade publication, later-cohort archive eligibility, immutable-author identity presentation, atomic CSV import and outbox delivery. These are contextual or cross-record rules; a database CHECK alone cannot express them correctly.

Logical evidence pointers distinguish current draft from submitted/published evidence. Corrections create a new revision and leave the previous revision readable to authorized actors. Full submission reopen increments the cycle and clears current pointers in the service transaction; historical review/rebuttal/grade/version rows remain. Similarity evidence never moves to another PDF version.

The schema has no OpenReview Note, Invitation or generic workflow model. OpenReview adaptation is a frontend concern.
