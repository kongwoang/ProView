<p align="center">
  <img src="apps/web/public/brand/proview-icon.png" alt="ProView logo" width="110" />
</p>

<h1 align="center">ProView</h1>

<p align="center"><strong>Course Project Submission and Peer Review Platform</strong></p>
<p align="center">Submit projects. Exchange constructive feedback. Keep every assessment tied to the right version.</p>

<p align="center">
  <a href="https://proview.hoangpc.io.vn">Demo</a> ·
  <a href="#how-it-works">Workflow</a> ·
  <a href="#adsys-team-workflow">ADSys guide</a> ·
  <a href="#local-development">Local setup</a> ·
  <a href="#documentation">Documentation</a>
</p>

ProView brings course project submissions, peer review, instructor assessment, and approved reference reports into one place. It organizes work by course, semester, project group, and submission stage, so students can follow deadlines and instructors can manage the full assessment process.

The review experience is inspired by OpenReview and adapts parts of its frontend. ProView has its own accounts, backend, database, and course-specific permissions; an OpenReview account is not required.

**Project links:** [deployed demo](https://proview.hoangpc.io.vn) · [repository](https://github.com/kongwoang/ProView) · [implementation status](docs/implementation-status.md). Demo accounts are provided by Hoàng; the shared deployment does not use the local seed credentials below.

## Why ProView?

- **A consistent submission process across courses.** Keep projects, deadlines, and semester history in a shared structure instead of distributing them across unrelated tools.
- **Better projects through feedback.** Classmates review each other's work, authors respond, and instructors assess the resulting evidence. The aim is to improve work through constructive review and controlled revision.
- **Learning through reviewing.** Students practice evaluating another team's work and giving useful feedback. Instructors can identify reviewers and inspect their contributions. Formal reviewer rewards or review-quality grades are a proposed extension, not a current feature.
- **An accountable assessment history.** Preserve what was submitted, which version was reviewed, what the authors answered, and which evidence supported a published grade.
- **Useful references across semesters.** Let eligible students consult selected reports from earlier offerings without exposing every submission or private review.

ProView focuses on course projects. Lecture delivery, quizzes, payments, certificates, and general-purpose chat are outside its current scope.

## Roles and responsibilities

There are three account roles: **Student**, **Instructor**, and **Administrator**. Author and reviewer are contexts in which a student acts, not separate account types.

| Role or context         | Responsibilities in the current system                                                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student as author**   | Work with their project group, upload and submit PDF versions, read released reviews, write rebuttals, and view published grades.                                                                                             |
| **Student as reviewer** | Work on reviews assigned to their group, read the assigned version, declare conflicts of interest, and submit structured feedback.                                                                                            |
| **Instructor**          | Create semester offerings for existing courses; manage their offerings' roster, groups, stages, deadlines, and rubrics; assign and oversee reviews; handle conflicts and reopen requests; publish grades and approve reports. |
| **Administrator**       | Create and manage accounts and the course catalog, assign additional instructors, inspect system-wide audit records, and perform explicitly authorized staff operations.                                                      |

Students can also access approved reports from previous offerings of the same course when eligible. Downloads depend on the publication policy. This is a Student capability, not a separate role.

Permissions depend on the particular offering, group, assignment, or publication. An instructor does not automatically manage every offering. An administrator is not automatically a reviewer or grader.

The instructor plays a coordinating role comparable to an area chair in a research review process. **AC is an analogy, not a separate ProView role.** See [authorization](docs/authorization.md) for the access rules.

## Core concepts

Use these names consistently in the report, diagrams, database design, and demo walkthroughs.

| Concept                         | Meaning                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Course**                      | A reusable catalog entry, such as Systems Analysis and Design. Created by an administrator.                             |
| **Course offering**             | One delivery of a course in a particular semester, with its own instructors, students, configuration, and history.      |
| **Project group / Project**     | A group of enrolled students and its project. Membership history is retained.                                           |
| **Submission stage**            | A configurable milestone such as Proposal or Final Report, with deadlines, a rubric, and review settings.               |
| **Submission**                  | The logical record for one project at one stage. It has a workflow state and pointers to selected versions.             |
| **Submission version**          | A numbered PDF version. Uploading creates a draft version; explicit submission selects the version being handed in.     |
| **Reviewer assignment**         | Permission and responsibility to review a specific version using a specific rubric revision in a specific review cycle. |
| **Review / Rebuttal**           | Reviewer feedback and the author's response. Submitted reviews and finalized rebuttal snapshots retain their history.   |
| **Grade / Archive publication** | A published assessment and a separate approval to share an exact report version as a reference.                         |

**Older versions are retained.** ProView does not overwrite the previous PDF or keep only the last upload. This lets the team explain which document each review, similarity result, and grade refers to.

## Features and course configuration

Instructors configure the assessment process for each offering and stage. The system supports different workflows within explicit rules, rather than an unrestricted workflow builder.

| Area                 | Supported behavior                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Course organization  | Offerings, enrollment records, CSV roster preview/import, project groups, and copying an offering's configuration into a new term.                                 |
| Submission           | Private PDF storage, version history, explicit submit/resubmit, deadlines, and instructor-authorized reopening.                                                    |
| Review setup         | Enable or disable reviews per stage, set peer-review counts, and create manual assignments or preview/apply automatic assignments.                                 |
| Review criteria      | Versioned rubrics with criterion descriptions, weights, score ranges, required/optional responses, comment requirements, and optional recommendation requirements. |
| Review participation | Collaborative group review, individual instructor review, conflict-of-interest declarations, and controlled reassignment.                                          |
| Anonymity            | Named reviews or reviewer identities hidden from authors. Authorized instructors can still see the real identities.                                                |
| Author response      | Batch release of reviews, optional rebuttal windows, general and per-review responses, and contextual discussion.                                                  |
| Similarity checks    | Optionally require a recorded external check for a specific version. Staff use COOPY manually and record the result or a reasoned waiver/failure.                  |
| Grading              | Private drafts, criterion-based scores, instructor feedback, controlled publication, and correction history.                                                       |
| Reference archive    | Explicit report approval/revocation, later-cohort access, and a separate download permission.                                                                      |
| Supporting features  | Role-aware dashboards, in-app notifications, audit records, and account/session management.                                                                        |

**Scoring:** required rubric criteria need scores. Optional criteria may be left unanswered; every criterion response that is supplied includes a numeric score. Qualitative feedback is also supported. A dedicated “comments-only review” mode that removes scoring from the form is not currently implemented.

**Anonymity:** the current mode is anonymous **to authors**, not a claim of double-blind review. **Similarity:** ProView does not call a COOPY API, automatically detect plagiarism, or automatically turn a similarity percentage into a grade penalty.

## How it works

A typical reviewed stage follows this process:

1. **Prepare the offering.** The administrator creates the course catalog entry and accounts. The instructor creates an offering, enrolls students, organizes project groups, and configures stages, deadlines, review settings, and rubrics.
2. **Upload and submit.** An author group uploads a PDF and explicitly submits a chosen version before the input window closes. Further versions can be submitted while the window and workflow permit it. Uploading alone does not replace the submitted version.
3. **Assign reviewers.** The instructor assigns another student group or an instructor to a submitted version. Automatic assignment provides a preview before application and excludes self-review, shared-membership conflicts, and relevant declared conflicts.
4. **Review.** Reviewers read the assigned PDF, save a shared draft, and submit feedback against the pinned rubric. Conflicts of interest go to the instructor for a decision and possible reassignment.
5. **Release feedback and respond.** Submitted reviews become visible to the authors as a released batch. If rebuttal is enabled and its window is open, authors can respond and finalize their rebuttal.
6. **Complete assessment.** Staff record any required external similarity result for the exact version. The instructor completes a grade draft and publishes it when the workflow, locked input, rubric scores, and evidence checks allow publication.
7. **Close and preserve.** The offering is closed after assessment. An authorized instructor or administrator may separately approve a finalized, graded report for the reference archive. Approval does not expose the entire project's private history.

The primary submission states are:

```text
DRAFT → SUBMITTED → UNDER_REVIEW → REBUTTAL_OPEN → REVIEW_COMPLETED → FINALIZED
```

Stages without reviews use `finalize-input` to move from `SUBMITTED` to `REVIEW_COMPLETED`. Review release can skip rebuttal when no applicable rebuttal window exists. Grade publication moves the submission to `FINALIZED`.

A rebuttal is an answer to feedback, not a replacement PDF. Further document revisions require another configured stage or an instructor-authorized full reopen. A full reopen starts a new review cycle, preserves historical evidence, and clears or revokes the affected current pointers and publication. Review correction, rebuttal reopening, and grade correction are separate operations.

See [workflow and evidence](docs/workflow.md) for the detailed transitions and deadline behavior.

### Current behavior and ideas to discuss

The following distinctions are important when turning initial ideas into ADSys deliverables:

| Initial idea                                       | Current implementation / design decision                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instructor creates a course                        | Admin creates the catalog course; instructor creates and manages its semester offering.                                                                                                                 |
| Keep only the final upload                         | Retain immutable versions and explicitly select the submitted one.                                                                                                                                      |
| Assign a project to individual classmates          | Peer assignments target **project groups**; group members collaborate on one review. Individual **instructor** assignments exist. Independent student reviewer assignments need a design change.        |
| Authors suggest preferred reviewers                | Not implemented. Keep reviewer nomination as a proposal with eligibility, conflict, and fairness rules to be agreed.                                                                                    |
| Assignment must wait until the submission deadline | This is a possible course procedure. The backend permits eligible assignments before that deadline; assignment locks the selected submission's input. A mandatory post-deadline gate would be a change. |
| Review with or without scores                      | Rubric rules control required responses. A dedicated comments-only form is a proposal; see the scoring explanation above.                                                                               |
| Reviewers receive recognition from the instructor  | A learning objective. Automated rewards, badges, reviewer grades, and reviewer-quality evaluation are not implemented.                                                                                  |

Do not model a proposal as an existing feature. Record the change and agree it with Hoàng before treating it as the shared baseline.

## Architecture

ProView uses a **layered modular monolith**: a Next.js frontend and an independent NestJS API, with business modules sharing a PostgreSQL database.

| Component               | Responsibility                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Next.js / React         | Navigation, forms, project/review views, and role-aware presentation.                                                         |
| NestJS API              | Session authentication, contextual authorization, validation, workflow transitions, grading, and audience-specific responses. |
| PostgreSQL / Prisma     | Academic records, version references, constraints, audit records, and notification outbox events.                             |
| Private storage adapter | PDF bytes in local storage or an S3-compatible backend. Authorized API routes serve files.                                    |
| Background processing   | Deadline handling and notification delivery with retry and deduplication.                                                     |

The browser uses same-origin `/api/v1` routes. Workflow changes, audit records, and notification intents commit together in the database. Private files are not public storage URLs. A module is not a separate microservice.

The native pilot uses Cloudflare Tunnel and Caddy on a single host without root access. Docker Compose is also provided for local/container operation. See [native deployment](docs/native-deployment.md), [database design](docs/database.md), and [schema](apps/api/prisma/schema.prisma). Some earlier planning documents describe alternatives; use the current services, migrations, and release evidence when resolving discrepancies.

## ADSys team workflow

The demo is a shared reference for analysis and design. Every team member should understand the implemented behavior before documenting their assigned part.

1. **Explore the relevant workflow.** Use the assigned demo account and record the actor, starting state, actions, result, and any unexpected behavior. Use agreed test data; coordinate changes to shared course configuration.
2. **Check the implementation.** Confirm entity names and relationships in the Prisma schema and migrations, and permissions/transitions in the backend. A screen alone does not prove a database relationship or access rule.
3. **Use one drawing template.** One designated design coordinator prepares the common draw.io template and shared Google Drive folder before the team creates final diagrams.
4. **Complete an owned task.** Each task has an owner, reviewer, dependencies, source references, and explicit acceptance criteria. Keep editable `.drawio` sources alongside report exports.
5. **Report mismatches and proposals to Hoàng.** Describe what exists, what should change, why, and which diagrams/data/API/UI are affected. Changes become the baseline only after agreement and corresponding implementation/documentation updates.
6. **Review consistency before submission.** Use cases, activities, sequences, state models, classes, ERDs, and screens must describe the same rules and vocabulary.

The [ADSys collaboration guide](docs/adsys-collaboration.md) contains the task breakdown, Drive layout, drawing conventions, task/bug/change templates, and definition of done. The shared Drive folder and template owner still need to be designated; no folder URL is assumed here.

## Local development

Use **Node.js 24.21.0**, **pnpm 10.34.6**, and **PostgreSQL 17**. Docker is required for the `infra:up` route below. Run commands from the repository root.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm db:migrate
APP_ENV=local SEED_DEMO=true pnpm db:seed
pnpm dev
```

The infrastructure command starts PostgreSQL and MinIO. With an existing PostgreSQL instance, configure `DATABASE_URL` and skip `infra:up`; `STORAGE_DRIVER=local` does not require MinIO. The sample environment uses local storage by default.

Open [the application](http://localhost:3000), [API readiness](http://localhost:3001/api/v1/health/ready), or [local API documentation](http://localhost:3001/api/docs).

<details>
<summary>Local demo accounts</summary>

The opt-in local/test seed creates `admin`, `instructor`, and `student1` through `student12`, with password `ProViewDemo!2026`. It also copies sample PDFs into private storage and preserves existing seeded data when repeated.

These credentials are for a local/test environment only. Deployment accounts are supplied separately by Hoàng. Account creation in the application is administrator-managed.

</details>

For deployed environments, configure production secrets, HTTPS, secure cookies, and private storage; keep demo seeding disabled. `APP_ENV` controls environment policy separately from `NODE_ENV`. Follow the [deployment checklist](docs/deployment-checklist.md) rather than deploying the example environment unchanged.

### Development checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
pnpm format:check
```

For integration, browser, and recovery checks, follow [testing](docs/testing.md). These checks create or mutate fixtures and must use disposable local/test data, not the shared deployment. Passing unit tests does not establish that every acceptance scenario has passed.

### Repository layout

```text
apps/web/          Next.js application and ProView UI
apps/api/src/      NestJS API, policies, and business modules
apps/api/prisma/   Database schema, migrations, and local/test seed
packages/          Shared tooling and configuration
scripts/           Contracts, acceptance checks, and operational tools
tests/             Browser tests
docs/              Requirements, design, operations, and verification evidence
```

## Contributing and reporting issues

Project coordination is handled by **Hoàng** ([kongwoang](https://github.com/kongwoang)). Team members should report bugs, unclear behavior, and improvement ideas found while exploring the demo or preparing ADSys deliverables.

Use a repository issue when available, or send the report through the agreed team channel. Include reproduction steps, expected and actual behavior, the role/context, and relevant evidence. For proposals, describe the affected workflow, data model, permissions, and tests. Do not include passwords, tokens, or private student reports in issue attachments.

Use the [task and report templates](docs/adsys-collaboration.md#6-task-and-report-templates) to make findings actionable. A proposal is not an instruction to silently change the shared demo or draw an incompatible data model.

## Documentation

| Topic                                | Read next                                                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADSys tasks and contribution process | [Collaboration guide](docs/adsys-collaboration.md)                                                                                                                              |
| Workflow and access rules            | [Workflow](docs/workflow.md) · [Authorization](docs/authorization.md)                                                                                                           |
| Data and API                         | [Database](docs/database.md) · [Domain model](docs/domain-model.md) · [Prisma schema](apps/api/prisma/schema.prisma) · [API guide](docs/api.md)                                 |
| Testing and delivery status          | [Testing](docs/testing.md) · [Implementation status](docs/implementation-status.md) · [Verification evidence](docs/evidence/implementation-verification.md)                     |
| Deployment and recovery              | [Native deployment](docs/native-deployment.md) · [Public deployment evidence](docs/evidence/public-deployment.md) · [Backup and recovery](docs/backup-recovery.md)              |
| UI and provenance                    | [Branding](docs/branding.md) · [OpenReview adaptation](docs/openreview-adaptation.md) · [Upstream provenance](docs/upstream-openreview.md)                                      |
| Original planning                    | [Requirements matrix](docs/requirements-matrix.md) · [Implementation plan](docs/implementation-plan.md) · [Original specification](docs/specifications/01-proview-original.txt) |

**Status:** the core academic workflows are implemented, with verification evidence recorded separately. API response-contract coverage and additional security/concurrency acceptance checks remain open. The single-host pilot still has manual reboot startup and backup scheduling; sustained-load certification is not claimed. Consult the linked status and evidence documents for their verification dates and limits.

## Attribution

The frontend adapts selected parts of the official OpenReview source. Upstream notices are retained in [the frontend license](apps/web/LICENSE.md) and [NOTICE](apps/web/NOTICE.md), with details in [upstream provenance](docs/upstream-openreview.md). ProView uses an independent NestJS backend and relational domain model. The deployed frontend provides its source and notices at [`/source`](https://proview.hoangpc.io.vn/source).

The ProView icon was supplied by the project owner. Bundled fonts retain their license files; see [branding](docs/branding.md) for provenance.
