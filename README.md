# ProView

Course Project Submission and Peer Review Platform: course offerings and groups, immutable PDF versions, peer/instructor review, conflicts of interest, rebuttals, manual textual similarity checks, grading and cross-semester reference archives.

The frontend adapts the official OpenReview React/Next.js source; the NestJS API, PostgreSQL model and authorization are independent. No OpenReview account or production API is required. COOPY is a manual staff workflow. This repository is private; upstream license and copyright notices are retained.

## Local setup

Requires Node24.21.0, pnpm10.34.6, PostgreSQL17 and optionally Docker for PostgreSQL/MinIO. Commands run from the repository root.

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm db:migrate
SEED_DEMO=true pnpm db:seed
pnpm dev
```

An existing local PostgreSQL database matching `DATABASE_URL` also works; `STORAGE_DRIVER=local` needs no MinIO. Demo seed requires explicit `SEED_DEMO=true` and `APP_ENV=local` or `test`, and preserves existing data when repeated. The seed copies actual sample PDFs to the private storage directory.

Open [ProView](http://localhost:3000), [API readiness](http://localhost:3001/api/v1/health/ready) or local [API documentation](http://localhost:3001/api/docs). Demo usernames are `admin`, `instructor` and `student1` through `student12`; password is `ProViewDemo!2026`. These credentials are only for an opt-in local/test demonstration.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

`NODE_ENV=production` controls optimized builds; `APP_ENV=local` retains explicit local runtime settings. Deployed `APP_ENV=production` requires a strong private JWT secret, HTTPS frontend URL, secure cookies, disabled demo seed and private storage credentials. Never deploy the example environment unchanged.

## Verification

See [testing](docs/testing.md) for PostgreSQL, HTTP and Chromium commands; [verification evidence](docs/evidence/implementation-verification.md) lists actual results and outstanding checks. HTTP tests create isolated course/offering fixtures. Browser mutation tests exercise the opt-in local demo; use a disposable test database for repeatable CI.

## Architecture and operations

- [Architecture](docs/architecture.md), [database](docs/database.md), [domain model](docs/domain-model.md).
- [Workflow](docs/workflow.md), [authorization](docs/authorization.md), [API guide](docs/api.md).
- [Deployment checklist](docs/deployment-checklist.md).
- [OpenReview provenance](docs/upstream-openreview.md), [adaptation](docs/openreview-adaptation.md) and retained [license](apps/web/LICENSE.md).
- [Implementation plan](docs/implementation-plan.md), [agent tasks](docs/agent-tasks.md), [domain decisions](docs/domain-decisions.md), [requirements matrix](docs/requirements-matrix.md).
- Original [specification](docs/specifications/01-proview-original.txt) and [frontend override](docs/specifications/02-openreview-override.txt).

Docker Compose includes PostgreSQL, private MinIO, API, web and Nginx. External hosting is outside the current scope. Production containers and private S3 storage pass the disposable GitHub Actions verification; see the exact run in the evidence document. Deployment-specific credentials, TLS, backup/restore and load checks remain required before an external release.
