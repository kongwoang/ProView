# ADR 0001 — Implemented local pilot architecture

Recorded2026-10-08, accepted for the current implementation. This records decisions already used during implementation; it does not backdate a design approval or certify every acceptance check.

The frontend derives from the pinned official OpenReview Next.js repository, with AGPL notices/source retained. ProView uses its own NestJS REST API and relational PostgreSQL/Prisma model. OpenReview authentication, Notes/Invitations and production network endpoints are outside the runtime. The user supplied brand is recorded separately in `branding.md`.

JWT access tokens remain in browser memory; hashed rotating refresh sessions are in PostgreSQL with HttpOnly cookies. Backend policies combine global role and current offering/group membership. Administrator privileges do not silently grant academic instructor access. Public actor projections omit password/session fields. Reviewer anonymity uses audience-specific backend projections and stable aliases.

Immutable PDF versions, author snapshots, pinned rubric revisions and review cycles bind all academic evidence. Upload and formal submit are distinct commands. Reasoned reopen/correction commands preserve history. Optimistic revisions and transactional row locks reject stale or concurrent changes. Grades use criterion normalization onto0–10 and publish an exact immutable revision. Similarity/COOPY is a manual staff process bound to the exact file version.

Private local/S3 storage delivers authorized bytes through the API. Audit/outbox intent shares domain transactions; PostgreSQL leases/deduplication drive notifications/reminders. A single API instance is the current pilot target; distributed rate limits and representative load are deployment work. Recovery uses a PostgreSQL exported snapshot plus immutable READY objects and verifies every table fingerprint and PDF checksum. Pending/failed objects are not advertised as recovered READY files.

The user currently requires one implementation agent. Work package IDs organize sequential implementation and verification. No external deployment follows from this ADR. See `implementation-status.md`, `architecture.md`, `authorization.md` and `workflow.md` for the current implementation and remaining checks.
