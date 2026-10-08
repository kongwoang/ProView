# Public native deployment — 2026-10-09 (Asia/Ho_Chi_Minh)

ProView is available at `https://proview.hoangpc.io.vn`. Application release
`0451736171ed6fbcf5ac243c7729c360478bf4ea` was built and activated on
`ServerThayQuang`, under `/media/data3/users/longnd/ProView`, without root.
The native proxy subsequently received a validated HTTPS redirect/HSTS update.
No demo accounts, courses or submissions were created in production.

## DNS and Tunnel

- Both `.vn` parent authorities now delegate to `etta.ns.cloudflare.com` and
  `frank.ns.cloudflare.com`; the authenticated dashboard confirms activation.
- All ten existing DNS records were queried against the active Cloudflare
  authority and matched their original targets. Existing records remain
  DNS-only. The original `https://hoangpc.io.vn/` website returned200.
- Cloudflare and Google public resolvers return Cloudflare addresses for
  `proview.hoangpc.io.vn`. A local resolver subsequently returned ENOTFOUND
  during propagation; later focused checks pinned an independently verified
  Cloudflare address while retaining hostname/certificate verification.
  No local hosts file, DNS setting or certificate validation was changed.
- Remotely managed Tunnel `proview-production` is Healthy, with one connector
  and four QUIC edge connections. It publishes only this hostname to
  `http://127.0.0.1:33080`, followed by a404 catch-all. Private WARP routing is
  disabled. Token files are0600 under `.runtime/secrets`; no account-wide
  origin certificate was provisioned. Application/database/proxy/metrics
  listeners remain on loopback.

## Verification actually performed

The isolated production-build lifecycle passed from instructor setup through
proposal revisions, assignment/COI, anonymous reviews, rebuttal, manual COOPY,
grading and a later cohort's reference archive. A regression deliberately
stalls the newly created record's RSC request; successful creation still opens
the submission through a fresh document. Direct authorization checks renew the
test actor's session and verify identity before asserting403/404 denial.

[CI0451736](https://github.com/kongwoang/ProView/actions/runs/37816602233)
passed both `validate` and `containers`, including the lifecycle regression and
backup verification. Frontend lint/build and formatting passed locally.

Twenty requests through the actual HTTPS domain verified:

- Login/source/readiness availability and a valid TLS certificate.
- Unauthenticated account/PDF access denied401; API responses are not cached.
- Cross-origin refresh rejected403; refresh without a session rejected401.
- Protected `.env`/runtime paths and disabled API docs returned404.
- Anonymous frontend archive, license and manifest downloads; archive size and
  SHA-256 match the manifest. All83 source-file checksums and the embedded
  `SOURCE-FILES.json` were independently checked, with safe archive paths and
  no backend/runtime/secret files. The deployed navigation fix matches the
  source download. Public logo and font requests returned200.
- Initial real administrator login/me, Secure/HttpOnly/SameSite cookie,
  refresh rotation, reuse rejection, family revocation and logout.

The authenticated browser separately reached the administrator overview,
reloaded it successfully using the refresh cookie, and signed out to the login
page. Test sessions were cleaned up; no academic records were changed.

Focused checks after the native proxy update passed HTTP GET/POST308 redirects,
URI/query preservation, HTTPS login/readiness/unauthenticated API access and one
final HSTS header. The Caddy configuration was validated before deployment.
Only the owned ProView proxy was restarted for this change.

Public proxy checks also compared the API's recorded session IP with
Cloudflare's trace IP: a forged `X-Forwarded-For` did not replace the real
client address, and that test session was revoked afterward. A request with
the forged reserved `CF-Connecting-IP` value was rejected at the Cloudflare
edge. Neither client IP nor credentials are included in this report.

## Backup and operational limits

The pre-update bundle `proview-pre-0451736` verified39 table fingerprints and
zero ready PDFs before and after the application update. A post-public-check
bundle `proview-public-20261009` was verified and copied privately to the Mac;
its database dump SHA-256 matched. The last proxy IP check added only its
revoked authentication session after that snapshot.

Production has one real administrator and no course/PDF data. Authorized PDF
Range and academic workflows have been exercised in isolated populated
environments, including the pre-DNS host rehearsal; they were not rerun with
production academic fixtures through the public domain. This report is not a
complete penetration test or sustained-capacity certification, and does not
close remaining response-schema/AD/S assertion gaps.

Startup after host reboot and backup scheduling/retention are manual under the
directory-only deployment constraint. See [native operations](../native-deployment.md)
and [implementation status](../implementation-status.md).
