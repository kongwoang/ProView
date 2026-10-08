# Deployment checklist

The implemented target is local production builds. No external deployment has been performed.

1. Run the full clean database, HTTP and browser checks in `testing.md` on a disposable database and record the exact commit.
2. Build and execute `infra/api.Dockerfile`, `infra/web.Dockerfile` and the private MinIO image on a Docker-capable host. Validate Compose configuration, healthchecks and proxy paths. Local native build results do not certify these images.
3. Provision private PostgreSQL and storage; replace every example password/key and set `APP_ENV=production`, `NODE_ENV=production`, `COOKIE_SECURE=true`, HTTPS `FRONTEND_URL`, `SEED_DEMO=false`, `ENABLE_API_DOCS=false`. Give application storage credentials access only to its private bucket. Encode database URI credentials correctly.
4. Run `pnpm db:migrate` with the release image before application startup. Do not run demo seed in production. Create the initial real administrator using `pnpm admin:bootstrap` with ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_DISPLAY_NAME and ADMIN_PASSWORD supplied through a protected process environment. It refuses any existing administrator and records the creation audit. Never put the password in a committed file or shell history.
5. Configure TLS and a trusted reverse proxy. `TRUST_PROXY=true` assumes one trusted proxy; restrict direct API exposure. Verify body-size limits, timeouts, IP forwarding, Origin checks, secure refresh cookies and authenticated Range requests through the deployed proxy.
6. Test local/S3 storage against the selected production driver, including upload compensation, denied public access and archive revocation. Keep readiness failures actionable; API readiness currently verifies PostgreSQL, not storage availability.
7. Configure database/object backups and retention. Restore both into an isolated environment and verify checksum/version relationships. Monitor failed outbox delivery, expiring leases, error rates and disk/bucket capacity. Database evidence and audit history are intentionally retained.
8. Configure centralized rate limits before multiple API replicas; the current login/refresh limiter is process-local. Review resource limits and background-worker concurrency under representative load.
9. Publish the applicable modified frontend source/license information for any network deployment as required by the retained upstream license. No release authorization is implied by this checklist.

Production containers and S3/MinIO passed the [28377f3 CI run](https://github.com/kongwoang/ProView/actions/runs/37718123514) through Nginx on disposable infrastructure. Remaining production work is explicit: TLS deployment, distributed rate-limit configuration, backup/restore exercise and representative load tests. These do not prevent an opt-in local demonstration.
