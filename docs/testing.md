# Testing

Run from the repository root with the pinned Node/pnpm toolchain. PostgreSQL, migrations, opt-in demo seed and the local API must be ready for the integration checks. Browser tests also require the built frontend on localhost3000. Do not point these fixture-creating checks at production.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:offline
pnpm --filter @proview/api exec node --import tsx prisma/verify-constraints.ts
node scripts/acceptance-courses-submissions.mjs
node scripts/acceptance-auth-grading-archive.mjs
RUN_HTTP_TESTS=true pnpm --filter @proview/api exec node --import tsx --test test/review-http.test.ts
pnpm exec playwright install chromium
pnpm exec playwright test
# With API/web stopped: runner starts isolated optimized processes per suite.
pnpm test:acceptance
```

The default unit run explicitly skips HTTP integration; run the enabled command to test it. Authentication is rate-limited to30 login/refresh attempts per IP per minute. Sequential integration/browser suites share that budget; the CI runner starts an isolated API process for each suite rather than weakening the application limiter.

Course/submission acceptance creates isolated course and offering data, checks atomic CSV previews/imports, group freezes, concurrent version numbering, PDF checksums, authorization/Range responses, explicit submit replay, stale conflicts, reopen history and configuration-only copy. The auth/grading/archive suite tests cookie origin, rotation/replay revocation, password/reset/deactivation invalidation, criterion completeness, overrides/corrections, exact-version similarity gating, staff-only operations and later-cohort approved archive access/revocation.

Review HTTP integration creates an isolated offering and relational fixtures, then drives actual HTTP assignment planning/apply, self-review exclusion, COI decisions/replacement, collaborative draft conflicts, score validation, batch release, anonymous DTO/discussion projections, authorized correction history, rebuttal finalization/reopening, reminder/outbox deduplication and expiry snapshots. PostgreSQL rejection checks use transactions rolled back after verifying integrity failures.

Chromium exercises the production frontend against the real API: in-memory sessions/refresh, role boundaries, authorized PDF loading, logout, role pages, PDF upload/explicit submit and persisted peer-review draft. The offline test blocks every external HTTP host and asserts no attempted external request. Trace/screenshot artifacts are saved on failure. Screenshots assist visual review; they do not replace API policy checks.

Assignment-engine tests compare deterministic results to an independent exhaustive oracle for small graphs. Scoring tests cover mixed criterion ranges, missing required evidence, endpoints and invalid ranges. Client unit tests cover refresh singleflight, stale-account responses, logout races, no-store/token-URL rules and structured409 errors.

See `evidence/implementation-verification.md` for executed checks. The test suite does not establish full browser/assistive-technology compatibility, malicious-PDF scanning, distributed rate-limit behavior, disaster recovery or external-service performance.
