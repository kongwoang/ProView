# Backup and recovery

Run from the repository root with installed workspace dependencies. These tools do not load `.env`; provide the exact database/storage configuration through a protected process environment. PostgreSQL17 client tools (`pg_dump`, `pg_restore`) must match or support the server version. Optional `PG_DUMP`/`PG_RESTORE` select executable paths. `BACKUP_POSTGRES_CONTAINER` uses those tools inside the selected PostgreSQL Docker container; dump/restore bytes travel through streams, never container filesystem paths. Credentials are environment variables and are not placed in command arguments or manifests.

## Create a complete bundle

Set `DATABASE_URL`, `STORAGE_DRIVER`, and either `STORAGE_LOCAL_PATH` or the existing S3 endpoint/region/bucket/credentials/path-style variables. Relative local storage paths resolve against `apps/api`, exactly as the application does. The backup destination must not exist; its parent must exist.

```sh
pnpm backup /protected-backups/proview-2026-10-08
```

The tool holds a read-only PostgreSQL repeatable-read transaction, exports its snapshot to `pg_dump`, records table row counts/content fingerprints, and copies all READY submission and similarity-result PDFs from that snapshot. Each object must match its stored size/SHA-256. READY objects are immutable; new uploads after the snapshot are excluded. Do not run destructive storage cleanup during backup. PENDING/FAILED metadata is retained in the DB dump, but is not claimed as recovered READY bytes.

The bundle contains a custom-format `database.dump`, `objects/<original-key>.pdf`, and a completion `manifest.json` with dump/object checksums and relational fingerprints. The manifest is written last. An interrupted backup is incomplete and cannot be restored. Source data is read-only. The bundle contains private files and account/session hashes: protect/encrypt it, keep it out of Git/CI artifacts and apply an operator-defined retention schedule. SHA-256 detects corruption; it does not authenticate an untrusted backup. Restore only a trusted bundle.

## Restore to isolated resources

Create a **new empty database** and **empty private bucket or directory**. Stop API/worker processes for the recovery target; prevent another process writing to it. Supply target connection/storage settings, not source settings. The tools refuse a nonempty database or storage target and never use `--clean` to overwrite existing data.

```sh
pnpm backup:restore /protected-backups/proview-2026-10-08
pnpm backup:verify /protected-backups/proview-2026-10-08
```

Restore validates the entire bundle before writing anything, uploads/copies immutable objects, then runs `pg_restore --single-transaction --exit-on-error`. It compares every public table count/content fingerprint and file metadata/parent-version relationship with the captured snapshot, then reads every restored PDF and checks size/SHA-256. Verification is read-only and expects the target to remain frozen. If restoration fails, preserve diagnostics and retry using new empty resources; a partially populated target is intentionally not overwritten.

Use the application release that created the backup. After exact restoration is verified, apply newer migrations deliberately before startup, configure the selected private storage, and run health/login/authorized PDF/grade/archive checks. Verification against the old manifest is expected to differ after migrations or new writes. Set production secrets/TLS independently; never copy a demo environment into deployment.

## Automated recovery rehearsal

```sh
# Only APP_ENV=local/test; source must be a disposable migrated/seeded DB.
# Stop source API/workers to make the post-restore full-data comparison stable.
pnpm test:backup
```

The harness creates a random isolated database and local directory or private S3 bucket, restores a real bundle, verifies all table/version/PDF evidence, rejects a second restore to an occupied DB, rejects corrupted PDF bytes, and detects a missing restored object. It deletes only the resources it created and removes private dump bundles before CI artifact collection. Native CI exercises local storage with PostgreSQL17 container tools; container CI exercises MinIO/S3 after stopping application writes. These rehearsals test the software recovery procedure, not operator scheduling, retention or disaster recovery on an external host.
