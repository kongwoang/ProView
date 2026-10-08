# Upstream baseline evidence

Date: 2026-10-07. Checkout: `/private/tmp/proview-openreview-baseline`.
Official source: `https://github.com/openreview/openreview-web.git`.
Commit: `3548cc359a3c8e3048112d10de39f45c1f0e7cc9`.

## Environment

Initial baseline used the host Node `v26.5.0`, npm `11.17.0`, macOS arm64. The ProView workspace separately pins its supported Node 24 toolchain. Repository files were unmodified while these checks ran. Dependency lifecycle scripts were deliberately disabled for baseline inspection; no production OpenReview service was used to create data.

| Command                                                                                                                 | Actual result                                                           | Evidence                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `git clone https://github.com/openreview/openreview-web.git /private/tmp/proview-openreview-baseline`                   | First sandbox attempt DNS blocked; allowed network escalation succeeded | Full SHA verified using `git rev-parse HEAD`                                     |
| `git describe --tags --exact-match HEAD`                                                                                | Exit 128; no exact tag                                                  | Package version is not used as commit identity                                   |
| `npm ci --ignore-scripts --no-audit --no-fund`                                                                          | Exit 0; 1,139 packages installed                                        | [install log](upstream-install.log)                                              |
| `npm run lint`                                                                                                          | Exit 0; 0 errors, 3,905 warnings                                        | [lint log](upstream-lint.log)                                                    |
| `npm run unit-test -- --runInBand`                                                                                      | Exit 1; 86/87 suites pass; 808 tests pass, 5 fail, 3 skipped            | [unit log](upstream-unit.log)                                                    |
| `NEXT_TELEMETRY_DISABLED=1 NEXT_PORT=3030 API_URL=http://127.0.0.1:3000 API_V2_URL=http://127.0.0.1:3001 npm run build` | Exit 1; Google Noto Sans fetch blocked by sandbox DNS                   | [build log](upstream-build.log)                                                  |
| Upstream TestCafe integration suite                                                                                     | Not run                                                                 | Requires OpenReview API v1/v2 servers and Firefox, unavailable for this baseline |

The five unit failures are in `unitTests/Donate.test.js`: deleting `window.location` throws in the installed jsdom. They are upstream baseline failures, not ProView regressions. The build failure demonstrates a build-time external font dependency; ProView removes this dependency. Sass serialization warnings were also logged. No claim is made that upstream production behavior was fully verified.

## Inspected source

Read README, LICENSE, CONTRIBUTING, package scripts/lockfile, App Router pages, root layout, auth/middleware/client, Note/Forum/NoteEditor, profile/submission routes, shared components, styles and Jest/TestCafe configuration. The upstream CONTRIBUTING script name `unitTest` differs from the actual `unit-test` package script; the latter was used. Route/files inventory is retained in [routes](upstream-routes.txt) and [files](upstream-files.txt).

The corresponding baseline package and npm lockfile are preserved under `apps/web/upstream`. No `node_modules`, nested Git repository, upstream contributor history or local `.env` was imported.
