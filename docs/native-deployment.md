# Native deployment without root

ProView can run as an ordinary Linux user, without Docker, sudo or a system service. The verified host is Ubuntu22.04 x86_64, SSH alias `ServerThayQuang`, user `longnd`. All application-owned files are under `/media/data3/users/longnd/ProView`: source, binaries, downloads, dependency stores, temporary files, secrets, PostgreSQL, private PDFs, sockets, logs and backup bundles. Existing operating-system tools/libraries are read, not installed or changed. No user HOME override, shell-profile edit, crontab entry or system-service registration is made.

## Layout and preparation

The checkout root is private (`0700`); `.env` and credential files are `0600`. `.tools/` contains checksum-verified Node24.21.0, PostgreSQL17.10, cloudflared2026.10.0 and Caddy2.11.7, with pnpm10.34.6. Missing Bison/Flex/m4 are downloaded as Ubuntu packages and extracted under `.tools/build-deps`, without installing packages. PostgreSQL is built with OpenSSL/zlib and without ICU/readline; the host must have its C compiler, make and the OpenSSL/zlib development headers. Native files/cache use `.runtime/`; dependencies use `.pnpm-store/` and `node_modules/` inside the checkout.

```sh
cd /media/data3/users/longnd/ProView
bash infra/install-native-tools.sh > .runtime/logs/install.log 2>&1
bash infra/prepare-native.sh > .runtime/logs/prepare.log 2>&1
bash infra/nativectl.sh start
bash infra/nativectl.sh status
```

Create `.runtime/logs` before redirecting the first command. Preparation generates new random database/JWT secrets, initializes an empty database, applies migrations and builds the API/frontend. It never seeds demonstration accounts. The application database role is not a PostgreSQL superuser. Subsequent preparation preserves the existing configuration/database and refuses while the ProView tmux session is running. It is not a rollback-safe release manager: back up, stop and deliberately prepare updates.

## Running and stopping

The supervisor runs in a dedicated tmux session using `.runtime/tmux.sock`; it survives SSH disconnects. It restarts failed child processes with backoff. Logs rotate at10MiB with one previous copy. Stop sends SIGTERM only after checking that the PID still belongs to this user's ProView supervisor; applications stop before PostgreSQL. PostgreSQL fast shutdown retains transactional recovery behavior.

```sh
bash infra/nativectl.sh stop
# Wait until status reports stopped before preparing/starting an updated release.
bash infra/nativectl.sh start
bash infra/nativectl.sh backup
```

The PostgreSQL/socket/files/backups directories remain under `.runtime/`. The latest backup must be copied to an independent location by the operator for protection from server/disk failure; a bundle on the same disk alone does not provide disaster recovery. Do not upload `.env`, secrets, `.runtime` or `.tools` to Git.

No boot hook is installed. With `Linger=no` and no configuration outside the checkout, reboot stops ProView and an SSH login followed by `bash infra/nativectl.sh start` is required. If the operator later permits a user-crontab entry, `@reboot` can invoke this same script without root, but the cron registration itself is necessarily stored outside the checkout and is not part of this deployment.

## Private listeners and public domain

| Service    | Listener                                                   |
| ---------- | ---------------------------------------------------------- |
| PostgreSQL | `127.0.0.1:35432` and the private project socket directory |
| API        | `127.0.0.1:33001`                                          |
| Next.js    | `127.0.0.1:33000`                                          |
| Caddy      | `127.0.0.1:33080`                                          |

Caddy routes `/api/*` directly to the API and other paths to Next.js. It enforces the upload-body ceiling and maps Cloudflare's client-IP header to the API's single trusted proxy. For the public ProView hostname, Cloudflare requests carrying `X-Forwarded-Proto: http` receive a308 redirect to HTTPS, preserving the URI. The final response carries one HSTS header. These listener addresses are intentionally inaccessible from the public network. Do not expose them or use this proxy behind an untrusted public listener.

Production configuration requires HTTPS `https://proview.hoangpc.io.vn`, secure cookies and disabled demo seed/API documentation. HTTP loopback checks establish internal readiness, not a working public login/TLS deployment. An initial administrator must be provisioned with the audited CLI using operator-selected account details and a protected password.

Before publication, the operator must activate Cloudflare DNS for `hoangpc.io.vn`, preserving existing website/mail records, and supply the named Tunnel credentials through a protected file. Store credentials/certificates inside `.runtime/secrets`; put the tunnel configuration at `.runtime/cloudflared.yml`, with an explicit credentials path and ingress to `http://127.0.0.1:33080` for `proview.hoangpc.io.vn`, followed by a404 catch-all. The supervisor starts cloudflared only when this config exists. Set explicit credential/certificate paths rather than allowing cloudflared to write to the default home directory. Account login, DNS changes and external publication are separate from the internal server preparation.

The current deployment uses a remotely managed Tunnel named `proview-production`. Its protected `.runtime/cloudflared.yml` contains the Tunnel UUID, `metrics: 127.0.0.1:0` and `loglevel: info`. The protected `.env` exports `TUNNEL_TOKEN_FILE` with the absolute path to `.runtime/secrets/cloudflare-tunnel-token.txt` (`0600`); no account-wide origin certificate is needed. Published ingress and the404 catch-all are managed in the Cloudflare dashboard. Metrics use an available loopback port, reported in the Tunnel log. Never paste the token into command arguments, logs or Git. See [public deployment evidence](evidence/public-deployment.md) for activation and checks.

Complete the source/license availability requirement in `deployment-checklist.md`, verify client-IP isolation, HTTPS login/refresh/logout, authorized PDF Range requests and a representative lifecycle through the actual domain before handing the public service to users.
