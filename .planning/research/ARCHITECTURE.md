# Architecture Research — v2.1 Hardening & Deferred Debt

**Domain:** Brownfield Next.js 16 full-stack PPM (multi-tenant PostgreSQL)
**Researched:** 2026-08-28
**Confidence:** HIGH (grounded in live codebase + origin `gsd/quick-260826-ded-data-layer-migrations` branch)

## Executive Recommendation

Keep the **existing layer model** (edge gate → HTTP wrappers → route → service → repository → PostgreSQL). v2.1 adds three structural changes without redesign:

1. **`modules/<feature>/backend/` + `modules/<feature>/ui/`** — canonical home for feature code; **`app/` stays a thin routing shell** (Next.js requires `app/**` for URLs).
2. **External versioned migrations** — replay the origin-branch runner/ledger/`assertMigrated` pattern; regenerate `0001-baseline-schema.sql` from current v2.0 schema in `lib/db.ts` + `lib/db-*.ts` modules; remove boot-time DDL from `getDb()`.
3. **Kysely beside `PostgresClient`** — same `_pool`, incremental repo adoption after migrations; runtime allowlists become compile-time column picks.

**Build order is strict:** DATA (migrations) → route thinning + module scaffolding → incremental module moves → ENF-02 Kysely → v2 UI consumers → PERF/nits.

---

## Standard Architecture (Post–v2.1 Target)

### System Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser — modules/*/ui/pages + components (client fetch → /api/*)          │
│  Shared chrome: components/layout, components/ui                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  app/** — THIN Next.js routing shell only                                   │
│    app/<path>/page.tsx          → export { default } from '@/modules/.../ui'│
│    app/api/<path>/route.ts      → export { GET } from '@/modules/.../backend'│
├─────────────────────────────────────────────────────────────────────────────┤
│  Edge: proxy.ts — cookie presence, request-id, JSON 401 for API (PROXY-01) │
│        NO pg, NO session DB lookup, NO tenancy decisions                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Node wrappers: lib/http/with-auth|withProjectAccess|withProgramAccess|     │
│                 withRole|withCpmo — session + actor + access (source of truth)│
├─────────────────────────────────────────────────────────────────────────────┤
│  modules/*/backend/                                                         │
│    routes/*.ts (handler bodies) · services/*.service.ts · repos/*.repo.ts   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Cross-cutting lib/ (unchanged role, some files shrink)                     │
│    lib/db.ts · lib/auth.ts · lib/api-errors.ts · lib/http/*                 │
│    lib/migrate/* · lib/kysely.ts · lib/integrations/* · lib/export/*        │
├─────────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                                 │
│    schema_migrations ledger · versioned migrations/*.sql                    │
│    npm run migrate (CLI) — NOT getDb() cold start                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v2.1 change |
|-----------|----------------|-------------|
| `proxy.ts` | Cookie gate, public-path bypass, request-id, API access log | **Modified:** JSON `{ error: 'Unauthorized' }` 401 for `/api/*` without cookie; pages still redirect |
| `lib/http/*` | Session resolution, body parse, role/project/program asserts, error tail | **Unchanged** — remain Node-runtime source of truth for authz |
| `app/api/**/route.ts` | Next.js HTTP surface | **Modified:** one-liner re-exports into `modules/*/backend/routes/` |
| `modules/*/backend/` | Route handlers, services, repos for one feature | **New** — canonical backend home |
| `modules/*/ui/` | Pages, hooks, `_components/` for one feature | **New** — canonical UI home |
| `lib/db.ts` | Pool singleton, `DbClient`, domain types, `getDb()`, `runInTransaction` | **Modified:** connect + `assertMigrated` + seed only; DDL removed |
| `lib/migrate/*` | Runner, plan, assertMigrated, checksum ledger | **New** — replay from origin branch |
| `migrations/*.sql` | Versioned schema source of truth | **New** — `0001` regenerated for v2.0 |
| `lib/kysely.ts` | Typed query builder on shared pool | **New** — ENF-02 |
| `lib/integrations/*`, `lib/export/*` | External clients, Office generators | **Unchanged** location (shared infra, not per-module) |
| `components/layout`, `components/ui` | App shell, design system | **Unchanged** — truly cross-route shared UI |

---

## Recommended Module Layout (Opinionated)

### Convention: `modules/<feature>/{backend,ui}`

Next.js App Router **must** keep routable files under `app/`. The opinionated pattern: **feature code lives in `modules/`; `app/` is a stable URL map of thin re-exports.**

```text
pm-tool-b/
├── app/                              # THIN — URLs only
│   ├── api/
│   │   ├── dashboards/portfolio/route.ts   → re-export from modules/dashboards
│   │   ├── weekly-periods/route.ts         → re-export from modules/weekly
│   │   ├── audit/route.ts                  → re-export from modules/audit
│   │   └── projects/[id]/weekly-reports/…  → re-export from modules/weekly
│   ├── portfolio/dashboard/page.tsx        → re-export from modules/dashboards/ui
│   ├── weekly/page.tsx                     → re-export from modules/weekly/ui
│   └── projects/[id]/documents/page.tsx    → re-export from modules/documents/ui
│
├── modules/
│   ├── dashboards/
│   │   ├── backend/
│   │   │   ├── routes/
│   │   │   │   ├── portfolio.route.ts      # export const GET = withCpmo(...)
│   │   │   │   ├── pm.route.ts
│   │   │   │   └── document-compliance.route.ts
│   │   │   ├── services/
│   │   │   │   └── spec-dashboards.service.ts   # moved from lib/services/
│   │   │   └── repositories/
│   │   │       └── dashboard-filter-state.repo.ts
│   │   └── ui/
│   │       ├── pages/
│   │       │   ├── PortfolioDashboardPage.tsx   # UI-DASH consumer
│   │       │   └── PmDashboardPage.tsx
│   │       ├── hooks/
│   │       │   └── usePortfolioDashboard.ts
│   │       └── components/
│   │           └── KpiGrid.tsx
│   │
│   ├── weekly/
│   │   ├── backend/
│   │   │   ├── routes/
│   │   │   │   ├── periods.route.ts
│   │   │   │   ├── tracking.route.ts
│   │   │   │   └── project-reports.route.ts
│   │   │   ├── services/
│   │   │   │   ├── weekly-reports.service.ts
│   │   │   │   └── weekly-tracking.service.ts
│   │   │   └── repositories/
│   │   │       ├── weekly-reports.repo.ts
│   │   │       └── weekly-periods.repo.ts
│   │   └── ui/
│   │       ├── pages/
│   │       │   ├── CpmoWeeklyTrackingPage.tsx   # UI-WEEK
│   │       │   └── PmWeeklyReportPage.tsx
│   │       └── hooks/
│   │           └── useWeeklyReportSubmit.ts
│   │
│   ├── projects/
│   │   ├── backend/
│   │   │   ├── routes/          # projects/[id]/* nested route bodies
│   │   │   ├── services/        # projects, activities, milestones, risks, …
│   │   │   └── repositories/
│   │   └── ui/
│   │       ├── pages/           # timeline, milestones, report, budget, …
│   │       ├── hooks/           # useTimelinePage.ts, etc.
│   │       └── components/
│   │
│   ├── portfolio/               # home KPIs, roadmap, report, budget, members, quota
│   ├── programs/
│   ├── documents/               # catalog, templates, checklist (UI-DOC)
│   ├── audit/                   # GET /api/audit + UI-AUDIT
│   ├── fiscal-budget/
│   ├── operations/              # THIN-01 target
│   ├── admin/                   # THIN-01 target
│   ├── auth/
│   ├── jira/
│   ├── import/                  # import-mapping, bug-import, resource-plan, parse-headers
│   ├── export/                  # or keep lib/export + thin app/api/export re-exports
│   ├── config/
│   ├── resources/
│   └── shared/                  # optional: module-local types only; NOT a second lib/
│
├── lib/                         # cross-cutting only — shrinks as modules absorb domain code
│   ├── http/                    # wrappers — STAY
│   ├── db.ts                    # pool + DbClient + types + getDb
│   ├── kysely.ts                # NEW — Kysely on _pool
│   ├── db-types.ts              # NEW — Kysely Database interface
│   ├── migrate/                 # NEW — runner, assertMigrated, plan
│   ├── auth.ts
│   ├── api-errors.ts
│   ├── integrations/
│   └── export/                  # shared generators until export module fully owns them
│
├── components/                  # app-wide shell + ui primitives ONLY
│   ├── layout/Sidebar.tsx
│   └── ui/*
│
├── migrations/                  # NEW — versioned SQL
│   ├── 0001-baseline-schema.sql # regenerated from v2.0 lib/db.ts + db-*.ts
│   └── 0002-…sql                # future deltas
│
├── scripts/
│   ├── migrate.ts               # NEW — npm run migrate
│   └── data-fixes/              # NEW — one-off fixes out of boot path
│
└── proxy.ts
```

### Thin `app/` wrapper examples

**API re-export** (URL unchanged, body moves):

```typescript
// app/api/dashboards/portfolio/route.ts
export { GET } from '@/modules/dashboards/backend/routes/portfolio.route';
```

**Page re-export**:

```typescript
// app/weekly/page.tsx
export { default } from '@/modules/weekly/ui/pages/CpmoWeeklyTrackingPage';
```

**Route with co-located tests** — tests stay next to the thin `app/api/.../route.ts` (Vitest already resolves `@/app/api/**`) OR move to `modules/*/backend/routes/*.test.ts`; pick one convention per module during move and update `vitest.config.ts` include globs once.

### Structure Rationale

- **`modules/<feature>/backend/` vs `ui/`:** satisfies MOD-01 ("backend and UI separate in each module/dir") without fighting App Router.
- **`app/` stays:** Next.js 16 requires it for routing; re-exports avoid duplicate URL logic.
- **`lib/` stays for horizontal concerns:** auth, db pool, wrappers, integrations, migrate runner — not feature-owned.
- **`components/ui` + `components/layout` stay root-level:** used by every module; not duplicated per feature.
- **Do NOT put routable pages only under `modules/` without `app/` re-exports** — that breaks App Router unless using experimental `src/app` rewrites (not recommended).

### Full module inventory (repo-wide, not v2-only)

Every row must eventually have both `backend/` and `ui/` (ui may be empty placeholder for API-only areas like `health`).

| Module | Backend (routes/services/repos) | UI (pages/hooks/components) |
|--------|--------------------------------|-----------------------------|
| `auth` | login/logout/me/password/onboarding | `app/login`, onboarding modal wiring |
| `admin` | companies, users, jira/rag config, demo-requests, resource-audit | `app/admin` |
| `projects` | project CRUD + nested: activities, milestones, risks, issues, bugs, budget, team, meetings, escalations, documents, holidays, dependencies, pm-assignments, fiscal-budget, weekly-reports, document-checklist, report | `app/projects/**` |
| `programs` | programs, allocations | `app/programs` |
| `portfolio` | home data, roadmap, report, budget, members, quota, milestones | `app/page.tsx`, `app/portfolio/**` |
| `dashboards` | portfolio/pm/document-compliance APIs | **NEW** UI-DASH pages |
| `weekly` | weekly-periods, tracking, export preview | **NEW** UI-WEEK pages |
| `documents` | document-templates, catalog, checklist APIs | **NEW** UI-DOC + existing project documents view |
| `audit` | GET `/api/audit` | **NEW** UI-AUDIT |
| `fiscal-budget` | fiscal budget, adjustments, benefits, ROI | project budget sub-views |
| `operations` | ops systems/budget/incidents | `app/operations/**` |
| `resources` | resources API, resource-plan import | `app/resources`, portfolio resources |
| `jira` | search, fields, test, presets, sync-mappings | Jira dialogs in `components/jira` → move to module ui |
| `import` | import-mapping, bug-import-mapping, parse-file-headers | import dialogs |
| `export` | export/word/excel/ppt/report routes | download triggers in pages |
| `config` | GET/PATCH settings | — |
| `demo-requests` | public demo form + admin list | landing CTA |

---

## Migration Architecture (DATA-01..03)

### Origin branch pattern (replay, do not merge)

Branch `origin/gsd/quick-260826-ded-data-layer-migrations` ships the correct **mechanism** against **stale v1.0 schema**. v2.1 replays:

| File (from branch) | Purpose |
|--------------------|---------|
| `lib/migrate/runner.ts` | Advisory lock, BEGIN/COMMIT per file, ledger insert, checksum drift detection |
| `lib/migrate/plan.ts` | Parse `NNNN-name.sql`, plan pending |
| `lib/migrate/assertMigrated.ts` | Fast-fail in `getDb()` if ledger empty/missing (legacy `companies` probe for transitional DBs) |
| `scripts/migrate.ts` | CLI: `npm run migrate`, `npm run migrate -- --check` |
| `migrations/0001-baseline-schema.sql` | **Regenerate** — must include v2.0 tables from `lib/db-roles.ts`, `db-project-master.ts`, `db-raid-masters.ts`, `db-weekly-reports.ts`, `db-fiscal-budget.ts`, `db-dashboards.ts`, `db-documents.ts`, `db-mapping-tenant.ts` |
| `scripts/data-fixes/*` | Boot-time UPDATE/backfill scripts moved out of `getDb()` |
| `migrations/README.md` | Operator runbook |

### New vs modified (migrations)

**New files:**
- `lib/migrate/runner.ts`, `plan.ts`, `assertMigrated.ts` (+ tests)
- `migrations/0001-baseline-schema.sql` (regenerated), `migrations/README.md`
- `scripts/migrate.ts`, `scripts/data-fixes/*.ts`
- `package.json` scripts: `"migrate": "tsx scripts/migrate.ts"`; devDependency `tsx`

**Modified files:**
- `lib/db.ts` — remove `initPostgresSchema`, `migratePostgresSchema`, all `migrate*` imports from `db-*.ts`, `backfillWeightedCompletion` from boot path; add `assertMigrated`; keep `PostgresClient`, pool singleton, types, `seedAuthData`, `runInTransaction`
- `Dockerfile` — copy `migrations/` + `scripts/` into runner; add release/init migrate step (or document operator Job until `tsx` vendored in prod image)
- `railway.json` — optional `deploy.preDeployCommand` / release command for migrate
- K8s manifest (when present) — init Job running `npm run migrate -- --check` then migrate

### Integration flow

```text
Deploy / operator
    │
    ▼
npm run migrate  ──► scripts/migrate.ts
    │                    │
    │                    ├─ load migrations/*.sql (fs at CLI time only)
    │                    ├─ runMigrations() → schema_migrations ledger
    │                    └─ getDb() → seed if users empty
    │
    ▼
App boot (next start)
    │
    ▼
getDb()  ──► Pool connect
    │        assertMigrated()  ──► fail fast if no ledger
    │        seedAuthData()     ──► idempotent admin seed
    └─► return PostgresClient (DbClient)
```

**Critical:** Schema source of truth **moves from `lib/db.ts` to `migrations/`**. After cutover, new DDL is **only** new `NNNN-*.sql` files — stop editing inline arrays in `db-*.ts` (those modules become delete candidates once folded into baseline + later migrations).

### First deploy on existing production DB

Idempotent `0001` stamps ledger without destructive changes (same as origin README). Rehearse on `pg_dump` scratch copy first — old boot path swallowed errors with `try/catch`, so first explicit migrate may surface latent DDL gaps.

---

## Kysely Integration (ENF-02)

### Design: same pool, no big-bang

Kysely sits **beside** `PostgresClient`, not replacing it on day one.

**New files:**
- `lib/kysely.ts` — `getKysely(): Kysely<Database>` using `PostgresDialect({ pool: _pool })` after `getDb()` initializes pool
- `lib/db-types.ts` — `Database` interface (hand-maintained initially; optional later `kysely-codegen` against migrated schema)
- `lib/repositories/_kysely-helpers.ts` — typed update helpers mirroring `buildUpdate` semantics

**Modified files:**
- `lib/db.ts` — export `getPool()` or ensure `getKysely` reads same `_pool` singleton
- `package.json` — `"kysely": "^0.29.x"` (PostgresDialect accepts existing `pg.Pool`)
- Each `*.repo.ts` — incremental conversion

### Bridge pattern

```typescript
// lib/kysely.ts
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from '@/lib/db-types';

let _kysely: Kysely<Database> | null = null;

export async function getKysely(): Promise<Kysely<Database>> {
  if (_kysely) return _kysely;
  const pool = await getPool(); // same pool as PostgresClient
  _kysely = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return _kysely;
}
```

### Allowlist migration strategy

| Phase | Repos | Approach |
|-------|-------|----------|
| 1 | `audit.repo`, `weekly-periods.repo` | Greenfield v2 tables — full Kysely |
| 2 | `projects.repo`, `risks.repo`, `issues.repo` | Hybrid: reads via Kysely, writes keep `buildUpdate` until typed |
| 3 | Remaining repos | Convert per module move |
| Last | `_helpers.ts` `buildUpdate` | Retire when all UPDATE paths use `.updateTable().set(pick(...))` |

**Compile-time allowlist:** define `UpdatableProject = Pick<ProjectTable, 'name' | 'status' | …>` and pass to `.set()` — replaces runtime `PROJECT_COLUMNS` array checks.

**Keep `DbClient` for:** `runInTransaction` paths, data-fix scripts, migrate runner (simple `pool.query`), any raw SQL too dynamic for Kysely.

**Do NOT:** introduce Prisma/Drizzle, replace `pg` driver, or rewrite all repos before DATA cutover (schema types depend on migrated ledger).

---

## Proxy vs Node Wrappers (PROXY-01)

### Division of responsibility

| Layer | Runs on | Session truth | Tenancy truth | Missing cookie |
|-------|---------|---------------|---------------|----------------|
| `proxy.ts` | Edge | Cookie **presence** only | None | **API:** JSON 401; **pages:** redirect `/login` |
| `withAuth` family | Node | DB session via `getSessionFromRequest` | `actor` + role/project asserts | JSON 401 (defense in depth) |

**Modified:** `proxy.ts` lines 29–34 — when `pathname.startsWith('/api/')` and no cookie, return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` instead of redirect (which produced HTML 307 for API clients).

**Unchanged:** Wrappers remain authoritative for expired/locked/inactive sessions, role matrix, project/program scope. **Never import `pg` or call `getDb()` from `proxy.ts`** — edge runtime is not viable for bank-session DB lookups.

```typescript
// proxy.ts — PROXY-01 shape
if (!session?.value) {
  if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (pathname === '/') return NextResponse.redirect(new URL('/landing', req.url));
  // ... page redirect
}
```

---

## Data Flow: Route Thinning (THIN-01)

### Current debt (routes → repo direct)

These bypass services today and are THIN-01 targets:

- `app/api/operations/**` → `lib/repositories/operations.repo.ts`
- `app/api/admin/**` (most) → `admin.repo`, `rag-config.repo`, `jira-config.repo`
- `app/api/config/route.ts` → `settings.repo`
- `app/api/import-mapping/**`, `bug-import-mapping/**` → repos (partially has services)
- `app/api/programs/route.ts`, `resources/route.ts`, some portfolio helpers → repos

### Target flow

```text
app/api/operations/systems/route.ts  (thin re-export)
    → modules/operations/backend/routes/systems.route.ts
        → withAuth + ops access check
        → operations.service.ts
            → operations.repo.ts
```

**New services (examples):**
- `modules/operations/backend/services/operations.service.ts`
- `modules/admin/backend/services/admin-companies.service.ts`
- `modules/config/backend/services/config.service.ts`

**Modified:** each listed route file shrinks to wrapper + service call; repos unchanged initially.

---

## v2 UI Consumers (UI-DASH / UI-WEEK / UI-DOC / UI-AUDIT)

APIs already exist and follow wrapper → service pattern:

| API | Wrapper | Service | New UI home |
|-----|---------|---------|-------------|
| `/api/dashboards/portfolio`, `/pm`, filters, export | `withCpmo` / PM role | `spec-dashboards.service.ts` | `modules/dashboards/ui/pages/*` |
| `/api/weekly-periods`, tracking, project weekly-reports | `withCpmo`, `withProjectAccess` | `weekly-*.service.ts` | `modules/weekly/ui/pages/*` |
| `/api/projects/[id]/document-checklist` | `withProjectAccess` | `project-document-checklist.service.ts` | `modules/documents/ui/pages/*` |
| `/api/audit` | `withCpmo` | `audit.service.ts` | `modules/audit/ui/pages/*` |

**Flow:** UI hooks `fetch('/api/...')` with cookies → proxy (401 JSON if logged out) → wrapper (role assert) → service → repo → JSON.

**New pages** live in module `ui/`; `app/` adds routes + Sidebar links in `components/layout/Sidebar.tsx`.

**Order:** UI phases run **after** module backend dirs exist (or concurrently once API paths stable) — APIs already shipped in v2.0.

---

## Architectural Patterns

### Pattern 1: Thin app shell + fat modules

**What:** Routable files in `app/` only re-export from `modules/`.
**When:** Every feature move (MOD-01).
**Trade-off:** Two paths per route until moves complete; grep `@/modules` to track progress.

### Pattern 2: Ledger-gated boot

**What:** `getDb()` refuses to serve if `schema_migrations` empty; operator runs migrate first.
**When:** Immediately after DATA cutover.
**Trade-off:** Cold start faster and deterministic; deploy must wire migrate job.

### Pattern 3: Dual data access during Kysely rollout

**What:** `getDb()` for legacy repos; `getKysely()` for converted repos; same pool.
**When:** ENF-02 incremental.
**Trade-off:** Temporary duplication; avoid converting repo before its schema is in migrations.

### Pattern 4: Wrapper-first API surface

**What:** ENF-01 ESLint rule — project-scoped `route.ts` must export handler wrapped by sanctioned helper.
**When:** Parallel to module moves; prevents new debt.

---

## Suggested Build Order

Dependencies enforced:

```text
DATA-01..03 ─────────────────────────────────────────────┐
       │                                                │
       ├─► PROXY-01 (small, independent)                │
       ├─► ENF-01 ESLint gate                           │
       ├─► THIN-01 ops/admin/config services            │
       │                                                │
       ├─► MOD-01 module split (incremental)           │
       │      backend routes/services/repos per area    │
       │      then ui pages/hooks per area              │
       │                                                │
       └─► ENF-02 Kysely (repo-by-repo) ◄── schema stable
                │
                ├─► UI-DASH / UI-WEEK / UI-DOC / UI-AUDIT
                ├─► PERF-01..03
                └─► NIT-01..02, HYG-02, NYQ-01
```

### Phase 0 — DATA-01..03 (blocker for everything else)

1. Copy `lib/migrate/*`, `scripts/migrate.ts` from origin branch
2. Generate `migrations/0001-baseline-schema.sql` from current `lib/db.ts` + all `lib/db-*.ts` DDL
3. Move boot UPDATE/backfill to `scripts/data-fixes/`
4. Slim `getDb()` to pool + `assertMigrated` + seed
5. Wire `npm run migrate` in CI/deploy docs; rehearse on scratch DB
6. Delete obsolete inline migration functions once ledger stamped

### Phase 1 — Enforcement + proxy (parallel, low risk)

- PROXY-01: JSON 401 for API
- ENF-01: ESLint/CI — wrapped exports on `app/api/**/route.ts`
- JIRA-01: hygiene in jira module/route

### Phase 2 — THIN-01 services

- Add operations/admin/config services; routes call services only
- Fits naturally into `modules/operations/backend`, `modules/admin/backend`

### Phase 3 — MOD-01 incremental module moves

Recommended move order (backend first, then ui):

1. **dashboards, weekly, audit, documents** — v2 APIs already service-backed; add UI in same module
2. **auth, admin, config** — small surface
3. **operations, import, jira, export** — THIN-01 overlap
4. **programs, resources, portfolio** — portfolio home + sub-pages
5. **projects** — largest; move nested resources in batches (milestones, timeline, risks, …)

Each batch: move files → update imports to `@/modules/...` → leave thin `app/` re-export → run tests.

### Phase 4 — ENF-02 Kysely

**Only after Phase 0 complete.** Per-module repo conversion alongside or after backend move:

1. Add `lib/kysely.ts` + `lib/db-types.ts`
2. Convert v2 repos (audit, weekly, dashboard-filter-state)
3. Convert high-churn masters (projects, risks, issues, milestones)
4. Remaining repos + retire runtime allowlists

### Phase 5 — v2 UI consumers

- UI-DASH, UI-WEEK, UI-DOC, UI-AUDIT in respective `modules/*/ui/`
- Sidebar nav entries; reuse existing API contracts (no API rewrite)

### Phase 6 — PERF + nits

- PERF-01 virtualization in grid-heavy module UIs
- PERF-02 RSC chrome extraction
- PERF-03 cold-start budget (benefits from DATA already)
- NIT-01..02, HYG-02, NYQ-01

---

## New vs Modified Summary

### New

| Path | Purpose |
|------|---------|
| `modules/**` | Feature backend + ui (entire tree) |
| `lib/migrate/**` | Migration runner, assertMigrated |
| `lib/kysely.ts`, `lib/db-types.ts` | Kysely + schema types |
| `migrations/*.sql` | Versioned DDL |
| `scripts/migrate.ts`, `scripts/data-fixes/**` | CLI migrate + one-off fixes |
| Module UI pages | Portfolio/PM dashboards, weekly tracking, checklist, audit viewer |

### Modified

| Path | Change |
|------|--------|
| `lib/db.ts` | Remove boot DDL/migrations; add assertMigrated; optional getPool export |
| `app/api/**/route.ts` | Thin re-exports → modules |
| `app/**/page.tsx` | Thin re-exports → modules |
| `proxy.ts` | JSON 401 for unauthenticated API |
| `app/api/operations/**`, `admin/**`, `config/**` | Route → service (THIN-01) |
| `lib/repositories/*.repo.ts` | Incremental Kysely (ENF-02) |
| `package.json` | migrate script, kysely, tsx |
| `Dockerfile`, deploy manifests | Ship migrations; migrate job |
| `eslint.config.mjs` | ENF-01 wrapper rule |
| `vitest.config.ts` | Include `modules/**` test globs |
| `components/layout/Sidebar.tsx` | Nav to new v2 UI routes |

### Deleted (after DATA cutover)

| Path | When |
|------|------|
| `lib/db-*.ts` inline migrate functions | After folded into `migrations/0001` + verified |
| `initPostgresSchema` / `migratePostgresSchema` in `lib/db.ts` | Phase 0 |
| `lib/services/*.service.ts` + `lib/repositories/*.repo.ts` | After moved to modules (re-export shims optional short-term) |

### Unchanged

- Next.js 16 App Router, React 19, PostgreSQL, `pg` pool
- `lib/http/*` wrappers — remain enforcement point
- `lib/integrations/*`, `lib/auth.ts`, `lib/api-errors.ts`
- Multi-tenant access model (CPMO/PM/Viewer)
- Vitest 4 gate, Docker standalone, `serverExternalPackages`

---

## Anti-Patterns

### Put pages only under modules/ without app/ re-exports

**Why wrong:** Next.js will not serve URLs.
**Instead:** Always mirror with one-line `app/**` re-export.

### Run Kysely/codegen before migration cutover

**Why wrong:** Schema types drift from production; boot still mutates DDL.
**Instead:** DATA first; baseline SQL is source of truth; then db-types.

### DB session lookup in proxy.ts

**Why wrong:** Edge cannot run `pg`; duplicates Node authz.
**Instead:** Cookie presence at edge; full session in `withAuth`.

### Big-bang move of all lib/services to modules

**Why wrong:** Massive conflict surface; blocks v2.1 delivery.
**Instead:** Incremental per feature area; shims `@/lib/services/foo` → re-export during transition.

### Merge origin migration branch as-is

**Why wrong:** Missing v2.0 tables (weekly, fiscal, roles, audit, dashboards, checklist).
**Instead:** Replay runner pattern; regenerate `0001` from current master schema.

---

## Scaling Considerations

| Concern | Today | After v2.1 |
|---------|-------|------------|
| Cold start | `getDb()` runs full DDL chain | Pool + assert + seed only — PERF-03 measurable win |
| Deploy schema | Implicit on first request | Explicit migrate job — safer multi-replica |
| Repo safety | Runtime allowlists | + compile-time Kysely picks |
| Code navigation | Flat lib/ + app/ | Feature modules — clearer ownership |

---

## Integration Points

### External Services

| Service | Pattern | Notes |
|---------|---------|-------|
| PostgreSQL | `pg.Pool` singleton → `DbClient` + Kysely | Migrations via CLI only post-DATA |
| Jira/Anthropic/Resend | `lib/integrations/*` | Unchanged; called from module routes/services |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/` ↔ `modules/` | Re-export | URL stability |
| `modules/*/ui` ↔ `modules/*/backend` | HTTP `/api/*` only | No direct service import from client components |
| `modules/*/backend/services` ↔ `lib/` | `@/lib/db`, `@/lib/http` | Shared pool + wrappers |
| Migrate CLI ↔ App | `schema_migrations` ledger | assertMigrated on boot |

---

## Sources

- Live codebase: `lib/db.ts`, `proxy.ts`, `lib/http/*`, `app/api/dashboards/*`, `app/api/audit/route.ts`, THIN-01 route grep
- `.planning/PROJECT.md` — v2.1 requirements MOD-01, DATA-01..03, ENF-02, PROXY-01
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md` — v1.0 layer model (preserved)
- `origin/gsd/quick-260826-ded-data-layer-migrations` — `lib/migrate/*`, `scripts/migrate.ts`, `migrations/README.md` (pattern only; baseline stale)
- Kysely docs — `PostgresDialect({ pool })` accepts existing `pg.Pool` ([kysely-org/kysely](https://github.com/kysely-org/kysely))

---
*Architecture research for: PM Tool B v2.1 Hardening & Deferred Debt*
*Researched: 2026-08-28*
