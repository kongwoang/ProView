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

Navy `#0D1B3D`, blue `#1565E8` and purple `#584AF7` form the theme. The academic-review layout prioritizes submission context, version history, reviews and evidence. System fonts render offline. An Ant Design/Bootstrap runtime is not required by the selected reused leaf components.

## Verification boundaries

[Upstream checks](evidence/upstream-baseline.md) document real baseline successes/failures. ProView integration checks must use its actual backend and database; unit transport tests may use controlled HTTP responses to verify refresh/session races. No fixture fallback appears in production feature code. Final offline and end-to-end acceptance are separate release gates.
