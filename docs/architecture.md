# Implemented architecture

ProView is a pnpm workspace with a Next.js/React application in `apps/web`, an independent NestJS API in `apps/api`, and shared compiler/lint configuration in `packages`. PostgreSQL is the system of record. Prisma defines the client model; versioned SQL migrations add contextual foreign keys, partial unique indexes, checks and immutable-evidence triggers.

The browser uses the same-origin `/api/v1` proxy. Production Nginx sends API traffic directly to Nest and other traffic to Next; development Next rewrites the same path to `PROVIEW_API_INTERNAL_URL`. The browser never connects to PostgreSQL, MinIO or OpenReview services. Next renders navigation shells; private evidence is fetched with the authenticated API client and is never embedded in a public server component or shared cache.

Nest applies request IDs, safe HTTP logging, security headers, origin checks for refresh-cookie actions, strict DTO validation and a default authenticated guard. Domain services authorize the current actor against the particular offering, author group, reviewer assignment or approved archive publication. A role alone does not grant instructor access to another offering.

Transactions commit workflow changes, immutable evidence pointers, audit records and notification outbox events together. Mutation handlers lock the relevant submission/review, compare the supplied revision, and reject stale evidence with HTTP409. Assignment plans and roster previews retain input snapshots and can only apply to compatible current data. The outbox claims delivery leases, deduplicates recipient notifications and retries failures. Deadline workers use durable keys and preserve finalized rebuttal evidence.

PDF upload uses a bounded in-memory multipart parser, PDF envelope validation, MIME/extension checks, random private storage keys and SHA-256 metadata. The local and S3-compatible adapters return the same metadata. Database failures compensate by deleting the unreferenced stored object. Only authenticated backend routes serve bytes, including Range responses; responses use private no-store caching. A PDF envelope check establishes the supported file format, not the absence of malicious PDF content.

The frontend retains the official OpenReview baseline in Git history and adapts selected leaf components and academic interaction patterns. ProView auth, courses, submissions, reviews and permissions replace the OpenReview backend model. See `upstream-openreview.md` and `openreview-adaptation.md` for provenance and exact adaptation scope.

Similarity checking is manual: authorized staff downloads a version, checks it externally, then records the result or a reasoned failure/waiver. ProView makes no COOPY network request. Results and grade evidence always pin the same exact PDF version.

Deployment targets a verified local production build. External hosting and public exposure are outside this repository implementation. Docker Compose is provided for PostgreSQL, private MinIO, API, web and proxy; its execution evidence and remaining deployment checks are recorded separately.
