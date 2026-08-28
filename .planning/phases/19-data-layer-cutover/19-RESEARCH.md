# Phase 19: Data Layer Cutover - Research

**Researched:** 2026-08-28
**Domain:** PostgreSQL schema externalization — versioned SQL migrations, checksum ledger, boot-path slimming
**Confidence:** HIGH

## Summary

Phase 19 decouples schema evolution from the Next.js request path. Today `getDb()` in `lib/db.ts` runs a long cold-start chain: `initPostgresSchema` → `migratePostgresSchema` → eight `lib/db-*.ts` migrate helpers → `backfillWeightedCompletion` → `seedAuthData` [VERIFIED: lib/db.ts:608-643]. That pattern causes multi-replica DDL races, hides migration failures (the old loop swallows errors with empty `catch`), and couples deploy timing to app boot.

The origin branch `gsd/quick-260826-ded-data-layer-migrations` already solved DATA-01..03 for **v1.0 schema only** — its `migrations/0001-baseline-schema.sql` omits all v2.0 tables (weekly, fiscal, roles, RAID master, dashboard, checklist, audit) [VERIFIED: `git show origin/gsd/quick-260826-ded-data-layer-migrations:migrations/0001-baseline-schema.sql` grep for `weekly|audit_logs|user_roles` returned only legacy `documents`]. **Do not merge that branch.** Replay its runner/ledger/data-fix **pattern** and regenerate `0001` from current `lib/db.ts` plus exported DDL constants in `lib/db-*.ts`.

**Primary recommendation:** Port `lib/migrate/{plan,runner,assertMigrated}.ts` + `scripts/migrate.ts` from the origin branch verbatim in structure; generate a new `migrations/0001-baseline-schema.sql` in three labelled parts (init CREATE TABLEs, legacy ALTER/CREATE from `migratePostgresSchema`, v2.0 DDL from `db-*` exported arrays); slim `getDb()` to Pool → `assertMigrated` → `seedAuthData`; move all boot-time DML/backfills to `scripts/data-fixes/`; wire `npm run migrate` into CI and deploy manifests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Versioned DDL application | **Operator / CI Job** (`npm run migrate`) | — | Schema changes must not run inside app replicas; industry standard for brownfield PPM |
| Migration ledger + checksum | **Database / Storage** (`schema_migrations`) | Migrate runner writes | Auditable, append-only history; drift detection on file edit |
| Boot-time schema guard | **API / Backend** (`getDb()` → `assertMigrated`) | — | App fails fast if ledger empty; no `fs` at runtime (standalone bundle) |
| Auth seed (empty DB only) | **API / Backend** (`seedAuthData` in `getDb()`) | Migrate CLI calls `getDb()` post-migrate | Idempotent; only when `users` count is zero |
| One-off data fixes | **Operator scripts** (`scripts/data-fixes/*.ts`) | — | DML must not re-run every process start [DATA-03] |
| Brownfield ledger stamp | **Operator / CI** (idempotent `0001` on existing DB) | — | Existing Railway/K8s/local DBs keep v2.0 tables; ledger records adoption |
| Connection pooling | **API / Backend** (`pg.Pool` singleton in `lib/db.ts`) | Repositories | Single pool preserved; no second ORM [locked] |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions. Locked project decisions still apply:

- DATA-01..03 live in this single phase (do not split)
- Replay origin `gsd/quick-260826-ded-data-layer-migrations` as a runner/ledger/data-fix **pattern only**; never merge that branch as-is
- Regenerated `migrations/0001` must include current v2.0 schema from `lib/db.ts` plus `lib/db-*.ts` helpers (weekly, fiscal, roles, RAID master, dashboard, checklist, audit)
- Brownfield databases are stamped onto the ledger without DROP of v2.0 tables
- After cutover, `getDb()` connects, asserts the ledger, and seeds only
- Keep a single `pg.Pool`; do not introduce Prisma/Drizzle

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions. Locked project decisions still apply (see above).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Kysely, module split, and v2 UI are later v2.1 phases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | App start connects, guards, and seeds only — schema init and the migrate loop are not in `getDb()` | Slim `getDb()` to Pool + `assertMigrated` + `seedAuthData`; remove `initPostgresSchema`, `migratePostgresSchema`, and all `migrate*` helper calls [VERIFIED: lib/db.ts:621-639] |
| DATA-02 | Versioned SQL + `npm run migrate` + checksum ledger; `0001` regenerated from v2.0 schema | Origin runner/ledger pattern (`lib/migrate/*`, `scripts/migrate.ts`); three-part `0001` generation from `lib/db.ts` + exported `*_DDL` arrays in `lib/db-*.ts` |
| DATA-03 | Boot-time data-fix `UPDATE`s → one-off scripts under `scripts/data-fixes/` | Extract UPDATEs from `migratePostgresSchema` [VERIFIED: lib/db.ts:440,448,475,489-504] plus v2.0 backfills from `db-roles`, `db-project-master`, `db-raid-masters`, `db-mapping-tenant`, `backfillWeightedCompletion` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 16.2.4 / React 19.2.4 / TypeScript strict / PostgreSQL via `pg` — no framework swap [VERIFIED: .claude/CLAUDE.md:13]
- **Deployment:** Docker/GHCR + Railway + K8s must keep building; `output: 'standalone'` and `serverExternalPackages: ['exceljs', 'pptxgenjs']` preserved [VERIFIED: .claude/CLAUDE.md:17, next.config.ts]
- **Import convention:** `@/` alias for all app-root imports
- **Testing:** Vitest is the gate; capabilities need tests (HYG-03) [VERIFIED: package.json `"test": "vitest run"`, vitest 4.1.10]
- **Security:** Multi-tenant company scoping unchanged; migrations are operator-controlled SQL, not user input
- **No second ORM / pool:** Kysely is Phase 25; this phase keeps raw `pg.Pool`

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.20.0 (registry latest 8.23.0) | PostgreSQL pool + migrate runner queries | Already the sole DB client [VERIFIED: package.json] |
| Node `crypto` | built-in | sha256 checksums in `lib/migrate/plan.ts` | Origin pattern; no extra dependency |
| `tsx` | 4.23.12 (origin pin; registry latest 4.23.12) | Run TypeScript migrate CLI without compile step | Origin branch uses `npx tsx scripts/migrate.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL advisory locks | PG 17 | Serialize concurrent migrate runs | `pg_advisory_lock(1347246335)` in runner [VERIFIED: origin `lib/migrate/runner.ts`] |
| Vitest | 4.1.10 | Unit + integration tests for runner/plan/assert | Existing test harness |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tsx devDependency | Compiled `migrate.cjs` in Docker | Better for production image without devDeps; origin deferred this — planner may choose compile step for runner stage |
| `pg_advisory_lock` (session) | `pg_try_advisory_lock` + exit | Origin uses blocking session lock; acceptable for single Job/initContainer migrate |
| Settings-flag DDL guards | Ledger-only tracking | After cutover, ledger is source of truth; settings flags remain on brownfield DBs harmlessly |

**Installation:**

```bash
npm install --save-dev tsx@4.23.12
```

Add to `package.json` scripts:

```json
"migrate": "npx tsx scripts/migrate.ts"
```

**Version verification:**

```bash
npm view pg version      # 8.23.0
npm view tsx version     # 4.23.12
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `pg` | npm | mature | high | github.com/brianc/node-postgres | OK | Approved — already in dependencies |
| `tsx` | npm | published 2026-08-10 | ~85M/wk | github.com/privatenumber/tsx | SUS | Flagged — seam reason `too-new`; planner adds `checkpoint:human-verify` before pin; origin branch already validated 4.23.12 in practice |

**Packages removed due to [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** `tsx` — high adoption but young publish date on current version; pin exact version from origin branch

*No new runtime production dependencies beyond devDependency `tsx`.*

---

## Architecture Patterns

### System Architecture Diagram

```text
                    ┌─────────────────────────────────────┐
                    │  Operator / CI / K8s Job            │
                    │  DATABASE_URL                       │
                    └──────────────┬──────────────────────┘
                                   │ npm run migrate
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  scripts/migrate.ts                 │
                    │  read migrations/*.sql (fs)         │
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  lib/migrate/runner.ts              │
                    │  advisory lock → BEGIN/COMMIT       │
                    │  per file → INSERT schema_migrations│
                    └──────────────┬──────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  PostgreSQL                         │
                    │  tables + schema_migrations ledger  │
                    └──────────────┬──────────────────────┘
                                   │ ledger has rows
                                   ▼
                    ┌─────────────────────────────────────┐
                    │  Next.js app replicas               │
                    │  getDb(): Pool → assertMigrated     │
                    │           → seedAuthData (if empty) │
                    └─────────────────────────────────────┘

  scripts/data-fixes/*.ts  ──(operator, once)──►  PostgreSQL DML
       NOT on app boot path
```

### Recommended Project Structure

```text
migrations/
├── README.md
└── 0001-baseline-schema.sql    # regenerated v2.0 baseline (3 parts)

lib/migrate/
├── plan.ts                     # parse filename, sha256, pending plan
├── runner.ts                   # apply + ledger + advisory lock
├── assertMigrated.ts           # getDb boot guard
├── plan.test.ts
├── runner.test.ts
└── assertMigrated.test.ts

scripts/
├── migrate.ts                  # CLI entry
└── data-fixes/
    ├── run-sql-fix.ts          # shared helper
    ├── 01-users-onboarding-completed.ts
    ├── 02-portfolio-members-member-type.ts
    ├── 03-projects-company-id-sync.ts
    ├── 04-activities-jira-parent-repair.ts
    ├── backfill-weighted-completion.ts
    ├── backfill-user-roles.ts          # NEW from db-roles
    ├── backfill-pm-assignments.ts      # NEW from db-project-master
    ├── backfill-raid-masters.ts        # NEW from db-raid-masters
    └── backfill-mapping-tenant.ts      # NEW from db-mapping-tenant (procedural)

lib/db.ts                       # slim getDb; export resolveSsl
lib/db-*.ts                     # keep *_DDL exports for 0001 gen + unit tests;
                                # remove getDb() migrate invocations
```

### Pattern 1: Checksum ledger migration runner

**What:** Versioned `NNNN-name.sql` files applied in order; each records `(version, name, checksum, applied_at)` in `schema_migrations`. Editing an applied file fails on checksum drift.

**When to use:** All DDL forever after cutover.

**Example:**

```typescript
// Source: origin gsd/quick-260826-ded-data-layer-migrations lib/migrate/runner.ts
export const DEFAULT_LEDGER_TABLE = 'schema_migrations';
export const MIGRATION_LOCK_KEY = 1347246335;

export async function runMigrations(client, files, opts?) {
  await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await ensureLedgerTable(client, ledgerTable);
    const { toApply, drifted } = planPendingMigrations(files, applied);
    if (drifted.length > 0) throw new Error(`Migration checksum drift detected: ...`);
    for (const file of toApply) {
      await client.query('BEGIN');
      await client.query(file.sql);
      await client.query(`INSERT INTO ${ledgerTable} (version, name, checksum) VALUES (...)`);
      await client.query('COMMIT');
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
  }
}
```

### Pattern 2: Slim getDb with assertMigrated

**What:** App connects, verifies ledger non-empty (with legacy brownfield probe), seeds only.

**When to use:** Every request after cutover.

**Example:**

```typescript
// Source: origin lib/migrate/assertMigrated.ts + slim getDb
export async function getDb(): Promise<DbClient> {
  if (_client) return _client;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: resolveSsl(...) });
  _pool = pool;
  const client = new PostgresClient(pool);
  await assertMigrated((sql) => pool.query(sql));
  _client = client;
  await seedAuthData(_client);
  return _client;
}
```

### Pattern 3: Three-part baseline SQL generation

**What:** Regenerate `0001-baseline-schema.sql` from live code, not from origin branch file.

**Part 1 — init CREATE TABLEs:** Copy verbatim from `initPostgresSchema` in `lib/db.ts` (35 `CREATE TABLE IF NOT EXISTS` blocks) [VERIFIED: lib/db.ts:71-420]

**Part 2 — legacy migrate DDL:** From `migratePostgresSchema` array — **DDL only** (`ALTER TABLE`, `CREATE TABLE IF NOT EXISTS`, `DO $$` type guards). **Strip** these DML lines to data-fix scripts:
- `UPDATE users SET onboarding_completed = 1 WHERE created_at < '2026-05-08...'` [VERIFIED: lib/db.ts:440]
- `UPDATE portfolio_members SET member_type = 'external' WHERE LOWER(note)...` [VERIFIED: lib/db.ts:448]
- `UPDATE projects SET company_id = c.company_id FROM customers c...` [VERIFIED: lib/db.ts:475]
- `UPDATE activities a SET parent_id = e.id FROM activities e...` [VERIFIED: lib/db.ts:489-504]

**Part 3 — v2.0 DDL:** Concatenate exported constants (already unit-tested):

| Source file | Export constants | Tables / objects |
|-------------|------------------|------------------|
| `lib/db-roles.ts` | inline in `migrateRolesDdl` | `user_roles`, `audit_logs`, user column alters, indexes |
| `lib/db-project-master.ts` | `PROJECT_MASTER_DDL`, `PROJECT_MASTER_CONSTRAINTS_DDL` | project columns, `project_pm_assignments`, `project_stakeholders`, indexes |
| `lib/db-raid-masters.ts` | `RAID_MASTERS_DDL`, `RAID_MASTERS_INDEX_DDL` | milestone/risk/issue columns, `raid_due_date_history`, indexes |
| `lib/db-weekly-reports.ts` | `WEEKLY_REPORTS_DDL`, `WEEKLY_REPORTS_INDEX_DDL`, `WEEKLY_EXPORT_LOGS_DDL` | weekly cadence + export log tables |
| `lib/db-fiscal-budget.ts` | `FISCAL_BUDGET_DDL` | fiscal budget, adjustments, benefits, dependencies |
| `lib/db-dashboards.ts` | `DASHBOARDS_DDL` | `dashboard_filter_state` |
| `lib/db-documents.ts` | `DOCUMENTS_DDL` | catalog, templates, checklist |
| `lib/db-mapping-tenant.ts` | procedural → SQL fragments | `company_id` columns + unique indexes on four mapping tables |

Keep Part 2 redundancy on purpose (origin README): `CREATE TABLE IF NOT EXISTS` cannot add columns to existing tables; `ADD COLUMN IF NOT EXISTS` repairs brownfield gaps.

### Pattern 4: Brownfield ledger stamp

**What:** Existing production DB already has full v2.0 schema from boot-time path. First `npm run migrate` runs idempotent `0001` (all no-ops) and inserts one ledger row — **no DROP**.

**Steps:**
1. Rehearse on `pg_dump` scratch copy
2. Run `npm run migrate` against live `DATABASE_URL`
3. Confirm `npm run migrate -- --check` reports clean
4. Deploy slim `getDb()` app

### Anti-Patterns to Avoid

- **Merging origin branch as-is:** Drops v2.0 tables missing from v1.0 baseline
- **Dual path (boot DDL + external migrate):** Two writers race on rolling deploy
- **Running migrate inside every pod without Job/initContainer:** Use external Job or advisory lock (runner has lock, but app should not migrate)
- **Importing `fs` in `lib/db.ts`:** Breaks standalone tracing; migrations read only in CLI
- **Swallowing migration errors:** Old `try {} catch {}` hid failures — runner must fail loudly

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration ordering + checksum | Custom JSON manifest | Origin `plan.ts` + `schema_migrations` ledger | Drift detection, duplicate version guard |
| Concurrent migrate safety | Sleep/retry loops | `pg_advisory_lock` on fixed key | Postgres-native serialization [CITED: postgresql advisory lock docs] |
| SQL file parsing | Split on `;` in app | Single `client.query(file.sql)` per migration inside transaction | Postgres handles multi-statement; origin pattern |
| Schema versioning in app | Settings flags for DDL | Ledger table post-cutover | Settings flags remain for data-fix idempotency only |
| ORM migration tool | Prisma/Drizzle/Kysely migrate | Versioned `.sql` + runner | Locked: Kysely is Phase 25; single pool |

**Key insight:** The origin branch already built the hard parts (ledger, drift, advisory lock, assert guard). This phase's novel work is **regenerating SQL content** for v2.0 and **extracting v2.0 backfills** — not redesigning the runner.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing PostgreSQL databases with full v2.0 schema but **no** `schema_migrations` table yet; `settings` keys like `weekly_reports_ddl_v1`, `roles_backfill_v1`, `completion_pct_weighted_v1` from prior boot migrations | **Stamp:** run idempotent `0001` → ledger row. **No data migration** for settings flags — harmless leftovers |
| Live service config | Railway pre-deploy / K8s Job must run `npm run migrate` before app replicas; current Dockerfile has **no** `migrations/` or `scripts/` COPY [VERIFIED: Dockerfile vs origin branch Dockerfile] | **Wire deploy:** COPY migrations+scripts; document Railway release command; add K8s migrate Job or initContainer |
| OS-registered state | None — verified: no Task Scheduler / systemd entries for schema boot | None |
| Secrets/env vars | `DATABASE_URL` unchanged; migrate CLI uses same var | None |
| Build artifacts | Next standalone bundle excludes `migrations/` unless explicitly COPY'd; `tsx` not in runner stage today | COPY `migrations/` + `scripts/` in Dockerfile; ensure migrate runnable in CI (devDeps present) and production (compile or bundle tsx) |

**Nothing found in category:** OS-registered state

---

## Common Pitfalls

### Pitfall 1: v1.0 baseline omits v2.0 tables

**What goes wrong:** Merging origin branch drops weekly/fiscal/roles/audit tables on fresh DB or confuses planner about baseline scope.

**Why it happens:** Origin branch merge-base is pre-v2.0.

**How to avoid:** Generate `0001` from current `lib/db.ts` + `lib/db-*.ts` exports; diff against origin file to confirm v2.0 tables present.

**Warning signs:** `0001` lacks strings like `weekly_periods`, `audit_logs`, `user_roles`, `project_fiscal_budgets`, `document_catalog`.

### Pitfall 2: Boot-time DML left in SQL migration

**What goes wrong:** `UPDATE`/`INSERT` backfills in `0001` re-run semantics change; audit trail unclear.

**Why it happens:** `migratePostgresSchema` mixed DDL and DML in one array.

**How to avoid:** DATA-03: move DML to `scripts/data-fixes/` with settings-flag guards where idempotency needed.

**Warning signs:** `UPDATE` statements in `0001` other than harmless no-op guards.

### Pitfall 3: CI breaks after getDb slimming

**What goes wrong:** Tests calling real `getDb()` fail with "run npm run migrate first"; fresh `_test` DB has no ledger.

**Why it happens:** Repository tests mock `getDb` via `test/repo-db.ts`, but route/integration tests may not.

**How to avoid:** Add CI step: `DATABASE_URL=$TEST_DATABASE_URL npm run migrate` before `npm test`.

**Warning signs:** `assertMigrated` runbook error in CI logs.

### Pitfall 4: RAID unique indexes before backfill

**What goes wrong:** Creating unique indexes on `risks.code` / `issues.code` before dedupe fails on legacy duplicates.

**Why it happens:** `migrateRaidMasters` runs backfill before indexes [VERIFIED: lib/db-raid-masters.ts:130-134].

**How to avoid:** In `0001`, order RAID DDL → (data-fix script for backfill/dedupe, operator-run once) → index DDL; or keep index creation in Part 3 after documenting backfill script must run first on brownfield.

**Warning signs:** Unique violation on first migrate against old DB.

### Pitfall 5: Docker runner cannot execute tsx

**What goes wrong:** Production image has no devDependencies; `npm run migrate` fails inside container.

**Why it happens:** Multi-stage Dockerfile drops devDeps in runner stage [VERIFIED: Dockerfile:16-34].

**How to avoid:** Origin documents operator-machine migrate OR compile migrate script in builder stage; planner picks one and wires Railway/K8s accordingly.

**Warning signs:** `tsx: not found` in deploy logs.

### Pitfall 6: Silent DDL failures surfaced only at migrate time

**What goes wrong:** Old boot loop swallowed errors; idempotent `0001` against brownfield exposes broken statements for the first time.

**Why it happens:** `try { await pool.query(sql); } catch { /* column already exists */ }` [VERIFIED: lib/db.ts:506-508].

**How to avoid:** Rehearse migrate on scratch copy of production schema before live stamp (origin README step 1).

**Warning signs:** Transaction rollback mid-`0001` on staging.

---

## Code Examples

### Migrate CLI entry

```typescript
// Source: origin scripts/migrate.ts
const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations');

async function main() {
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  const client = await pool.connect();
  try {
    const files = loadMigrations();
    if (check) { /* computePendingMigrations, exit 1 if pending */ return; }
    await runMigrations(client, files);
    await getDb(); // seed-if-empty after ledger exists
  } finally {
    client.release();
    await pool.end();
  }
}
```

### Data-fix script

```typescript
// Source: origin scripts/data-fixes/01-users-onboarding-completed.ts
import { runFix } from './run-sql-fix';

runFix({
  name: '01-users-onboarding-completed',
  sql: `UPDATE users SET onboarding_completed = 1 WHERE created_at < '2026-05-08 00:00:00' AND onboarding_completed = 0`,
});
```

### Export resolveSsl for CLI scripts

```typescript
// lib/db.ts — currently private; must export for scripts/migrate.ts and data-fixes
export function resolveSsl(databaseUrl: string): false | { rejectUnauthorized: boolean } {
  // existing implementation [VERIFIED: lib/db.ts:582-596]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DDL arrays in `getDb()` | External `npm run migrate` + ledger | Phase 19 (v2.1) | Cold start no longer runs DDL; deploy runs migrate first |
| Settings-flag DDL guards | Ledger + optional flags on brownfield | Phase 19 | New envs use ledger; old flags inert |
| Boot-time UPDATE backfills | `scripts/data-fixes/*.ts` | Phase 19 | DML not on every replica start |
| Origin v1.0 `0001` SQL file | Regenerated v2.0 `0001` | Phase 19 | Weekly/fiscal/roles/audit included |

**Deprecated/outdated:**
- `initPostgresSchema`, `migratePostgresSchema`, and `getDb()`-invoked `migrate*` helpers — remove from boot path after cutover
- Origin branch `migrations/0001-baseline-schema.sql` content — pattern only, not content source

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Production Docker migrate can run from operator machine until runner-stage tsx/compile wiring lands | Environment Availability | Fresh env DB won't self-migrate in container |
| A2 | CI can use `TEST_DATABASE_URL` as `DATABASE_URL` for migrate step | Validation Architecture | Tests fail post-cutover |
| A3 | Mapping-tenant procedural backfill can be ported to a standalone data-fix script without behavior change | DATA-03 | Multi-company mapping rows wrong after cutover |
| A4 | `assertMigrated` legacy probe (companies exists, ledger empty) is acceptable during transition | Pattern 2 | Dev without migrate still boots until stamp — intentional per origin |

---

## Open Questions (RESOLVED)

1. **Production migrate execution path** — RESOLVED (D-07, D-10; implemented in 19-04-02)
   - Decision: tsx in the runner image. Dockerfile copies `migrations/` + `scripts/`, copies `node_modules` from the deps stage (includes pinned `tsx@4.23.12`), and CMD/Railway/compose run `npx tsx scripts/migrate.ts && node server.js`. K8s is a one-shot Job with `["npx","tsx","scripts/migrate.ts"]`. No builder-stage compile of `scripts/migrate.ts`.

2. **RAID backfill ordering vs indexes in single 0001 file** — RESOLVED (D-09; implemented in 19-02-02)
   - Decision: RAID DML stays in 0001 Part 3. Order is `RAID_MASTERS_DDL`, then backfill/dedupe DML, then `RAID_MASTERS_INDEX_DDL`. Do not split indexes to `0002`. Other boot UPDATEs stay in `scripts/data-fixes/` (19-03).

3. **Keep or delete `migrate*` exports from `lib/db-*.ts`** — RESOLVED (D-08; implemented in 19-04-01)
   - Decision: Keep `migrate*` functions and `*_DDL` exports in `lib/db-*.ts` so DDL unit tests remain the source of truth for 0001 Part 3. Remove only the `getDb()` invocations (and unused init/migrate/backfill in `lib/db.ts`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | migrate CLI, app | ✓ | 20 (Docker) / 22 (CI) | — |
| npm | scripts | ✓ | lockfile | — |
| PostgreSQL | migrations + app | ✓ (CI service) | 17 | — |
| `DATABASE_URL` | migrate + getDb | ✓ in CI/deploy | — | Required; no fallback |
| `TEST_DATABASE_URL` | Vitest repo tests | ✓ in CI | postgres://…/pm_tool_test | Tests skip when unset |
| `tsx` | `npm run migrate` | ✗ (not installed) | — | Add devDependency 4.23.12 |
| Railway CLI / K8s | deploy migrate wiring | ✓ (manifests referenced in PROJECT.md) | — | Operator-machine migrate until wired |

**Missing dependencies with no fallback:**
- `tsx` (until added) blocks `npm run migrate`

**Missing dependencies with fallback:**
- In-container migrate (fallback: operator runs migrate against `DATABASE_URL` from laptop/CI)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run lib/migrate` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `getDb()` does not call schema init/migrate helpers | unit | `npx vitest run lib/migrate/assertMigrated.test.ts` | ❌ Wave 0 (port from origin) |
| DATA-01 | Unmigrated DB fails fast with runbook message | unit | `npx vitest run lib/migrate/assertMigrated.test.ts` | ❌ Wave 0 |
| DATA-02 | Ledger records version + checksum per file | unit | `npx vitest run lib/migrate/runner.test.ts` | ❌ Wave 0 |
| DATA-02 | Checksum drift fails loudly | unit | `npx vitest run lib/migrate/plan.test.ts` | ❌ Wave 0 |
| DATA-02 | Second migrate run is idempotent | integration | `npx vitest run lib/migrate/runner.test.ts` | ❌ Wave 0 |
| DATA-02 | `0001` includes v2.0 table names | unit | `npx vitest run lib/migrate/baseline-content.test.ts` (new) | ❌ Wave 0 |
| DATA-03 | Data-fix scripts require DATABASE_URL, print row count | unit | `npx vitest run lib/migrate/data-fixes.test.ts` | ❌ Wave 0 (origin) |
| DATA-01..03 | CI applies migrate before tests | smoke | CI step: `DATABASE_URL=$TEST_DATABASE_URL npm run migrate && npm test` | ❌ Wave 0 (.github/workflows/test.yml) |

### Sampling Rate

- **Per task commit:** `npx vitest run lib/migrate`
- **Per wave merge:** `npm test` (with migrate pre-step)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Port `lib/migrate/{plan,runner,assertMigrated}.ts` + tests from origin branch
- [ ] Add `scripts/migrate.ts` + `npm run migrate` + `tsx` devDependency
- [ ] Generate `migrations/0001-baseline-schema.sql` + `migrations/README.md`
- [ ] Add `lib/migrate/baseline-content.test.ts` asserting v2.0 table names in 0001
- [ ] Update `.github/workflows/test.yml` — migrate before test
- [ ] Slim `lib/db.ts` getDb + export `resolveSsl`
- [ ] Framework install: `npm install --save-dev tsx@4.23.12`

Existing DDL unit tests (`lib/db-*.ddl.unit.test.ts`) remain valid as **source-of-truth checks** for 0001 Part 3 content — no deletion required.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Unchanged — `seedAuthData` only |
| V3 Session Management | no | Unchanged |
| V4 Access Control | no | Unchanged |
| V5 Input Validation | yes | Migration SQL is operator-supplied files, not HTTP input; runner uses parameterized ledger inserts only for metadata |
| V6 Cryptography | yes | sha256 checksums for migration integrity (not encryption) |

### Known Threat Patterns for Node/pg/PostgreSQL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Concurrent DDL from multiple replicas | Tampering / DoS | External migrate Job + `pg_advisory_lock` in runner |
| Edited migration file after apply | Tampering | Checksum drift detection → hard fail |
| Default admin seed on empty DB | Elevation | Existing idempotent seed only when `users` empty; document rotate-default-password runbook |
| SQL injection via migration filenames | Tampering | `parseMigrationFile` strict regex `^(\d{1,4})-[A-Za-z0-9_-]+\.sql$` [VERIFIED: origin plan.ts] |
| Running migrate against wrong DB | Tampering | Operator confirms `DATABASE_URL`; CI uses `_test` suffix guard in `test/db.ts` |

---

## Sources

### Primary (HIGH confidence)

- Origin branch `gsd/quick-260826-ded-data-layer-migrations` — `lib/migrate/*`, `scripts/migrate.ts`, `migrations/README.md`, data-fix scripts (inspected via `git show`, not merged)
- `lib/db.ts` getDb chain — lines 608-643 [VERIFIED: read this session]
- `lib/db-*.ts` exported `*_DDL` constants — weekly, fiscal, roles, RAID, dashboard, documents, project-master [VERIFIED: read this session]
- `/brianc/node-postgres` — transaction pattern with BEGIN/COMMIT on single client [CITED: Context7 query-docs]

### Secondary (MEDIUM confidence)

- PostgreSQL advisory lock behavior for migration serialization [CITED: postgresscripts.com, dev.to migration lock articles via web search]

### Tertiary (LOW confidence)

- Production Docker tsx availability without compile step — origin README explicit deferral; needs planner decision

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — origin branch pattern proven in-repo; pg/tsx versions registry-verified
- Architecture: **HIGH** — current getDb chain and origin runner read directly; v2.0 gap confirmed by branch diff
- Pitfalls: **MEDIUM** — RAID ordering and Docker tsx path need rehearsal on scratch DB

**Research date:** 2026-08-28
**Valid until:** 2026-09-28 (stable infrastructure pattern)
