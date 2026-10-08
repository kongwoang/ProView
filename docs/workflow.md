# Workflow and evidence

An offering moves DRAFT → ACTIVE → CLOSED → ARCHIVED. Each project/stage has its own Submission. Upload creates an immutable numbered PDF version and advances the draft pointer; it does not submit. Explicit submit compares the submission revision and chosen version and pins the exact evidence. Replaying the same submit is safe; a different version with stale revision is rejected.

Submission input is available only in an ACTIVE offering between stage opening and submission deadline, or during an instructor-authorized reopen window. At equality with the deadline input is closed. Instants are stored in UTC; the offering records its display timezone.

For a review-enabled stage, manual or previewed automatic assignment pins the submitted version, rubric revision and cycle and starts UNDER_REVIEW. Automatic assignment enforces self/shared-member exclusion, existing conflicts and workload bounds, explains infeasible results and minimizes reciprocal pairs where possible. Preview is separate from apply. COI declarations suspend the assignment; staff decisions either restore it or exclude/replace it while retaining its history.

Reviewers collaboratively save a draft using revision checks. Explicit submission validates required rubric scores/comments and configured recommendation/overall comment. Submitted review revisions are immutable. A reasoned instructor correction authorization creates a new draft revision and keeps the old submitted evidence. Author groups see released submitted reviews; their review batch becomes available together after required completion or a reasoned instructor close.

Review release starts REBUTTAL_OPEN when configured and a valid rebuttal window remains, otherwise REVIEW_COMPLETED. A rebuttal supports a general response and per-review responses. Finalization or expiry locks it and preserves a snapshot. Instructor reopening requires a reason and future deadline; later finalization creates another immutable snapshot. Discussion is contextual, authorized and read-only once the submission is finalized.

No-review stages can be closed with `finalize-input` to reach REVIEW_COMPLETED. Grading stores a draft separately from published evidence. Publication requires completed workflow, locked input, complete required scores, matching exact version/rubric, and COMPLETED or WAIVED similarity status for that version when required. Scores normalize each criterion range before weighting onto a0–10 overall scale. Overrides and published-grade corrections require reasons. Grade publication marks the submission FINALIZED and notifies authors.

A full submission reopen increments the review cycle and clears current workflow pointers while preserving old PDFs, assignments, reviews, rebuttals, similarity checks and grades. Old similarity approval cannot authorize publication for a newly submitted version.

Only a finalized, published-grade report from a CLOSED or ARCHIVED offering can be approved for the reference archive. Approval pins the exact version and download policy. Replacing or revoking a publication preserves approval history and immediately removes its reference access. Personal historical access is independent of public reference approval.

Offering term dates and academic deadline inputs/displays use the offering timezone. Browser timezone differences do not change the intended instant. For a skipped or repeated daylight-saving hour, forms require a time outside that hour rather than guessing a deadline. Backend storage/guards use UTC instants. Generic notification/audit timestamps are shown in the browser timezone with an explicit timezone label.
