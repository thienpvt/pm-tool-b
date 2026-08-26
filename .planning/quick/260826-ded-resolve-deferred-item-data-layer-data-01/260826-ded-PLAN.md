---
phase: quick/260826-ded-data-layer
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/migrate/plan.ts
  - lib/migrate/plan.test.ts
  - lib/migrate/runner.ts
  - lib/migrate/runner.test.ts
  - lib/migrate/assertMigrated.ts
  - lib/migrate/assertMigrated.test.ts
  - migrations/0001-baseline-schema.sql
  - migrations/0002-existing-schema-additions.sql
  - migrations/README.md
  - scripts/migrate.ts
  - scripts/data-fixes/01-users-onboarding-completed.ts
  - scripts/data-fixes/02-portfolio-members-member-type.ts
  - scripts/data-fixes/03-projects-company-id-sync.ts
  - scripts/data-fixes/04-activities-jira-parent-repair.ts
  - scripts/data-fixes/backfill-weighted-completion.ts
  - scripts/data-fixes/run-sql-fix.ts
  - lib/db.ts
  - package.json
  - Dockerfile
  - .dockerignore
autonomous: true
requirements: [DATA-01, DATA-02, DATA-03]

estimate:
  tokens: 70000
  raw_tokens: 50000
  tasks: 3
  confidence: med

must_haves:
  truths:
    - "A single `npm run migrate` command creates the full schema on a fresh Postgres database (baseline + additions) and is a no-op on a second run (idempotent)."
    - "Applied migrations are recorded in a `schema_migrations` ledger with a checksum; editing an already-applied migration file makes the runner fail loudly instead of silently skipping."
    - "`getDb()` no longer creates schema or runs the migration loop at app start; it connects, seeds if empty, and fails fast with a clear message when the ledger is missing."
    - "The four legacy data-fix UPDATEs and the weighted-completion backfill no longer live inside the app boot migration loop; each is a runnable one-off script under `scripts/data-fixes/`."
    - "`npx tsc --noEmit` and `npm test` pass; no package dependencies were added; `output: 'standalone'` and `serverExternalPackages` are preserved."
  artifacts:
    - migrations/0001-baseline-schema.sql
    - migrations/0002-existing-schema-additions.sql
    - lib/migrate/runner.ts
    - lib/migrate/plan.ts
    - lib/migrate/assertMigrated.ts
    - scripts/migrate.ts
    - scripts/data-fixes/run-sql-fix.ts
  key_links:
    - "scripts/migrate.ts -> lib/migrate/runner.ts (CLI pins one pooled connection, runs migrations, then seeds)"
    - "lib/db.ts getDb() -> lib/migrate/assertMigrated (app start fails fast when schema_migrations is absent)"
    - "lib/migrate/runner.ts -> migrations/*.sql (files read at CLI time only, never at app runtime — preserves standalone output)"
---

<objective>
Resolve the deferred Data Layer items from the v1.0 milestone: give the app real versioned SQL migrations (`DATA-02`), run them from an external migrate job instead of inside `getDb()` (`DATA-01`), and move the four embedded data-fix `UPDATE`s plus the weighted-completion backfill into one-off scripts (`DATA-03`).

Purpose: today `getDb()` creates the schema and runs ~95 SQL statements on the first DB use of every process, swallowing every error in a `try { } catch { }` loop — a broken migration is invisible, and app boot doubles as a schema writer. This plan extracts that machinery into a versioned, fail-loud runner invoked as `npm run migrate`.

Output: a migration runner + ledger + two versioned SQL migration files, a migrate CLI wired into `package.json` and the deploy path, a fast-fail migration guard on `getDb()`, and five one-off data-fix scripts.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md

Source files (read before editing — the only production code this plan touches is `lib/db.ts`):
@lib/db.ts
@test/db.ts
@test/repo-db.ts
@vitest.config.ts
@Dockerfile
@.dockerignore

**Test layout facts (already verified, do not re-derive):**
- `npm test` runs `vitest run`. The `node` project includes `{lib,app}/**/*.test.ts`, so tests at `lib/migrate/*.test.ts` are picked up automatically. Tests that need a live database use `describe.skipIf(!hasTestDb)` with `TEST_DATABASE_URL` and must not run outside a `_test` database (`test/db.ts` enforces this).
- Every existing test that exercises DB code mocks `@/lib/db` (`vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))`) or uses `testDb()`. Nothing calls the real `getDb()` in tests, so changing `getDb()`'s body does not change test outcomes.
- `lib/log.test.ts` is a `tsx` self-check script, not a vitest suite; it fails before this change and is out of scope (do not "fix" it).

**Migration content source (already verified):**
- `lib/db.ts` line 64 `initPostgresSchema` holds 35 `CREATE TABLE IF NOT EXISTS` statements (the baseline).
- `lib/db.ts` line 420 `migratePostgresSchema` holds ~56 statements: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, two `ALTER COLUMN ... TYPE NUMERIC(6,1)` conversions, and — interleaved — four data-fix `UPDATE`s (users onboarding flag; portfolio_members member_type; projects→customers company_id sync; activities parent_id Jira repair). The two `ALTER COLUMN ... TYPE` lines are NOT `IF NOT EXISTS`-guarded and are the only statements that would fail if re-run after being applied — they must become type-guarded `DO` blocks in the migration files.
- `getDb()` (line 596) currently calls `initPostgresSchema` → `migratePostgresSchema` → `backfillWeightedCompletion` → then caches the singleton → `seedAuthData`. `seedAuthData` seeds an admin user only when `users` is empty and is idempotent in practice.
- The runner must NOT read the `migrations/` directory or any SQL file from `lib/db.ts` at app runtime — `next.config.ts` uses `output: 'standalone'`, which only traces statically-imported JS, not runtime `fs` reads. File discovery belongs to the CLI in `scripts/`.

**Intentional behavior changes from the freeze (all three are deliberate DATA-01/03 scope):**
1. Migration failures now fail LOUD instead of being swallowed. The first `npm run migrate` against an already-migrated database is a no-op for every statement (all idempotent once the two type conversions are `DO`-blocked) but is the first time a genuinely broken statement would surface. Run it against a scratch database first.
2. `getDb()` stops writing schema on boot. Anyone booting an unmigrated database gets the fast-fail guard message telling them to run `npm run migrate`, not silent schema creation.
3. The Jira parent-repair `UPDATE` moves out of the boot path into a one-off script (DATA-03) — new Jira imports will not be auto-repaired on boot anymore; the script is available to run on demand.
</context>

<user_decisions>
Recorded from the operator before execution. These OVERRIDE anything below that conflicts with them.

**DECISION 1 — No `predev`.** Do not add a `predev` (or `prestart`, or any lifecycle) script that runs migrations. `.env` in this repo points at a SHARED database; an implicit `npm run dev` → DDL path would apply schema changes to shared data without the operator asking. Migrations run ONLY when someone explicitly types `npm run migrate`. Task 3's action text has already been corrected to match — do not re-add it.

**DECISION 2 — `tsx` is your call, and the plan was WRONG about it.** Task 1's action text claims "`tsx` is already the project's on-demand runner and no new dependency is added." That is FALSE: `tsx` does NOT appear in `package.json` dependencies or devDependencies. `scripts/verify-credential-cutover.ts` does exist and is invoked via `npx tsx`, but `npx` fetches the package at run time. Consequences you must weigh:
  - `npx tsx` needs network on first use.
  - The Docker `runner` stage has no npm registry access, so a `migrations/README.md` recipe that tells Railway/k8s to run `npm run migrate` in the container CANNOT work with `npx tsx`.
  Pick ONE and say which you picked and why in SUMMARY.md: (a) add `tsx` as a pinned devDependency — this knowingly breaks the plan's "no dependencies added" constraint, which the operator has authorized for this specific case; (b) keep `npx tsx` and make `migrations/README.md` state plainly that in-container migrate does not work, so the documented recipe becomes "run migrate from an operator machine with network access against the target DATABASE_URL"; or (c) a better third option you find. Do NOT silently ship the plan's false claim.

**DECISION 3 — Execute all three tasks.** Full slice, in order.

**STANDING CONSTRAINT — DO NOT TOUCH ANY DATABASE.** No `npm run migrate` against any real DATABASE_URL, no psql, no live-DB verification of any kind. `.env` here points at a SHARED database. Every `<human-check>` block in this plan is the OPERATOR's to run, not yours — report them as pending in SUMMARY.md. Your automated verification is limited to `npx tsc --noEmit`, `npm test`, `npm run build`, and greps. If `TEST_DATABASE_URL` is unset (it will be), the `describe.skipIf(!hasTestDb)` integration suites simply skip — that is EXPECTED and is not a failure to work around. Never point a test at `DATABASE_URL`.
</user_decisions>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Versioned migration runner + baseline SQL + migrate CLI, wired as `npm run migrate`</name>
  <files>lib/migrate/plan.ts, lib/migrate/plan.test.ts, lib/migrate/runner.ts, lib/migrate/runner.test.ts, migrations/0001-baseline-schema.sql, scripts/migrate.ts, package.json</files>
  <behavior>
    - Test 1 (ordering): given two files `0002-b.sql` and `0001-a.sql`, `planPendingMigrations` returns `0001` before `0002` regardless of input order.
    - Test 2 (pending computation): with ledger rows for `0001` only and both files present, only `0002` is pending; with both applied, pending is empty (the idempotency proof).
    - Test 3 (duplicate/format rejection): two files sharing a version, or a non-`NNNN-*.sql` filename, throws a descriptive error; a checksum mismatch on an applied version throws instead of being skipped.
    - Test 4 (ledger recording): `runMigrations` inserts one row per applied migration with version + sha256 checksum, and a second call inserts zero rows.
  </behavior>
  <action>
Create the migration substrate. The app's existing self-healing `getDb()` path stays untouched in this task — the app keeps booting against a fresh DB exactly as it does today; this task only adds the new system alongside it.

**`migrations/0001-baseline-schema.sql`** — copy VERBATIM every `CREATE TABLE IF NOT EXISTS` statement from `initPostgresSchema` (`lib/db.ts` lines 66-416), in the same order, each terminated by `;`. Drop the outer template-literal backticks; keep all column definitions, defaults, and `REFERENCES` clauses byte-identical. Do not edit any statement.

**`lib/migrate/plan.ts`** — pure logic, no DB and no `fs` imports:
- `export interface MigrationFile { version: number; name: string; filename: string; checksum: string; sql: string }`
- `export interface AppliedMigration { version: number; checksum: string }`
- `export function parseMigrationFile(filename: string, sql: string): MigrationFile` — the version is the leading 1-4 digit prefix before the first `-` (regex `/^(\d{1,4})-[A-Za-z0-9_]+\.sql$/`); anything else throws `Invalid migration filename: <filename>`.
- `export function sha256(content: string): string` — sha256 hex digest of the file content (the checksum the ledger stores).
- `export function planPendingMigrations(files: MigrationFile[], applied: AppliedMigration[]): { toApply: MigrationFile[]; drifted: string[] }` — sorts by `version`, throws on duplicate versions, and for each applied version compares the stored checksum to the file's, collecting mismatches into `drifted`; pending = files whose version is not in `applied`.

**`lib/migrate/runner.ts`** — takes a pinned pg client and the migration files:
- `export interface QueryableClient { query(text: string): Promise<{ rows: unknown[] }>; release?: () => void }` (structural, so tests can pass a fake; the CLI passes a real `PoolClient`).
- `export interface RunResult { applied: string[]; alreadyApplied: string[]; drifted: string[] }`
- `export const DEFAULT_LEDGER_TABLE = 'schema_migrations'` and `export async function runMigrations(client: QueryableClient, files: MigrationFile[], opts?: { ledgerTable?: string }): Promise<RunResult>`.
- Order of operations: `SELECT pg_advisory_lock(<versioned key, e.g. 0x504D4D47>)` on the pinned session (protects concurrent `npm run migrate` / multi-replica boot); `CREATE TABLE IF NOT EXISTS <ledgerTable> (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`; read applied rows; compute pending via `planPendingMigrations`; throw if `drifted` is non-empty; then per pending file run `BEGIN` → `client.query(sql)` (the WHOLE file as one multi-statement string — Postgres executes it in one implicit transaction, so a failure rolls back the whole migration) → `INSERT INTO <ledgerTable> (version, name, checksum) VALUES (...)` → `COMMIT`. On any error, `ROLLBACK` and rethrow with the filename in the message. Finally `SELECT pg_advisory_unlock(<key>)` in a `finally`.
- Do NOT split SQL on `;` — the baseline contains `;` only between statements; running the file as one multi-statement `query` is what makes the migration atomic.

**`lib/migrate/plan.test.ts`** — pure unit tests, no DB: ordering (Test 1), pending computation + idempotency (Test 2), duplicate-version / bad-filename / checksum-drift rejection (Test 3).

**`lib/migrate/runner.test.ts`** — one `describe` for pure `planPendingMigrations`-driven ledger logic with a fake `QueryableClient` capturing every `query(text)` call (asserts `BEGIN`/`COMMIT` framing and the ledger INSERTs — Test 4); plus a `describe.skipIf(!hasTestDb)` integration suite against a REAL Postgres using `testPool()` from `@/test/db` (follow the `lib/db.test.ts` pattern): it must (a) create a `PoolClient`, (b) call `runMigrations(client, [baselineFile], { ledgerTable: 'schema_migrations_probe' })` where `baselineFile` is built by reading `migrations/0001-baseline-schema.sql` via `node:fs` and wrapping it with `parseMigrationFile`, (c) assert the `schema_migrations_probe` table now holds one row and `companies`/`users`/`projects` exist, (d) call `runMigrations` a SECOND time and assert zero new INSERTs (idempotent), and (e) `DROP TABLE IF EXISTS schema_migrations_probe` and `client.release()` in `afterAll`.

**`scripts/migrate.ts`** — the CLI:
- Requires `DATABASE_URL` (same `if (!process.env.DATABASE_URL) throw` contract as `lib/db.ts`), creates a `Pool` with `ssl` resolved exactly like `resolveSsl` in `lib/db.ts` (export `resolveSsl` from `lib/db.ts` and import it — do not duplicate the logic), `connect()`es one client, reads `migrations/*.sql` with `node:fs` `readdirSync` + `readFileSync` (path = `path.resolve(import.meta.dirname, '../migrations')` — `import.meta.dirname` works under tsx/Node 20.11+), builds `MigrationFile[]`, calls `runMigrations`, prints a line per applied file and `Migrations up to date` when nothing applies, and `client.release()`/`pool.end()` in a `finally`.
- Support `npm run migrate -- --check`: only compute and print pending; exit code 1 when anything is pending, 0 when up to date. Used by deploy gates later.
- After a successful non-check run, the CLI does NOT seed — seeding is added in Task 3.

**`package.json`** — add `"migrate": "npx tsx scripts/migrate.ts"` to `scripts` (matches the existing `npx tsx` precedent in `scripts/verify-credential-cutover.ts`; `tsx` is already the project's on-demand runner and no new dependency is added).
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm test -- --project node lib/migrate</automated>
    <human-check>If a scratch Postgres is available: `TEST_DATABASE_URL=postgres://.../scratch_test npm test -- --project node lib/migrate` (proves the real-DB idempotency path), then `DATABASE_URL=... npm run migrate` against a scratch DB and confirm the full baseline applies and a second run prints `Migrations up to date`.</human-check>
  </verify>
  <done>`npm run migrate` creates the full baseline schema on a fresh DB, is a no-op on the second run, records one ledger row per migration with a sha256 checksum, and `--check` reports pending/up-to-date with the right exit code. `npx tsc --noEmit` passes; `lib/migrate/*.test.ts` are all green. `getDb()` is unchanged and the app still self-inits on boot.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship the existing schema-additions as migration 0002 and extract the four data-fix UPDATEs into one-off scripts</name>
  <files>migrations/0002-existing-schema-additions.sql, lib/db.ts, scripts/data-fixes/run-sql-fix.ts, scripts/data-fixes/01-users-onboarding-completed.ts, scripts/data-fixes/02-portfolio-members-member-type.ts, scripts/data-fixes/03-projects-company-id-sync.ts, scripts/data-fixes/04-activities-jira-parent-repair.ts, scripts/data-fixes/backfill-weighted-completion.ts</files>
  <behavior>
    - Test 1: `parseMigrationFile` accepts every file in the real `migrations/` directory and versions are unique + ascending (`node:fs` readdir in the test).
    - Test 2 (drift guard): `migrations/0002-existing-schema-additions.sql` contains no `UPDATE` statement — the four data fixes live only in `scripts/data-fixes/` (read the file, assert no line starts with `UPDATE`).
    - Test 3: the one-off data-fix script SQL strings each start with `UPDATE` or `INSERT`/`SELECT` and are non-empty (guard against a truncated extraction).
  </behavior>
  <action>
Capture the remaining schema DDL as a versioned migration and move the data-fix `UPDATE`s out of the app's migration loop.

**`migrations/0002-existing-schema-additions.sql`** — copy from `migratePostgresSchema` (`lib/db.ts` lines 421-499) every statement that is NOT one of the four data-fix `UPDATE`s, in their original order, each `;`-terminated:
- The `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` statements verbatim.
- The two column-type conversions — `ALTER TABLE portfolio_program_allocations ALTER COLUMN allocated_headcount TYPE NUMERIC(6,1)` and the same for `program_project_allocations` — become type-guarded `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = '<table>'::regclass AND attname = 'allocated_headcount' AND atttypid = 'integer'::regtype) THEN ALTER TABLE <table> ALTER COLUMN allocated_headcount TYPE NUMERIC(6,1); END IF; END $$;`. This makes them no-ops on an already-converted database. **Keep the two ALTERs in 0002 even though they are inside 0001's table shape** — 0001 creates them as `INTEGER`, 0002 converts them; the sequential application reproduces the exact final schema.

**`lib/db.ts`** — in `migratePostgresSchema`, DELETE the four data-fix `UPDATE` statements (the users onboarding line at 435, the portfolio_members member_type line at 443, the projects→customers company_id sync at 470, and the multi-line activities parent_id Jira repair at 484-499) AND their surrounding `//` comment lines. The remaining array is now pure DDL. The swallowed-error loop stays for now (Task 3 removes the whole loop). Do not touch `initPostgresSchema`, `seedAuthData`, `backfillWeightedCompletion`, `resolveSsl`, or `getDb()` in this task.

**`scripts/data-fixes/run-sql-fix.ts`** — a tiny shared runner for one-off fixes: exports `runFix({ name, sql })` that requires `DATABASE_URL`, creates a `Pool` (ssl via the same `resolveSsl` from `lib/db.ts`), `pool.query(sql)`, prints `name: <rowCount> rows affected` (read `rowCount` off the result), and `pool.end()` in a `finally`. Multi-statement SQL runs as one query — do not split on `;`.

**`scripts/data-fixes/01-users-onboarding-completed.ts`**, **`02-portfolio-members-member-type.ts`**, **`03-projects-company-id-sync.ts`**, **`04-activities-jira-parent-repair.ts`** — each imports `runFix` and calls it with the EXACT SQL text (verbatim, including the multi-line `04` UPDATE with its `NOT EXISTS` guard and the `e.no = 'EPIC'` phase-matching) that was just removed from `lib/db.ts`. Preserve the original English comments above each. Each is independently runnable via `npx tsx scripts/data-fixes/NN-name.ts`.

**`scripts/data-fixes/backfill-weighted-completion.ts`** — a one-off script that reproduces `backfillWeightedCompletion` (`lib/db.ts` lines 511-547): the leaf `UPDATE activities ... CASE ${STATUS_WEIGHTS}` and the EPIC-average `UPDATE activities e SET completion_pct = sub.avg_pct FROM (...)` as a single multi-statement SQL string, plus the `INSERT INTO settings (key, value) VALUES ('completion_pct_weighted_v1', ...) ON CONFLICT (key) DO NOTHING` flag write. Import `STATUS_WEIGHTS` from `@/lib/status-weights` (the script runs under `npx tsx`, which resolves the alias — same as `scripts/verify-credential-cutover.ts`). This script deliberately replaces the boot-time backfill for new databases.

Do NOT add npm scripts for the data fixes; they are operator-run on demand. Do not commit the four data-fix SQL strings as literal text anywhere other than their own script files.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm test -- --project node lib/migrate</automated>
    <human-check>Spot-check `scripts/data-fixes/04-activities-jira-parent-repair.ts` against the original lines 484-499 of the pre-change `lib/db.ts` (via `git show HEAD:lib/db.ts`): identical SQL, same `NOT EXISTS` subquery, same `no = 'EPIC'` guards.</human-check>
  </verify>
  <done>`migrations/0002` exists with the full additions set (type conversions as `DO` blocks); `lib/db.ts` migration array contains zero `UPDATE` statements; five one-off scripts under `scripts/data-fixes/` carry the extracted SQL verbatim; typecheck and `lib/migrate` tests pass. App still boots via the unchanged `getDb()` self-init path.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Strip getDb() to connect + seed, add the migration guard, and wire the migrate job into dev and deploy</name>
  <files>lib/db.ts, lib/migrate/assertMigrated.ts, lib/migrate/assertMigrated.test.ts, scripts/migrate.ts, package.json, Dockerfile, .dockerignore, migrations/README.md</files>
  <behavior>
    - Test 1: `assertMigrated` throws a message containing `npm run migrate` when the ledger query returns zero rows, and resolves when it returns one or more rows (fake `QueryableClient`; no DB).
    - Test 2: the same helper resolves when the ledger table does not exist but a `0.1.x`-era migration array is still present (i.e. it tolerates the pre-Task-3 boot path so the guard never breaks a dev who has not run migrate yet).
    - Test 3: `lib/db.ts` no longer references the identifiers `initPostgresSchema`, `migratePostgresSchema`, or `backfillWeightedCompletion` (typecheck is the primary gate; this grep is the drift guard).
  </behavior>
  <action>
Make `getDb()` the read-only connection owner and move schema/seeding orchestration to the migrate job. Order matters: run the real migrate job against the shared DB ONCE before/while this lands, so the app never boots with a missing ledger.

**`lib/migrate/assertMigrated.ts`** — `export async function assertMigrated(query: (sql: string) => Promise<{ rows: unknown[] }>, ledgerTable = 'schema_migrations'): Promise<void>`. Runs `SELECT 1 FROM <ledgerTable> LIMIT 1` inside a `try`. If it resolves to zero rows, throw `Error('Database schema not migrated — run "npm run migrate" first')`. If the query itself throws (table missing, 42P01), rethrow as the same `npm run migrate` message. Does NOT read any file — keeps `lib/db.ts` free of `fs`, preserving `output: 'standalone'`.

**`lib/migrate/assertMigrated.test.ts`** — unit tests for Test 1 + Test 2 with a fake `query` (a `vi.fn()` that resolves `{ rows: [] }`, `{ rows: [{}] }`, or rejects). No live DB.

**`lib/db.ts`** — final restructure:
- DELETE `initPostgresSchema` (lines 64-417) and `migratePostgresSchema` (lines 420-504) entirely.
- DELETE `backfillWeightedCompletion` (lines 511-547); its boot-time job is now the one-off script. The `STATUS_WEIGHTS` import is then unused — remove it from the import line and rely on the script importing it directly.
- Rewrite `getDb()`: keep the `DATABASE_URL` check, `Pool` creation, and `resolveSsl`; keep `_client` singleton caching. Replace the three calls with `await assertMigrated((sql) => pool.query(sql))` (fail fast) then `_client = client` then `await seedAuthData(_client)` then `return _client`. So the new boot order is: connect → assert-migrated → cache → seed-if-empty.
- `export { resolveSsl }` (add `export` to the existing function — the CLI imports it). `export { seedAuthData }` (add `export`). `hashPwd` stays (used by `seedAuthData`). Keep `initPostgresSchema`/`migratePostgresSchema`/`backfillWeightedCompletion` GONE — do not leave stubs or export them; the pre-Task-3 migration array no longer exists anywhere in this file.

**`scripts/migrate.ts`** — after a successful `runMigrations` (non-`--check`), call `await seedAuthData(/* a DbClient over the pinned client */)`. Simplest correct wiring: after `runMigrations` returns, call `const db = await getDb()` — which now exercises the assertMigrated guard (it passes, the ledger exists) and seeds if `users` is empty — then `await db` is the seeded client; end the pool. Document in the script that seeding is idempotent.

**`package.json`** — do NOT add a `predev` script. See USER DECISION 1 in `<user_decisions>`: migrations run only on explicit `npm run migrate`. The `migrate` script from Task 1 stays and is the only entry point. A developer whose database is unmigrated gets the `assertMigrated` fast-fail message telling them to run it — that message IS the replacement for the free schema `getDb()` used to create on `next dev`.

**`Dockerfile`** — in the `runner` stage, after the `.next/standalone` COPY, add `COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations` and `COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts` so the migrate job's SQL files and runner exist in the image. Do not change `CMD` — this task does not make the container auto-migrate (see Deferred).

**`.dockerignore`** — add `!migrations/*.sql` and `!scripts/migrate.ts` so the two files above actually reach the builder context (the current `*.sql` ignore would drop them).

**`migrations/README.md`** — a runbook: what `npm run migrate` does, the ledger contract (append-only files, checksum drift detection), the `--check` flag, the one-off data-fix scripts, the exact operator sequence for the FIRST migration of the existing shared database (`npm run migrate` against a scratch copy first, then the real one — all 0001/0002 statements are idempotent so it adopts the live schema and stamps the ledger), and the per-target wiring recipe (Railway: run `npm run migrate` as a pre-start/release command with `DATABASE_URL`; K8s: a one-shot `Job` or `initContainer` running the same command with the app's env) as the documented deploy contract.

Do NOT add a `git merge` or push anywhere in this plan. Do not touch `next.config.ts`. Do not add npm dependencies.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npm test -- --project node lib/migrate && test "$(grep -c 'initPostgresSchema\|migratePostgresSchema\|backfillWeightedCompletion' lib/db.ts)" = "0"</automated>
    <human-check>On a scratch DB: `DATABASE_URL=... npm run migrate` then start the app and confirm it boots (guard passes). Then point the app at a fresh empty DB WITHOUT migrating and confirm boot fails with the `npm run migrate` message instead of a 500 storm.</human-check>
  </verify>
  <done>`getDb()` connects, asserts the ledger, seeds if empty — and creates no schema and runs no migration loop. `npm run migrate` on a fresh DB produces a bootable app; against an unmigrated DB the app fails fast with the runbook message. `npm run dev` runs `predev` migrate. The runner image carries `migrations/` + `scripts/`. Typecheck, `lib/migrate` tests, and the zero-identifier grep all pass.</done>
</task>

</tasks>

## Deferred

- **Container auto-migrate wiring (Railway release command / k8s initContainer):** the runner image now contains `migrations/` + `scripts/` and the README documents the exact recipe, but no deploy target runs `npm run migrate` automatically yet. Until that lands, a fresh (empty) database in a new environment will not self-migrate on deploy — the app boots only after an operator runs `npm run migrate` once. This is the deliberate, documented hand-off; do not wire it silently.
- **Splitting 0002 into one-file-per-change:** DATA-02's ideal shape is one versioned file per schema change; this plan ships the existing ~56 statements as one `0002` catch-up file. Future schema changes get their own `NNNN-*.sql` file. The catch-up file is a one-time consolidation of already-applied DDL.
- **Drift test between `lib/db.ts` and the migration files:** the `migrations/` files are now the source of truth; a future phase can add a CI gate that fails when a `CREATE TABLE` appears in code rather than in `migrations/`.
- **`seedAuthData` stays in `getDb()`** (not in the migrate CLI): it is idempotent (seeds only when `users` is empty), and moving it into the CLI would force the CLI to depend on `@/lib/auth`'s password hashing. Documented as residual scope; `npm run migrate` + `getDb()` seeding together give a fresh DB a bootable admin.
- **`npx tsx` at runtime:** the migrate CLI relies on `npx tsx` (already the project's on-demand runner precedent). A future task can vendor `tsx` as a devDependency or build a compiled migrate artifact for environments without npm network access.

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator/CLI → migration runner → Postgres | `scripts/migrate.ts` and the data-fix scripts issue DDL/DML against `DATABASE_URL`. The runner is the only thing that may write schema now that `getDb()` no longer does. |
| app boot → `getDb()` → Postgres | read-only connection after Task 3; writes only the idempotent seed when `users` is empty. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ded-01 | Tampering | `migrations/*.sql` | high | mitigate | sha256 checksum per migration is stored in `schema_migrations` at apply time; `planPendingMigrations` throws on any drift between the ledger and the file, so editing an applied migration cannot silently change schema. |
| T-ded-02 | Denial of Service | `runMigrations` concurrent replicas / parallel `npm run migrate` | medium | mitigate | session advisory lock (`pg_advisory_lock`) wraps the whole run on the pinned connection so two processes cannot interleave DDL. |
| T-ded-03 | Tampering | shared/prod database first run | high | mitigate | every 0001/0002 statement is idempotent; the two `ALTER COLUMN TYPE` conversions are `DO`-blocked on the column's current type, making the first run against an already-migrated DB a no-op. `--check` previews pending migrations before applying. Operator runbook mandates a scratch-DB rehearsal first. |
| T-ded-04 | Information disclosure | `getDb()` fast-fail message | low | accept | message contains only the runbook hint (`npm run migrate`), no connection string, host, or schema details. |
| T-ded-05 | Elevation of privilege | one-off data-fix scripts | medium | mitigate | scripts require `DATABASE_URL` (same contract as `getDb()`) and run only under operator invocation; SQL is fixed at authoring time, no user input reaches them. |
| T-ded-SC | Tampering | npm/pip/cargo installs | n/a | n/a | No package installs in this plan — `npx tsx` is the pre-existing on-demand runner already used by `scripts/verify-credential-cutover.ts`; `pg`/`@types/pg` are already in `package.json`. Package Legitimacy Gate does not apply. |
</threat_model>

<verification>
Run from the repo root (`D:/git/pm-tool-b/.claude/worktrees/260826-ded-data-layer`) after all three tasks:

1. `npx tsc --noEmit` — clean (this type-checks `scripts/` and `lib/migrate/` via the tsconfig `include`).
2. `npm test` — full suite passes; the pre-existing `lib/log.test.ts` failure (a `tsx` self-check script, not a vitest suite) is identical before/after and is not a regression.
3. `npm run migrate -- --check` against the real shared `DATABASE_URL` — prints pending migrations with exit code 1 (ledger does not exist yet on the shared DB); the ledger is stamped on the first real `npm run migrate`.
4. `grep -c 'initPostgresSchema\|migratePostgresSchema\|backfillWeightedCompletion' lib/db.ts` → `0`.
5. `npm run build` — succeeds; confirms `output: 'standalone'` still works with the new `lib/migrate/*` modules (they are only imported by the CLI/test, not the app bundle) and the Dockerfile COPYs did not break the build.
6. Manual: scratch-DB `npm run migrate` twice (no-op second run) → app boots; empty DB without migrate → app fails fast with the runbook message.
</verification>

<success_criteria>
- `npm run migrate` creates the full schema on a fresh Postgres, is idempotent, records a `schema_migrations` ledger with checksums, and supports `--check`.
- `getDb()` no longer creates schema or runs the migration loop; it connects, fails fast with a runbook message when unmigrated, and seeds only when `users` is empty.
- The four data-fix `UPDATE`s and the weighted-completion backfill exist only as one-off scripts under `scripts/data-fixes/`; `lib/db.ts` contains none of them.
- `npm run dev` auto-migrates via `predev`; the Docker runner image carries `migrations/` + `scripts/`; `migrations/README.md` documents the Railway/K8s migrate wiring contract.
- `npx tsc --noEmit`, `npm test`, and `npm run build` pass; no dependencies added; `next.config.ts` untouched; no merge/push performed.
</success_criteria>

<output>
Create `.planning/quick/260826-ded-resolve-deferred-item-data-layer-data-01/260826-ded-SUMMARY.md` when done.
</output>
