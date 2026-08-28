# Database migrations

Versioned SQL migrations run by an explicit operator command. The app **never
creates schema at boot** once the data-layer cutover completes — `getDb()`
connects, asserts the `schema_migrations` ledger exists, seeds the default admin
only when `users` is empty, and fails fast with a runbook message if the ledger
is missing.

## The one command

```bash
npm run migrate              # apply pending migrations, then seed-if-empty
npm run migrate -- --check   # print pending; exit 1 when any are pending
```

Requires `DATABASE_URL` (same contract as the app). Migrations are applied in
version order on a **single pooled connection** wrapped in session advisory lock
`pg_advisory_lock(1347246335)`.

**Do not run two migrate processes in parallel against the same database.** The
advisory lock serialises concurrent sessions on one connection, but two
separate operator shells (or two deploy jobs) can still race ledger writes if
both start before either acquires the lock. Run one migrate at a time per
target database.

`tsx` is pinned as a devDependency (4.23.12), so after `npm ci` the command runs
hermetically — no registry fetch at migrate time.

## Files

- `0001-baseline-schema.sql` — the full v2.0 schema, in three labelled parts:
  - **Part 1** — 35 `CREATE TABLE IF NOT EXISTS` statements from
    `lib/db.ts` `initPostgresSchema`.
  - **Part 2** — cumulative `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` /
    `CREATE TABLE IF NOT EXISTS` from `migratePostgresSchema`, minus the four
    boot-time data-fix `UPDATE`s (those move to `scripts/data-fixes/` in 19-03).
    The two `allocated_headcount` numeric conversions are type-guarded `DO`
    blocks so brownfield stamp does not abort on already-converted columns.
  - **Part 3** — v2.0 DDL exported from `lib/db-*.ts` (`MAPPING_TENANT_DDL`,
    `ROLES_AUDIT_DDL`, project master, RAID, weekly reports, fiscal budget,
    dashboards, documents). RAID unique indexes come **after** backfill DML
    inside Part 3 (D-09).
- Future schema changes get their own `NNNN-description.sql` file.

`0001` is regenerated from the current codebase — **not** copied from the origin
`gsd/quick-260826-ded-data-layer-migrations` branch (that baseline lacks v2.0
tables such as `weekly_periods` and `user_roles`).

### Why Part 2's redundancy is kept on purpose

Part 2 repeats work Part 1 already does on a fresh database. Folding those
columns into Part 1 table bodies would read better and is **wrong**:
`CREATE TABLE IF NOT EXISTS` cannot add a column to a table that already exists,
so a folded-in column would never reach a **pre-existing** database. The
`ADD COLUMN IF NOT EXISTS` statements are the repair path for brownfield DBs.
Keep both parts.

## Ledger contract

- Applied migrations are recorded in `schema_migrations` (`version`, `name`,
  `checksum`, `applied_at`).
- The `checksum` is the sha256 of the file content at apply time.
- **Append-only — never edit an applied file.** `planPendingMigrations` compares
  the stored checksum against the on-disk file and **fails loudly on drift**
  instead of silently skipping. To change schema, add a new `NNNN-*.sql`.
- Each migration runs as ONE multi-statement query inside `BEGIN`/`COMMIT` — a
  failure rolls back the whole file and rethrows with the filename.

## First migration of the existing shared database (brownfield stamp)

The shared DB may already have the full schema (created by the old boot-time
path). The first `npm run migrate` is an adoption run:

1. **Rehearse against a scratch copy first** — `pg_dump` the live schema into a
   scratch DB, then run `npm run migrate` there and confirm `--check` reports
   clean on the second run.
2. Every statement in `0001` is idempotent (`IF NOT EXISTS` / `DO`-guarded, no
   `DROP TABLE`), so the real run against the live DB is a no-op for existing
   objects and simply **stamps the ledger**. Existing v2.0 tables are kept.
3. Run from an **operator machine** with network access and the target
   `DATABASE_URL` (`npm ci` first).

## One-off data fixes

Boot-time `UPDATE` fixes and v2.0 backfills no longer run on every process
start. They are operator-run scripts under `scripts/data-fixes/` (full set lands
in plan 19-03):

```bash
npx tsx scripts/data-fixes/01-users-onboarding-completed.ts
npx tsx scripts/data-fixes/02-portfolio-members-member-type.ts
npx tsx scripts/data-fixes/03-projects-company-id-sync.ts
npx tsx scripts/data-fixes/04-activities-jira-parent-repair.ts
npx tsx scripts/data-fixes/backfill-weighted-completion.ts
# v2.0 backfills (19-03): backfill-user-roles, backfill-pm-assignments,
# backfill-raid-masters, backfill-mapping-tenant
```

Each requires `DATABASE_URL`, prints `<name>: <rowCount> rows affected`, and
runs its SQL as a single query (no `;` splitting).

## Deploy wiring contract

Docker `COPY` of `migrations/` into the runner image is plan **19-04**. Until
then, run `npm run migrate` from an operator machine against the target
`DATABASE_URL`. Documented targets once wired:

- **Railway:** `npm run migrate` as a pre-start / release command.
- **Kubernetes:** same command as a one-shot `Job` or `initContainer`.

The production runner image may not include `tsx` until 19-04 vendors it or ships
a compiled migrate artifact.
