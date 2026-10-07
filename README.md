# ProView

Course Project Submission and Peer Review Platform.

ProView manages university course projects from course setup and project groups through versioned submissions, structured peer review, conflict-of-interest handling, rebuttals, manual textual similarity checks, grading, and cross-semester reference archives.

## Project status

Implementation is starting. This first revision contains the consolidated specification and implementation plan; it does not yet provide a runnable application.

## Architecture

- Frontend: React and Next.js, derived from the official [OpenReview web application](https://github.com/openreview/openreview-web).
- Backend: independent NestJS REST API with contextual authorization.
- Database: PostgreSQL and Prisma migrations.
- Storage: private PDF storage through local and S3-compatible adapters.
- Workspace: pnpm, Docker Compose, automated API and Playwright tests.

OpenReview authentication and production services are not application dependencies. Similarity checking through COOPY is a manual staff workflow, not an API integration. The implementation target is a verified local production build; external deployment is not included.

## Implementation documents

- [Implementation plan](docs/implementation-plan.md): architecture, dependencies, delivery stages and acceptance gates.
- [Task packages](docs/agent-tasks.md): 23 work packages with ownership and acceptance criteria.
- [Domain decisions](docs/domain-decisions.md): data model, state machines, permissions and contracts.
- [Frontend adaptation](docs/frontend-adaptation-plan.md): OpenReview baseline and adaptation strategy.
- [Requirements matrix](docs/requirements-matrix.md): coverage of all 59 specification sections and required checks.
- [Original specification](docs/specifications/01-proview-original.txt) and [OpenReview update](docs/specifications/02-openreview-override.txt).

Setup, migration, seed, test and production commands will be added with verified implementation results. Upstream code will retain its applicable license and attribution, with the exact baseline and changes recorded in the repository.
