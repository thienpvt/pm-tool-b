# Database migrations

Versioned SQL migrations run by an explicit operator command. The app **never
creates schema at boot** — `getDb()` connects, asserts the `schema_migrations`
ledger exists, seeds the default admin only when `users` is empty, and fails
fast with a runbook message if the ledger is missing.

## The one command

```bash
npm run migrate          # apply pending migrations, then seed-if-empty
npm run migrate -- --check   # print pending; exit 1 when any are pending
```

Requires `DATABASE_URL` (same contract as the app). Migrations are applied in
version order on a **single pooled connection** wrapped in a session advisory
lock, so concurrent `npm run migrate` / multi-replica boots cannot interleave
DDL.

`tsx` is pinned as a devDependency (4.23.12), so after `npm ci` the command runs
hermetically — no registry fetch at migrate time. This matters because the
production runner image has no npm network access.

## Files

- `0001-baseline-schema.sql` — the 35 `CREATE TABLE` statements that used to
  live in `getDb()`'s `initPostgresSchema`.
- `0002-existing-schema-additions.sql` — the cumulative `ALTER TABLE ... ADD
  COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` set plus the two
  `allocated_headcount` numeric conversions (as type-guarded `DO` blocks) that
  used to live in `migratePostgresSchema`.
- Future schema changes get their own `NNNN-description.sql` file.

## Ledger contract

- Applied migrations are recorded in `schema_migrations` (`version`, `name`,
  `checksum`, `applied_at`).
- The `checksum` is the sha256 of the file content at apply time.
- **Append-only, never edit an applied file.** `planPendingMigrations` compares
  the stored checksum against the on-disk file and **fails loudly on drift**
  instead of silently skipping. To change schema, add a new `NNNN-*.sql`.
- Each migration runs as ONE multi-statement query inside `BEGIN`/`COMMIT` — a
  failure rolls back the whole file and rethrows with the filename.

## First migration of the existing shared database

The shared DB already has the full schema (created by the old boot-time path),
so the first `npm run migrate` is an adoption run:

1. **Rehearse against a scratch copy first** — `pg_dump` the live schema into a
   scratch DB, then run `npm run migrate` there and confirm `--check` reports
   clean on the second run.
2. All 0001/0002 statements are idempotent (`IF NOT EXISTS` / `DO`-guarded), so
   the real run against the live DB is a no-op for every statement and simply
   **stamps the ledger**. A broken statement would surface here for the first
   time (the old boot path swallowed errors), which is why step 1 matters.
3. Run it from an **operator machine** with network access and the target
   `DATABASE_URL` (`npm ci` first). See the deployment note below for why.

## One-off data fixes

The four boot-time `UPDATE` fixes and the weighted-completion backfill no longer
run on boot. They are operator-run scripts under `scripts/data-fixes/`:

```bash
npx tsx scripts/data-fixes/01-users-onboarding-completed.ts
npx tsx scripts/data-fixes/02-portfolio-members-member-type.ts
npx tsx scripts/data-fixes/03-projects-company-id-sync.ts
npx tsx scripts/data-fixes/04-activities-jira-parent-repair.ts
npx tsx scripts/data-fixes/backfill-weighted-completion.ts
```

Each requires `DATABASE_URL`, prints `<name>: <rowCount> rows affected`, and
runs its SQL as a single query (no `;` splitting).

## Deploy wiring contract

The runner image ships `migrations/` and `scripts/` so the migrate job CAN run
in the container once the execution path is wired. The documented targets:

- **Railway:** run `npm run migrate` as a pre-start / release command with the
  app's `DATABASE_URL`.
- **Kubernetes:** run the same command as a one-shot `Job` or `initContainer`
  with the app's env.

> **Current limitation (deliberate, deferred):** container auto-migrate is NOT
> wired yet. The runner stage has no devDependencies, so `tsx` (and therefore
> `npm run migrate`) is not present inside the image until a future task vendors
> it or ships a compiled migrate artifact. Until then, the documented recipe is:
> **run `npm run migrate` from an operator machine** against the target
> `DATABASE_URL`. A fresh empty database in a new environment will not
> self-migrate on deploy — the app boots only after an operator runs
> `npm run migrate` once (or the future wiring lands).
