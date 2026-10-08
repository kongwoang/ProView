# Database and demo data

ProView uses PostgreSQL 17 and Prisma 6.19.3. The initial migration is `apps/api/prisma/migrations/20261007000000_initial/migration.sql`; apply migrations rather than `prisma db push`, which does not preserve the additional SQL constraints and triggers.

From the repository root, with `.env` configured:

```sh
pnpm --filter @proview/api db:generate
pnpm --filter @proview/api db:migrate
APP_ENV=local SEED_DEMO=true pnpm --filter @proview/api db:seed
APP_ENV=local pnpm --filter @proview/api exec tsx prisma/verify-constraints.ts
```

Demo seed refuses to run unless `APP_ENV` is `local` or `test` and `SEED_DEMO=true` is explicit. `NODE_ENV=production` is compatible with a local production-build demonstration; `APP_ENV=production` always forbids this seed. Re-running the seed preserves the existing users, passwords and academic records. It does not delete or reset a database.

The demo password is `ProViewDemo!2026`, overridable with `DEMO_PASSWORD` on the first seed. Accounts are `admin@proview.local`, `instructor@proview.local`, and `student1@proview.local` through `student12@proview.local`. Dates are relative to seed time; use `DEMO_SEED_DATE` with an ISO instant for reproducible test fixtures. Do not publish these accounts in a real deployment.

The seed supplies one course; current, historical and later offerings; seven projects; an immutable four-criterion rubric per offering; Proposal and Final Report stages; PDFs with v1/v2 histories; submitted and draft group reviews; released anonymous reviews and rebuttal; a pending similarity check on current v2 while v1 is complete; a completed report; a published historical grade; approved and revoked archive records; and ended historical memberships. The checked-in PDF fixture is a real one-page PDF with an xref table; private copies live beneath `STORAGE_LOCAL_PATH`, default `.data/files` at repository root.

Database evidence collected on 7 October 2026:

- Prisma schema validation and client generation: passed.
- Initial migration against empty PostgreSQL 17.10: passed.
- Complete demo seed and a second no-op seed run: passed.
- Seventeen rejection checks against PostgreSQL, each inside a rolled-back transaction: passed.
- Submitted v2 remains linked to a pending similarity result while its v1 result is completed: passed.

This verifies the database layer. It does not by itself prove HTTP authorization, application workflow or frontend behavior.

For future migrations, one schema owner must generate and review the SQL. Actor and context foreign keys, partial indexes and evidence triggers are explicitly added in SQL; a generated migration diff must not silently remove them. Back up PostgreSQL and the private file store together before production migrations. Restore testing must preserve exact version/checksum/file associations.
