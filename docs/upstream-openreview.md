# OpenReview provenance and ProView modifications

Inspected and imported on 2026-10-07 (Asia/Ho_Chi_Minh).

| Property                      | Verified value                                                            |
| ----------------------------- | ------------------------------------------------------------------------- |
| Official repository           | https://github.com/openreview/openreview-web                              |
| Commit                        | `3548cc359a3c8e3048112d10de39f45c1f0e7cc9`                                |
| Branch                        | `master`                                                                  |
| Exact tag                     | None (`git describe --tags --exact-match HEAD` exits 128)                 |
| Package version               | `1.15.38`                                                                 |
| Commit date                   | `2026-10-05T19:10:32-04:00`                                               |
| License                       | AGPL-3.0-or-later, as stated in the upstream README                       |
| Copyright                     | © 2019–2026 OpenReview                                                    |
| Baseline import in ProView    | `0843010` (complete tracked source archive, without upstream Git history) |
| Upstream package-lock SHA-256 | `e81392040b5cd1598cad12e328a7ce9a490e0e166b21a11a65e5bfaa895fabe9`        |

The import used `git archive HEAD`, so no upstream `.git`, local installation, credentials or build artifacts were copied. The initial import has 780 tracked files; see [inventory](evidence/upstream-files.txt). A subsequent adaptation removes unused conference functionality from the runtime tree. The baseline is recoverable from the import commit and pinned upstream. Its package manifest and lockfile remain under `apps/web/upstream/` as evidence, not active package-manager inputs.

## Retained and adapted source

All paths below refer to the pinned commit. Every adapted leaf component includes a source/license comment.

| Upstream source                                       | ProView destination                       | Changes                                                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/layout.js`, Next App Router organization         | `apps/web/app/layout.tsx`, route groups   | Retain React/Next structure, replace metadata, providers, navigation and styling; no remote font or analytics fetch                               |
| `next.config.js`                                      | `apps/web/next.config.js`                 | Retain Next configuration; same-origin API rewrite, security headers, standalone output; remove OpenReview env exports and Git-dependent build ID |
| `components/LoadingSpinner.js`                        | `components/upstream/LoadingSpinner.tsx`  | Typed props, accessible live status, retained five-bar presentation                                                                               |
| `components/SpinnerButton.js`                         | `components/upstream/SpinnerButton.tsx`   | Typed native button props, actual form submit type, busy/disabled behavior                                                                        |
| `components/Alert.js`                                 | `components/upstream/Alert.tsx`           | Replace Bootstrap/jQuery dismissal with React state; semantic error/status roles                                                                  |
| `components/Table.js`                                 | `components/upstream/Table.tsx`           | Typed columns, caption and responsive overflow                                                                                                    |
| `components/PaginationLinks.js`                       | `components/upstream/PaginationLinks.tsx` | Retain bounded numbered window/count logic; native buttons and accessible current-page state; remove query-string dependency                      |
| `styles/global.scss` spinner rules                    | `app/globals.css`                         | Retain animation with ProView colors and reduced-motion support                                                                                   |
| `components/Note.js`, `components/forum/ForumNote.js` | Submission/review feature presentation    | Use submission title/identity/status metadata, explicit versions and threaded evidence layout; replace generic Note/Invitation orchestration      |
| `LICENSE.md`                                          | `apps/web/LICENSE.md`                     | Unmodified                                                                                                                                        |

Paths in the destination column are relative to `apps/web` except where shown in full. No OpenReview images, fonts, logos, templates or third-party imported media are retained. ProView branding uses the user-supplied original icon and self-hosted Montserrat wordmark; the interface body uses independently sourced, self-hosted Noto Sans, with system fallbacks. See [brand provenance](branding.md).

## Replaced and removed

OpenReview server/client authentication, `middleware.js`, `lib/api-client.js`, Redux providers, guest clearance, Google analytics/fonts, sockets, dynamic webfields, generic NoteEditor, research profiles, public signup/activation, marketing, donations, sponsors, conference/venue/bidding/chair consoles and invitations are removed from the active graph. Their API domain models are not emulated. ProView uses its own NestJS REST API, relational DTOs, local accounts and private authorization.

Original automation/deployment files, `.mcp.json`, editor settings and unrelated agent instructions are also removed. The active dependency graph uses one root pnpm lockfile after recording the original npm baseline.

## Source availability

`apps/web/NOTICE.md` and the visible `/source` route preserve attribution. Every frontend build now generates `/source/frontend.tar.gz`, `/source/LICENSE.txt` and `/source/manifest.json` from the same input tree. The download includes the modified frontend, dependency lockfile, shared lint configuration, build/start/source-packaging scripts, attribution and build instructions; it does not require access to the private development repository. An extracted archive was installed with the frozen lockfile and built independently without backend source or runtime data. Operators must keep this source offer aligned with their deployed modifications. The REST separation does not itself resolve the license treatment of every part of the resulting application.

## Verification

See [baseline evidence](evidence/upstream-baseline.md). Baseline failures are recorded separately from ProView checks; they are not presented as successful checks.

The 2026-10-08 visual refinement follows the actual pinned OpenReview `app/layout.js`, `styles/utils/_constants.scss`, `styles/global.scss`, login styles and footer structure. `components/workspace-footer.tsx` records its footer adaptation. Noto Sans comes from Google Fonts under SIL OFL; checksummed original and derived assets are documented in [branding](branding.md). This is presentation reuse; the OpenReview auth/data provider graph remains absent.
