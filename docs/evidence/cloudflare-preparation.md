# Cloudflare preparation — 2026-10-08

The authenticated Cloudflare dashboard shows `hoangpc.io.vn` on the Free plan,
pending nameserver activation. Assigned nameservers are `etta.ns.cloudflare.com`
and `frank.ns.cloudflare.com`. A direct parent-zone query to
`a.dns-servers.vn` still returns `ns1.vietnix.net` and `ns2.vietnix.net`; no DS
record was returned. No nameserver, DNS record, SSL mode or Tunnel credential
change was performed in this preparation.

Cloudflare imported four apex A records (`185.199.108.153` through
`185.199.111.153`) and `www CNAME kongwoang.github.io`. These targets match both
Vietnix authoritative servers. All five imported records have proxy enabled;
review that change to the existing website traffic before activating the zone.

The quick import missed the existing TXT record at
`_github-pages-challenge-kongwoang.hoangpc.io.vn`, verified directly against
Vietnix. The user is unsure whether other records/services exist. The complete
Vietnix DNS inventory must be obtained and preserved before switching
nameservers; testing common names is not a complete zone inventory.

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
