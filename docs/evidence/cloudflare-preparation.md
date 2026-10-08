# Cloudflare preparation — 2026-10-08

The authenticated Cloudflare dashboard shows `hoangpc.io.vn` on the Free plan,
pending nameserver activation. Assigned nameservers are `etta.ns.cloudflare.com`
and `frank.ns.cloudflare.com`. A direct parent-zone query to
`a.dns-servers.vn` still returns `ns1.vietnix.net` and `ns2.vietnix.net`; no DS
record was returned. Nameservers, SSL mode and Tunnel credentials have not been
changed. The pending Cloudflare zone records were subsequently prepared as
described below; production delegation still belongs to Vietnix.

Cloudflare imported four apex A records (`185.199.108.153` through
`185.199.111.153`) and `www CNAME kongwoang.github.io`. These targets match both
Vietnix authoritative servers. All five imported records have proxy enabled;
review that change to the existing website traffic before activating the zone.

The user then supplied the complete ten-row Vietnix DNS table. It includes the
TXT verification record, `study` and `it1140` CNAMEs to `kongwoang.github.io`,
`jetson A 100.100.253.77`, and `_acme-challenge.jetson CNAME
hoangpc-jetson.duckdns.org`. All five missing records were independently queried
against Vietnix and copied to the pending Cloudflare zone. All ten records now
have their original target/content, a one-hour TTL and DNS-only routing. The
reserved Jetson address is correctly not proxied; its ACME CNAME is retained.
Reloading the dashboard confirmed all ten persisted records. No production
nameserver change has been made, so the existing website/network path is not
changed by this preparation.

The operator-selected initial administrator was created through the controlled
bootstrap CLI and its creation recorded in the audit log. The generated password
is held in private `0600` files under the server and local workspace
`.runtime/secrets`; it was not printed or committed. A fresh production backup
after provisioning (`proview-20261008T163332Z`,39 tables, one user, zero PDFs)
was copied to the operator's separate Mac workstation and its dump SHA-256
verified. This is a verified manual off-server copy, not a scheduled backup
service or a new restore rehearsal; the populated restore rehearsal is recorded
in `pre-dns-server-verification.md`.

The frontend source download was extracted into a separate directory, every
input-file checksum verified, installed using the frozen lockfile and built
without backend source. Frontend lint,11 unit tests, the offline source scan and
repository formatting passed. Public-domain TLS/login and Tunnel checks remain
pending DNS preparation and credential provisioning.

Release `f747a71` was built and activated on the native server. After copying
Next standalone static/public assets and restarting, anonymous requests through
the real native Caddy proxy returned200 for the source page, archive, manifest,
license, logo and font. Downloaded archive size/SHA-256 and license contents
matched the built artifacts. Verifying the pre-update backup against the live
database/storage passed afterward: all39 table fingerprints, including the
initial administrator and audit record, were unchanged.
