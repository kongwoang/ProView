# ProView frontend adaptation

## Runtime architecture

The frontend retains the OpenReview React/Next.js App Router starting point, pinned at `3548cc359a3c8e3048112d10de39f45c1f0e7cc9`. Next serves the public shell and static assets. Each browser session owns an API client and React Query client. Calls use `/api/v1`, proxied to the private NestJS origin with `API_INTERNAL_URL` (local default `http://127.0.0.1:3001`). No service account or backend secret is bundled.

Private resources are loaded on the client with a memory-only Bearer access token. Refresh uses an HttpOnly cookie. Refresh is single-flight, requests retry once after 401, and responses from a previous session epoch are discarded. Logout/account changes cancel and clear private queries. A BroadcastChannel invalidates signed-out sessions across tabs. Server-rendered HTML and React server-component payloads contain the shell, not private backend DTOs. Backend authorization remains authoritative.

The entire OpenReview API/auth provider graph has been removed. No API compatibility model of Notes, Invitations or conferences exists. Frontend transport types are public shapes; no Prisma models are imported. Reviewer identities are a named/anonymous union, and anonymity is enforced by backend projection before the browser receives data.

## Source decisions

See [provenance](upstream-openreview.md) for actual source paths and modification inventory. Small proven leaf components are adapted with typed props, semantics and native interactions. Components that transitively require global jQuery, Redux, invitation schemas, OpenReview API calls or profile disclosure are replaced rather than kept behind a compatibility layer.

The active tree includes Next route groups, `providers/session-provider.tsx`, `lib/api`, `components/upstream` and domain `features`. A full source import exists in commit `0843010`, followed by an explicit pruning/adaptation change. There is no Vite or React Router migration.

## Route registry

Public: `/login`, `/source`, root redirect, framework not-found/error pages.

Private: `/dashboard`, `/courses`, `/offerings/[id]`, `/projects`, `/projects/[id]`, `/submissions/[id]`, `/reviews`, `/review-management`, `/grading`, `/similarity-checks`, `/archive`, `/notifications`, `/profile`, `/admin/users`, `/admin/courses`, `/admin/audit`.

Pages are registered only when implemented. Unregistered routes return 404. Former `/forum`, `/venue`, `/venues`, `/invitation`, `/group`, `/donate`, `/signup`, OIDC and chair-console routes are absent from the active router, including direct URL access.

## Component and API conventions

- `useSession()` exposes the authenticated user and per-session API client.
- `queryKeys.resource(user.id, resource, ...context)` scopes cached data by account and resource.
- REST errors expose `code`, `message`, optional field errors and request ID. `409` has an explicit reload/conflict state; form state is not silently overwritten.
- `PageHeader`, `Section`, `Field`, `EmptyState`, `ErrorState` and adapted leaf components supply common states.
- Native forms, visible labels, focus indicators, reduced-motion treatment and responsive CSS replace legacy Bootstrap/jQuery behaviors.
- PDFs are fetched with an authorized binary request, never token query parameters or public storage keys. Components must revoke object URLs on changes/unmount.
- No analytics, external font, script CDN, Turnstile, payment integration or OpenReview runtime endpoint is required. Attribution links are explicit user navigation only.

## Styling

The user requested a more familiar OpenReview interface on 2026-10-08. The shell now uses a compact top header and horizontal role navigation above a centered content column, replacing the fixed sidebar. Course/project/archive results are flat lists with linked titles and metadata; submission tabs, review replies, tables and forms use simple borders and restrained spacing. The login page follows OpenReview's two-column form/access-help arrangement, with administrator-created accounts instead of public signup. The authenticated header searches the existing authorized course-offering list, or the user list for administrators; query parameters prefill the actual page filter. The public login has no data search because ProView requires authentication for academic content.

The original ProView icon and Montserrat ExtraBold wordmark remain; the navy header uses white Pro and a lighter blue/purple View gradient for contrast. After follow-up feedback, the interface adopts OpenReview’s typography, spacing, square input borders, plain section/list presentation and two-tier footer. Self-hosted Noto Sans matches the original body font. Per the user’s explicit clarification, the primary palette stays ProView navy/blue/purple; OpenReview’s maroon is not used. Helvetica/Arial is retained for text inputs and textareas. The navigation adapts to a collapsible in-flow menu on mobile, without hiding notifications/profile/sign out. Administration uses its own dashboard tools; academic workflows retain groups, rubric revisions, exact PDF versions, anonymous reviews, COOPY, published grades and controlled archives. Presentation similarity does not reintroduce OpenReview's Note/Invitation/auth model or external runtime dependencies.

Reference: official [OpenReview login](https://openreview.net/login) and [conference list](https://openreview.net/group?id=ICLR.cc/2026/Conference), visually inspected on 2026-10-08; the pinned upstream styles remain recoverable from import commit `0843010`. No Ant Design/Bootstrap runtime or new UI dependency is required.

## Verification boundaries

[Upstream checks](evidence/upstream-baseline.md) document real baseline successes/failures. ProView integration checks must use its actual backend and database; unit transport tests may use controlled HTTP responses to verify refresh/session races. No fixture fallback appears in production feature code. Final offline and end-to-end acceptance are separate release gates.
