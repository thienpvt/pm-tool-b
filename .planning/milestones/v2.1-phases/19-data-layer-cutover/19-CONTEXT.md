# Phase 19: Data Layer Cutover - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — smart discuss skipped; user accepted all recommended defaults)

<domain>
## Phase Boundary

Schema evolution is an external migrate job; a running app no longer initializes or mutates schema on cold start.

**Requirements:** DATA-01, DATA-02, DATA-03

**In:**
- External `npm run migrate` runner with checksum ledger
- Regenerated `migrations/0001` baseline from current v2.0 schema (weekly, fiscal, roles, RAID master, dashboard, checklist, and audit tables included)
- Slim `getDb()` to connect, assert ledger, and seed only — no `initPostgresSchema`, `migratePostgresSchema`, or `lib/db-*.ts` migrate helpers on the request path
- Data-fix `UPDATE`s that currently run as boot-time migrations move to one-off scripts under `scripts/data-fixes/` and are not re-run on every process start
- Brownfield ledger stamp so existing Railway/K8s/local databases are recorded without dropping v2.0 tables
- Wire migrate into Docker / deploy so schema is applied before app start

**Out:**
- Merging `origin/gsd/quick-260826-ded-data-layer-migrations` as-is (v1.0-era baseline would drop v2.0 tables)
- Kysely (Phase 25), module split (Phase 24), v2 UI consumers (Phases 21–23)
- Second ORM, Prisma, Drizzle schema-first, or a second connection pool
- Rewriting leftover ops/admin/config routes (Phase 20)

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- **D-01:** DATA-01..03 live in this single phase (do not split)
- **D-02:** Replay origin `gsd/quick-260826-ded-data-layer-migrations` as a runner/ledger/data-fix **pattern only**; never merge that branch as-is
- **D-03:** Regenerated `migrations/0001` must include current v2.0 schema from `lib/db.ts` plus `lib/db-*.ts` helpers (weekly, fiscal, roles, RAID master, dashboard, checklist, audit)
- **D-04:** Brownfield databases are stamped onto the ledger without DROP of v2.0 tables
- **D-05:** After cutover, `getDb()` connects, asserts the ledger, and seeds only
- **D-06:** Keep a single `pg.Pool`; do not introduce Prisma/Drizzle/Kysely this phase
- **D-07:** Production migrate: Dockerfile copies `migrations/` + `scripts/`; npm run migrate before app start; CI runs migrate before tests once assertMigrated is live
- **D-08:** Keep migrate* DDL exports in `lib/db-*.ts` (do not delete) so DDL unit tests remain source of truth for 0001 Part 3
- **D-09:** RAID unique indexes after backfill DML inside 0001 Part 3, matching current helper order
- **D-10:** tsx as migrate runner (pin 4.23.12 per RESEARCH.md / origin pattern)

### Claude's Discretion
Remaining implementation choices (file split, DO-block wrapping of ALTER TYPE, whether backfill scripts call exported helpers vs copy SQL) are at Claude's discretion. Use ROADMAP phase goal, success criteria, and codebase conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/db.ts` — `getDb()` currently: Pool → `initPostgresSchema` → `migratePostgresSchema` → mapping/roles/project-master/raid/weekly/fiscal/dashboards/documents helpers → `backfillWeightedCompletion` → `seedAuthData`
- `lib/db-mapping-tenant.ts`, `lib/db-roles.ts`, `lib/db-project-master.ts`, `lib/db-raid-masters.ts`, `lib/db-weekly-reports.ts`, `lib/db-fiscal-budget.ts`, `lib/db-dashboards.ts`, `lib/db-documents.ts` — settings-flag DDL/backfill helpers invoked from `getDb()`
- `lib/db-tx.ts` — `runInTransactionOnPool`
- Origin branch `gsd/quick-260826-ded-data-layer-migrations` — runner/ledger pattern against v1.0 schema (merge-base `f793e7d`)
- `test/db.ts` and `lib/db.test.ts` plus per-helper `*.ddl.unit.test.ts` / `*.backfill.unit.test.ts`

### Established Patterns
- PostgreSQL via `pg.Pool`; `PostgresClient` translates `?` placeholders to `$n`
- Schema currently lives in in-process DDL arrays, not SQL files
- Settings-flag guards for one-shot backfills (e.g. `completion_pct_weighted_v1`)
- `seedAuthData` after schema is ready
- Docker → GHCR; Railway + K8s manifests; `/api/health`
- No `npm run migrate` script today

### Integration Points
- Every repository imports `getDb` from `@/lib/db`
- Deploy: `Dockerfile`, Railway, K8s — must run migrate before app replicas start
- CI: `.github/workflows/test.yml` uses `TEST_DATABASE_URL`

</code_context>

<specifics>
## Specific Ideas

- Origin DATA branch is a pattern source only; regenerate baseline from current `lib/db.ts`
- Data-fix `UPDATE`s (onboarding_completed, portfolio_members member_type, weighted completion) belong under `scripts/data-fixes/`, not the versioned DDL ledger
- Stamp brownfield DBs onto the ledger so existing environments do not re-apply `0001` as CREATE TABLE from empty

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Kysely, module split, and v2 UI are later v2.1 phases.

</deferred>
