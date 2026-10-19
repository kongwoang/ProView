# ADSys collaboration guide

This guide explains how the team turns ProView's implemented behavior into consistent Systems Analysis and Design deliverables. Start with the [README](../README.md) for motivation, roles, terminology, features, and the project workflow.

**Coordinator:** Hoàng. **Shared Drive folder:** to be created and linked here by the team. **Drawing-template owner:** to be designated. These are preparation tasks, not completed setup.

## 1. Establish the baseline

Use the demo to understand behavior, then confirm details in the implementation. Record the repository commit and observation date in each task so a later code change does not silently invalidate its diagrams.

| Question                                           | Primary reference                                                                                                     |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| What can the user do on screen?                    | [Demo](https://proview.hoangpc.io.vn) and `apps/web/features/`                                                        |
| What entities, fields, and relationships exist?    | [Prisma schema](../apps/api/prisma/schema.prisma) and [migrations](../apps/api/prisma/migrations/)                    |
| Who may perform an operation?                      | [Authorization](authorization.md), `apps/api/src/modules/policies/`, and the operation's service                      |
| Which states, deadlines, and evidence are checked? | [Workflow](workflow.md) and the relevant service in `apps/api/src/modules/`                                           |
| What has actually been tested?                     | [Testing](testing.md), the referenced test code, and [verification evidence](evidence/implementation-verification.md) |
| What is proposed or still incomplete?              | [Implementation status](implementation-status.md), planning documents, and agreed change requests                     |

When the demo, code, and a document disagree, record the discrepancy and ask Hoàng to resolve the baseline. Do not silently choose the version that makes a diagram easier. The shared deployment may be on a different release from a local checkout.

Classify every requirement or behavior as one of:

- **Implemented:** traceable to the current implementation. State what was observed or tested separately.
- **Proposed:** an improvement awaiting agreement and implementation.
- **Needs clarification:** evidence is missing, contradictory, or dependent on a course policy.

“Implemented” does not mean every edge case has passed acceptance testing. Likewise, a completed diagram does not prove that its proposed behavior exists in the demo.

## 2. Task breakdown

Assign a named owner and reviewer to each work package. A person may own more than one package; the package IDs do not imply a particular team size or the use of coding agents. Schedule them against the course's actual deadlines.

| Task                                     | Scope and output                                                                                                       | Dependencies | Acceptance criteria                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AD00 — Shared design setup**           | Agree terminology, create the draw.io template, Drive folder, and task register.                                       | None         | Template includes example shapes/connectors, captions, legend, version fields, and export settings; folder access works for the team.                                       |
| **AD01 — Planning and requirements**     | Motivation, scope, stakeholders, system request, feasibility, functional/non-functional requirements, and assumptions. | AD00         | Requirements have stable IDs and acceptance conditions. Expected benefits and proposed targets are not presented as measured results.                                       |
| **AD02 — Actors and use cases**          | Actor model, use case overview, and specifications for the main goals.                                                 | AD01         | Each detailed use case names its actor, trigger, preconditions, main flow, alternatives/errors, postconditions, and rules. Student author/reviewer contexts are consistent. |
| **AD03 — Activities and states**         | Submission/review activity diagrams, submission lifecycle, and selected exception flows.                               | AD02         | Upload and submit differ; review/no-review and rebuttal branches are covered; full reopen and corrections preserve evidence.                                                |
| **AD04 — Domain and data**               | Conceptual class model, ERDs split into readable areas, and a data dictionary.                                         | AD01–AD03    | Names/cardinalities match the schema; uniqueness, version references, membership history, and reviewer group/instructor alternatives are explained.                         |
| **AD05 — Architecture and interactions** | Context, logical/package architecture, deployment, and key sequence diagrams.                                          | AD03–AD04    | Separate logical responsibilities from runtime nodes; show backend authorization and transaction boundaries; no invented COOPY API or microservices.                        |
| **AD06 — UI and screenflow**             | Role-based navigation, core screenflows, and annotated wireframes or demo screenshots.                                 | AD02–AD03    | Screens match use cases and states; include validation, forbidden, stale-revision, and empty states where relevant. Proposals are labeled.                                  |
| **AD07 — Traceability and validation**   | Requirement-to-model-to-test matrix, demo walkthrough, discrepancy log, and report consistency review.                 | AD01–AD06    | Every core requirement points to a model and a verification scenario; results are labeled observed, tested, or pending.                                                     |
| **AD08 — Report assembly**               | Consistent chapters, captions, references, editable sources, exports, and defense notes.                               | AD07         | Final report follows the instructor's rubric; figures remain readable at insertion size; no unresolved contradiction is hidden.                                             |

Prioritize detailed models for **submit a version**, **assign/reassign reviewers**, **submit/release reviews**, **finalize rebuttal**, **publish a grade**, and **approve/read/revoke a reference report**. Give simple account/catalog CRUD less space unless the course rubric requires complete specifications.

## 3. One draw.io template

The designated template owner prepares the common file before final diagram production. Use draw.io for editable diagrams; PNG or PDF exports are report outputs, not substitutes for the editable source.

Agree these conventions once:

| Item         | Convention                                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language     | English titles and labels; explain abbreviations on first use.                                                                                                               |
| Naming       | Use the README vocabulary and actual entity names, such as `CourseOffering`, `SubmissionVersion`, and `RubricRevision`.                                                      |
| Appearance   | One legible font family, consistent font sizes, spacing, and line widths. Use the ProView blue/cyan/purple palette sparingly.                                                |
| Meaning      | Identify what each shape and line represents. Do not use color alone to distinguish roles, states, or permissions.                                                           |
| UML          | Actor associations are not process-flow arrows. Use decisions for alternatives and forks only for genuine concurrency. Use `include`/`extend` only when their semantics fit. |
| Architecture | Label calls/protocols where useful. Distinguish logical components, data stores, external systems, and deployment nodes.                                                     |
| Data         | Include cardinality and relevant keys in ERDs. A simplified evidence map is not a complete ERD.                                                                              |
| Connectors   | Attach connectors to shapes. Keep labels readable and avoid crossing unrelated shapes.                                                                                       |
| Caption      | Diagram ID, title, scope, baseline commit/date, and author/reviewer. Note intentional omissions.                                                                             |
| Review       | Inspect the exported figure at the size used in the report; text must remain readable and uncropped.                                                                         |

The template owner maintains the style. Diagram owners remain responsible for their diagram's correctness. Template changes affecting all figures should be announced in the task register before final assembly.

## 4. Shared Drive organization

The team should create one shared folder with the structure below. The folder name and layout are a proposal until the coordinator creates it and records the link. Use one owner per editable diagram at a time to avoid conflicting copies.

```text
ProView-ADSys/
├── 00-Coordination/        Task register, glossary, decisions, change log
├── 01-Template/            Shared draw.io template and drawing conventions
├── 02-Planning/            System request, requirements, feasibility
├── 03-Analysis/            Use cases, activities, state models
├── 04-Design/              Architecture, sequences, classes, ERDs
├── 05-UI/                  Screenflows, wireframes, approved screenshots
├── 06-Validation/          Traceability, test scenarios, observations
├── 07-Report/              Report draft and final submission
└── 08-Exports/             Reviewed figure exports for the report
```

Suggested filename: `AD05-SQ02-PublishGrade-v01.drawio`, with the same stem for its export. Keep the diagram ID stable across revisions and captions. When a revision becomes the approved baseline, record its version and reviewer in the task register instead of relying on names such as `final-final-2`.

The Drive folder holds working/report material; the repository holds implementation and accepted technical documentation. Record which exported diagram corresponds to which source and code baseline. Do not upload deployment secrets or private student reports to the shared design folder.

## 5. Rules every deliverable must preserve

1. **A course is not an offering.** Admin manages the course catalog; instructors manage their semester offerings and their participants.
2. **Author and reviewer are contexts.** There is no separate permanent `Reviewer` account role. Peer assignments currently target project groups; each group collaborates on one review per assignment.
3. **Upload is not submit.** Historical PDFs are retained, and the submitted version is selected explicitly.
4. **Assessment evidence has an identity.** Assignment, review, grade, and similarity evidence must point to the correct version and, where relevant, rubric revision and review cycle.
5. **Anonymity is audience-dependent.** Reviewers can be hidden from authors while remaining identifiable to authorized instructors. Do not label the current system double-blind.
6. **Drafts and published evidence differ.** Saving a review does not release it to authors. Saving a grade does not publish it.
7. **Rebuttal is a response.** It does not itself upload or replace the report. Full submission reopen, rebuttal reopening, review correction, and grade correction are distinct operations.
8. **COOPY is external manual work.** Staff transfer the selected document and record results; ProView does not make an API call to COOPY.
9. **Archive approval is explicit.** Closing an offering or publishing a grade does not automatically make a report available to later cohorts.
10. **Backend policy decides access.** Hiding a button or guessing an entity ID does not grant or revoke permission. Account role alone is insufficient for course-specific actions.

In use case diagrams, connect **Browse approved reference reports** directly to **Student**; do not introduce a separate reference-reader actor. Treat the reference archive as a supporting feature, while keeping submission, review, rebuttal, and grading at the center of the report.

Initial ideas that differ from these rules belong in a change request. Important examples are independent student reviewer assignments, author-nominated reviewers, formal reviewer recognition, a dedicated comments-only review mode, and mandatory assignment only after the submission deadline.

## 6. Task and report templates

### Design task

```text
Task ID and title:
Owner / reviewer:
Target date:
Dependencies:
Baseline commit / demo observation date:
Requirement and use case IDs:
Scope / exclusions:
Implementation references:
Expected output files:
Acceptance criteria:
Open questions / linked change requests:
Status: TODO | IN_PROGRESS | IN_REVIEW | DONE
```

### Bug or discrepancy report to Hoàng

```text
Title:
Environment / release / observation time:
Role and offering/group context:
Preconditions and test data:
Steps to reproduce:
Expected behavior and its source:
Actual behavior:
Impact:
Screenshot / request ID / safe evidence:
Affected document or diagram IDs:
```

Do not include passwords, tokens, or private student files. If a permission problem or data exposure is involved, report it privately to Hoàng and redact sensitive evidence.

### Proposed change

```text
Title and proposer:
Current behavior and supporting evidence:
Problem or learning objective:
Proposed behavior:
Affected roles / workflow / permissions:
Affected entities / API / UI / diagrams:
Data migration or compatibility considerations:
Acceptance scenarios, including failure cases:
Alternatives and tradeoffs:
Decision: PROPOSED | NEEDS_CLARIFICATION | ACCEPTED | REJECTED
Implementation status: NOT_STARTED | IN_PROGRESS | VERIFIED
Decision owner / date / linked implementation:
```

An **accepted** proposal is not yet an **implemented** feature. Keep proposed diagrams visibly separate until the agreed change is implemented and verified against its acceptance scenarios.

## 7. Definition of done

A design task is done when:

- Its stated outputs exist, with an editable source for each diagram and readable exports.
- Its actor names, entity names, relationships, transitions, and permissions agree with the selected baseline.
- Main flows and relevant failure/alternative flows are explained.
- It links to requirements/use cases and implementation references; assumptions are visible.
- Observations, executed tests, and untested expectations are clearly distinguished.
- A reviewer has checked it against adjacent tasks, and findings are resolved or explicitly recorded.
- Hoàng has been informed of discovered bugs or requested behavior changes through the agreed channel.
- The task register and report references point to the reviewed version.

A useful traceability row is:

| Requirement                                 | Use case      | Model                 | Implementation                              | Verification                                                                 | Result                                              |
| ------------------------------------------- | ------------- | --------------------- | ------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------- |
| Preserve the exact version used for grading | Publish grade | Sequence + data model | `GradesService.publish` and `GradeRevision` | Attempt publication after the submission is reopened or its evidence changes | Record the actual test result; do not pre-fill PASS |

The final review should be able to follow one project from offering setup through submission, peer review, response, grading, and reference approval without encountering incompatible names or rules.
