# Testing

Run from the repository root with the pinned Node/pnpm toolchain. PostgreSQL, migrations, opt-in demo seed and the local API must be ready for the integration checks. Browser tests also require the built frontend on localhost3000. Do not point these fixture-creating checks at production.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
pnpm format:check
pnpm check:offline
pnpm --filter @proview/api exec node --import tsx prisma/verify-constraints.ts
node scripts/acceptance-courses-submissions.mjs
node scripts/acceptance-auth-grading-archive.mjs
RUN_HTTP_TESTS=true pnpm --filter @proview/api exec node --import tsx --test test/review-http.test.ts
pnpm exec playwright install chromium
# Separate API processes are needed between these two browser suites.
pnpm exec playwright test --grep-invert '@lifecycle'
# Restart the test API, then:
pnpm exec playwright test --grep '@lifecycle'
# With API/web stopped: runner starts isolated optimized processes per suite.
pnpm test:acceptance
```

The default unit run explicitly skips HTTP integration; run the enabled command to test it. Authentication is rate-limited to30 login/refresh attempts per IP per minute. Sequential integration/browser suites share that budget; the CI runner starts an isolated API process for each suite including separate focused and full lifecycle browser suites, rather than weakening the application limiter. `pnpm test:acceptance` handles this automatically.

Course/submission acceptance creates isolated course and offering data, checks atomic CSV previews/imports, group freezes, concurrent version numbering, PDF checksums, authorization/Range responses, explicit submit replay, stale conflicts, reopen history and configuration-only copy. The auth/grading/archive suite tests cookie origin, rotation/replay revocation, password/reset/deactivation invalidation, criterion completeness, overrides/corrections, exact-version similarity gating, staff-only operations and later-cohort approved archive access/revocation.

Review HTTP integration creates an isolated offering and relational fixtures, then drives actual HTTP assignment planning/apply, self-review exclusion, COI decisions/replacement, collaborative draft conflicts, score validation, batch release, anonymous DTO/discussion projections, authorized correction history, rebuttal finalization/reopening, reminder/outbox deduplication and expiry snapshots. PostgreSQL rejection checks use transactions rolled back after verifying integrity failures.

Chromium exercises the production frontend against the real API: in-memory sessions/refresh, role boundaries, authorized PDF loading, logout, role pages, PDF upload/explicit submit and persisted peer-review draft. The offline test blocks every external HTTP host and asserts no attempted external request. Trace/screenshot artifacts are saved on failure. Screenshots assist visual review; they do not replace API policy checks.

Assignment-engine tests compare deterministic results to an independent exhaustive oracle for small graphs. Scoring tests cover mixed criterion ranges, missing required evidence, endpoints and invalid ranges. Client unit tests cover refresh singleflight, stale-account responses, refresh into a different account without replaying its old mutation, logout races, no-store/token-URL rules and structured409 errors.

See `evidence/implementation-verification.md` for executed checks. The test suite does not establish full browser/assistive-technology compatibility, malicious-PDF scanning, distributed rate-limit behavior or external-service performance. Automated recovery rehearsals cover snapshot/database/PDF restoration on disposable local/S3 resources; they do not establish recovery on a deployment operator's infrastructure.

Container/S3 verification runs `bash scripts/verify-containers.sh` from a clean checkout without `.env`, with Docker and Chromium installed. It creates a uniquely named disposable Compose project, builds the actual images, migrates/seeds PostgreSQL and private MinIO, runs real HTTP/browser tests through Nginx, denies anonymous object reads and removes only its own test volumes afterward. GitHub's `containers` job runs this independently of native verification.

## Required browser scenarios

`tests/e2e/lifecycle.spec.ts` performs the specification scenarios on a new offering with real instructor/student sessions, without API setup mutations or fixture fallbacks. It runs after the focused browser tests with a freshly started API.

| Scenario          | Executed browser flow                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| E01 Setup         | Create offering, edit both stages, publish rubric, CSV preview/import, create groups; later copy only configuration |
| E02 Submission    | Upload Proposal v1/v2, explicitly submit v2 and retain both history entries                                         |
| E03 Assignment    | Preview/apply six pairs, reject self-pairs, verify balanced workload                                                |
| E04 Conflict      | Declare, approve and replace reviewer; record the explicit peer-quota waiver for an instructor replacement          |
| E05 Review        | Submit structured peer/instructor reviews; staff sees peer identity and author sees anonymous feedback              |
| E06 Rebuttal      | Finalize a shared response, make it read-only and show it with grading evidence                                     |
| E07 COOPY         | Submit Final Report, mark external submission, record12.5% manual result and display it in grading                  |
| E08 Grade         | Author cannot see private draft; publish and verify author feedback                                                 |
| E09 Archive       | Close offering, approve final report, copy later offering/enroll another student, read authorized PDF               |
| E10 Authorization | Actual direct file requests from browser contexts reject an unapproved proposal and unrelated private final report  |

OpenAPI generation/drift uses the built API without a database or listening socket. Response schema coverage is reported rather than inferred from route presence. Auth/profile/error/notification types are generated; other domain response shapes remain pending. `pnpm test:backup` runs only on a disposable local/test source with PostgreSQL client/container tools; see [backup and recovery](backup-recovery.md).
