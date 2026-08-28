# Project Research Summary

**Project:** PM Tool B — Portfolio One View (v2.1 Hardening & Deferred Debt)
**Domain:** Brownfield Next.js 16 multi-tenant PPM — engineering debt closure, module restructure, v2 UI consumers
**Researched:** 2026-08-28
**Confidence:** HIGH

## Executive Summary

PM Tool B v2.1 is a **brownfield hardening milestone**, not a product expansion. v2.0 shipped PR-01..PR-15 and AUDIT-01 at the API/service gate (`ui_phase: false`); v2.1 makes the repo deploy-safe, maintainable, performant, and **product-complete** by wiring React consumers to existing APIs, externalizing schema evolution, and reorganizing every feature area into `modules/<feature>/{backend,ui}` with thin `app/` re-exports.

Experts build mature brownfield PPM apps in three parallel tracks after an API-first delivery: **operational** (decouple schema from request path via versioned SQL + external migrate job), **structural** (domain modules with backend/UI colocation while preserving App Router URL conventions), and **surface completion** (dashboard, weekly cadence, document checklist, audit viewer screens users expect). The recommended approach preserves the validated v2.0 stack (Next.js 16.2.4, React 19, PostgreSQL via `pg`, Vitest 4, layered auth) and adds only targeted dependencies: `kysely@0.29.5`, `@tanstack/react-virtual@3.14.10`, pinned `tsx@4.23.12`, `kysely-codegen@0.20.0`, and a local ESLint rule for wrapper enforcement.

The **critical path is DATA-01..03 as a single Phase 19 task**: replay the migration runner/ledger pattern from `origin/gsd/quick-260826-ded-data-layer-migrations`, **regenerate** `migrations/0001-baseline-schema.sql` from current v2.0 schema (never merge the branch as-is — its baseline omits weekly, fiscal, roles, RAID master, dashboard, checklist, and audit tables), slim `getDb()` to connect + `assertMigrated` + seed only, and wire `npm run migrate` in deploy pipelines. Everything else — Kysely types, cold-start budgets, module moves, v2 UI — depends on or benefits from this cutover. Top risks: stale baseline merge (production outage on missing v2 tables), stripping boot DDL before every environment has run external migrate (empty-schema 500s), MOD-01 breaking App Router without thin `app/` shells (404s), and THIN-01 misapplying D-23 gate semantics on ops/admin routes. Mitigate with brownfield ledger stamping, mandatory re-export invariants, route gate inventory, and dual CI matrix (empty DB + brownfield fixture).

## Key Findings

### Recommended Stack

v2.0 stack is **fixed** — no framework swap. v2.1 adds compile-time repo safety, grid virtualization, and external migration CLI on top of the existing `pg.Pool` singleton.

**Core technologies (unchanged):**
- **Next.js 16.2.4** — App Router, `proxy.ts`, RSC layouts; no middleware migration
- **React 19.2.4** — UI host for `@tanstack/react-virtual`
- **PostgreSQL + `pg@^8.20.0`** — single pool shared by `DbClient` and Kysely during ENF-02 rollout
- **Vitest 4.1.10** — extended for migration runner, wrapper lint, cold-start script tests

**New runtime dependencies:**
- **kysely@0.29.5** — type-safe query builder over existing pool; compile-time column picks replace string allowlists (ENF-02)
- **@tanstack/react-virtual@3.14.10** — headless row virtualization for timeline, admin, audit grids (PERF-01)

**New dev dependencies:**
- **tsx@4.23.12** (pinned) — migration CLI + cold-start script; never bare `npx tsx` in Docker/CI
- **kysely-codegen@0.20.0** — generate `Database` interface after migrate
- **@typescript-eslint/utils@^8.68.0** — local ESLint rule `pm-tool/require-auth-wrapper` (ENF-01)

**Migration stack:** Custom runner from origin branch (advisory lock, checksum ledger, drift detection) — **reject** `node-pg-migrate`. Regenerate baseline SQL; move boot UPDATE/backfill to `scripts/data-fixes/`.

### Expected Features

**Must have (table stakes — P1):**
- **DATA-01..03** — External migrate; app connects only; versioned SQL; one-off data-fix scripts
- **UI-DASH, UI-WEEK, UI-DOC, UI-AUDIT** — React consumers for spec APIs (product completeness)
- **MOD-01** — Repo-wide `modules/<feature>/{backend,ui}` with thin `app/` re-exports
- **THIN-01 + PROXY-01 + JIRA-01** — Service-layer completion, JSON 401 for API, Jira hygiene
- **ENF-01** — Wrapper CI gate on project-scoped routes

**Should have (P2 — sequenced in v2.1 if capacity allows):**
- **PERF-01** — Virtualized CPMO tracking and large grids
- **PERF-02** — RSC static chrome on v2 pages
- **ENF-02** — Kysely in repositories (incremental, repo-by-repo)
- **PERF-03** — Cold-start budget after DATA cutover
- **NIT-01 + NIT-02** — Orphan exports, audit noise, fiscal/v1 budget coexistence doc
- **NYQ-01** — Nyquist validate-phase on v2.1 phases only (Phase 19+)

**Operator gate (not a feature):**
- **HYG-02** — Operator confirms Anthropic 502 vs 500; no rewrite unless rejected

**Defer / anti-features:**
- Merging DATA origin branch as-is
- Big-bang repo restructure in one PR
- Dual migration paths (boot DDL + external job)
- Full Kysely rewrite in single phase
- Second ORM (Prisma/Drizzle)
- New PR-01..15 product behavior

### Architecture Approach

Preserve **edge gate → HTTP wrappers → route → service → repository → PostgreSQL**. v2.1 adds three structural changes: (1) `modules/<feature>/{backend,ui}` as canonical feature home with `app/` as thin URL shell, (2) external versioned migrations with ledger-gated boot, (3) Kysely beside `PostgresClient` on same pool with incremental repo adoption.

**Major components:**
1. **`proxy.ts`** — Cookie presence, request-id, JSON 401 for unauthenticated `/api/*`; no DB/pg at edge
2. **`lib/http/*` wrappers** — Node-runtime source of truth for session, role, project/program access
3. **`modules/*/backend/`** — Route handlers, services, repos per feature domain
4. **`modules/*/ui/`** — Pages, hooks, components; client fetch to `/api/*` only
5. **`lib/migrate/*` + `migrations/*.sql`** — Schema source of truth moves from `lib/db.ts` inline DDL
6. **`lib/kysely.ts`** — Typed query builder on shared `_pool` (ENF-02)

**Build order:** DATA → PROXY/ENF-01/JIRA → THIN-01 → MOD-01 (incremental) → ENF-02 → v2 UI consumers → PERF/nits.

### Critical Pitfalls

1. **Stale DATA branch merge** — Origin branch baseline is v1.0-era; merging drops all v2.0 tables. Regenerate `0001` from current `lib/db.ts` + `lib/db-*.ts`; diff must include weekly, fiscal, roles, RAID, dashboard, doc, audit tables.
2. **Stripping `getDb()` migrate loop without cutover plan** — Production DBs have no `schema_migrations` ledger today. Ship runner → stamp ledger on every env → only then slim `getDb()`. CI matrix: empty DB + brownfield fixture.
3. **MOD-01 without thin `app/` shells** — Next.js only serves routes from `app/`. Every move needs one-line re-export; update Vitest globs; smoke `next build` + standalone curl after each module batch.
4. **Kysely types drift / mass-assignment escape** — Use narrow `Pick<Updateable<'table'>, ...>` per repo; regenerate types when migrations change; keep Vitest mass-assignment tests; single pool only.
5. **THIN-01 D-23 gate regression** — Ops/admin routes are session+tenant or platform break-glass, not full CPMO matrix. Maintain route gate inventory; structure-only refactor preserves semantics.
6. **PROXY-01 breaking page redirects** — API without cookie → JSON 401; pages without cookie → 307 redirect. Preserve `PUBLIC` list; client fetch helpers redirect on 401.

## Implications for Roadmap

Based on research, suggested phase structure continues from Phase 18. v2.1 starts at **Phase 19**.

### Phase 19: Data Layer Cutover (DATA-01..03)
**Rationale:** Blocker for ENF-02 types, PERF-03 meaningful baseline, and safe multi-replica deploys. Single atomic task — runner, regenerated baseline, data-fix scripts, slim `getDb()`.
**Delivers:** `lib/migrate/*`, `scripts/migrate.ts`, `migrations/0001-baseline-schema.sql` (v2.0 complete), `scripts/data-fixes/*`, deploy migrate wiring, brownfield ledger stamp
**Addresses:** DATA-01, DATA-02, DATA-03
**Avoids:** Stale baseline merge (Pitfall 1), empty-schema boot (Pitfall 2), dual DDL paths
**Uses:** `tsx@4.23.12`, custom runner from origin branch pattern

### Phase 20: API Contract & Route Hygiene (PROXY-01, JIRA-01)
**Rationale:** Low-risk, independent of module moves; fixes documented v1.0 API contract debt immediately after DATA stabilizes deploy path.
**Delivers:** JSON 401 for unauthenticated `/api/*` in `proxy.ts`; Jira search log guard + body validation; curl matrix green
**Addresses:** PROXY-01, JIRA-01
**Avoids:** Proxy breaking page redirects (Pitfall 5)

### Phase 21: Auth Wrapper Enforcement (ENF-01)
**Rationale:** Security gate before large MOD-01 diffs; use shrinking allowlist if route facades still mid-move.
**Delivers:** Local ESLint rule `pm-tool/require-auth-wrapper`, D-23 exemption list, CI `npm run lint` gate
**Addresses:** ENF-01
**Avoids:** ESLint blocking MOD-01 PRs without allowlist strategy (Pitfall 13)

### Phase 22: Route Thinning (THIN-01)
**Rationale:** Closes SVC-01/ROUTE-05 remainder; natural fit for `modules/operations/backend`, `modules/admin/backend`, `modules/config/backend`.
**Delivers:** Service layer for ops/admin/config/import-mapping routes; route → service → repo flow; gate inventory preserved
**Addresses:** THIN-01
**Avoids:** D-23 over/under gating (Pitfall 6)

### Phase 23: Module Structure — v2 Domains (MOD-01 Wave 1)
**Rationale:** v2 APIs already service-backed; greenfield UI lands in same modules from day one — avoids double moves.
**Delivers:** `modules/dashboards`, `modules/weekly`, `modules/documents`, `modules/audit` with backend routes/services/repos + thin `app/` re-exports
**Addresses:** MOD-01 (partial)
**Implements:** Thin app shell + fat modules pattern
**Avoids:** App Router 404s (Pitfall 4)

### Phase 24: Portfolio & PM Dashboards (UI-DASH)
**Rationale:** High user value; APIs shipped Phase 16; depends on dashboards module backend from Phase 23.
**Delivers:** Portfolio + PM dashboard pages, filters, export triggers, Sidebar nav; spec KPI rules (not v1 aggregates)
**Addresses:** UI-DASH
**Avoids:** UI-only authorization (Pitfall 10); dual budget confusion — defer fiscal tiles pending NIT-02 decision

### Phase 25: Weekly Workflow Surfaces (UI-WEEK + PERF-01 partial)
**Rationale:** Largest UI surface; CPMO tracking grid needs virtualization at enterprise row counts.
**Delivers:** Period config, PM submit/correct, CPMO tracking/consolidation pages; `@tanstack/react-virtual` on tracking grid
**Addresses:** UI-WEEK, PERF-01 (tracking grid)
**Avoids:** Grid selection/export bugs (Pitfall 9); weekly state machine bypass (Pitfall 10)

### Phase 26: Documents & Audit UI (UI-DOC, UI-AUDIT)
**Rationale:** Compliance and bank audit requirements; medium complexity; APIs shipped Phases 17–18.
**Delivers:** Document catalog/templates/checklist UI; CPMO audit log viewer with filter/pagination; virtualized audit if volume high
**Addresses:** UI-DOC, UI-AUDIT

### Phase 27: Module Structure — Remaining Domains (MOD-01 Wave 2–3)
**Rationale:** Complete repo-wide split after v2 UI proves module pattern; projects module is largest — batch nested resources.
**Delivers:** `modules/auth`, `admin`, `operations`, `import`, `jira`, `export`, `config`, `resources`, `programs`, `portfolio`, `projects` (incremental); all `app/` shells stable
**Addresses:** MOD-01 (completion)
**Avoids:** Big-bang move (anti-feature); standalone trace misses (Pitfall 4)

### Phase 28: Kysely Repository Adoption (ENF-02)
**Rationale:** Requires stable schema from Phase 19; incremental repo-by-repo alongside or after module backend moves.
**Delivers:** `lib/kysely.ts`, `lib/db-types.ts` (codegen), v2 repos first (audit, weekly, dashboard-filter), then high-churn masters; retire `buildUpdate` per table when complete
**Addresses:** ENF-02
**Uses:** `kysely@0.29.5`, `kysely-codegen@0.20.0`
**Avoids:** Kysely allowlist drift (Pitfall 3); second pool

### Phase 29: Performance & RSC Chrome (PERF-02, PERF-03)
**Rationale:** PERF-03 only meaningful post-DATA; PERF-02 on v2 pages after UI exists; split Sidebar server/client.
**Delivers:** Server layout chrome, `SidebarShell` + `SidebarInteractive`; cold-start measurement script + budget gate; RSC boundaries audited
**Addresses:** PERF-02, PERF-03
**Avoids:** RSC/hook double fetch (Pitfall 8); pre-DATA false baseline (Pitfall 17)

### Phase 30: Nits, Validation & Operator Gate (NIT-01, NIT-02, NYQ-01, HYG-02)
**Rationale:** Cleanup and process hygiene; NIT-02 fiscal KPI decision before any fiscal dashboard tiles; NYQ-01 scoped to Phase 19+ only.
**Delivers:** Wire-or-delete orphan exports; no-op milestone audit skip; fiscal/v1 budget coexistence doc; operator HYG-02 sign-off; v2.1 VALIDATION.md reconciliation
**Addresses:** NIT-01, NIT-02, NYQ-01, HYG-02
**Avoids:** Nyquist archive mutation (Pitfall 12); HYG-02 scope creep (Pitfall 11)

### Phase Ordering Rationale

- **DATA first (Phase 19):** Every downstream item either blocks on or confounds metrics without external migrate — Kysely codegen, cold-start budget, deploy safety.
- **PROXY/JIRA/ENF-01 before large moves:** Low-risk debt closure; ENF-01 with allowlist strategy prevents security regression during MOD-01.
- **THIN-01 before MOD-01 Wave 2:** Service extraction aligns with module backend directories for ops/admin.
- **MOD-01 Wave 1 before v2 UI:** New pages land in `modules/*/ui/` from day one; avoids retrofit double-move.
- **UI-WEEK after UI-DASH:** Weekly is highest complexity; virtualization bundled to prevent shipping unusable grids.
- **ENF-02 after DATA + module backend stable:** Types must match migrated ledger; repos convert inside module backend dirs.
- **PERF-03 after DATA:** Otherwise budget confounds inline DDL time.
- **Nits last:** Depend on UI-DASH for fiscal KPI decision; NYQ-01 validates v2.1 phases without touching archived v1/v2 artifacts.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 19 (DATA):** Brownfield ledger stamp strategy per environment (Railway, K8s, local); production cutover rehearsal on `pg_dump` scratch copy
- **Phase 22 (THIN-01):** Route gate inventory with D-23 class labels per ops/admin/config route
- **Phase 25 (UI-WEEK):** Weekly state machine UI mapping from Phase 13 VERIFICATION; amendment/correct flow edge cases
- **Phase 28 (ENF-02):** Per-table narrow update type design; transaction bridge with `runInTransaction`

Phases with standard patterns (skip research-phase):
- **Phase 20 (PROXY-01):** Documented in `06-PROXY-FINDING.md`; Next.js 16 proxy JSON 401 pattern verified
- **Phase 21 (ENF-01):** Existing wrapper export patterns in codebase; local ESLint rule is established technique
- **Phase 29 (PERF-01):** `@tanstack/react-virtual` headless row pattern well-documented
- **Phase 30 (HYG-02):** Confirm-only checkpoint; no research needed unless operator rejects 502

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Additive on validated v2.0 base; versions verified via npm + Context7; origin branch pattern inspected locally |
| Features | HIGH | Scoped to PROJECT.md Active set + milestone audits; dependency graph explicit |
| Architecture | HIGH | Grounded in live codebase + origin branch; module layout matches Next.js 16 App Router constraints |
| Pitfalls | HIGH | Brownfield pitfalls verified against `lib/db.ts`, `proxy.ts`, D-23 docs, dual budget Phase 15 decisions |

**Overall confidence:** HIGH

### Gaps to Address

- **NIT-02 fiscal KPI product decision:** Coexist, redirect, or migrate v1 `budget_items` vs spec fiscal ledger — must be decided before UI-DASH fiscal tiles (default: coexist with source labels).
- **Brownfield ledger stamp script:** Exact mechanism for production DBs without `schema_migrations` — plan during Phase 19 with sentinel table checks.
- **ENF-01 vs MOD-01 timing:** If large module moves start before ESLint gate, use shrinking directory allowlist — finalize in Phase 21 plan.
- **Docker prod image + tsx:** Whether migrate runs init container vs release command — document in Phase 19 deploy plan.
- **`listOpenProjectDependencies` wire-or-delete:** Grep-driven decision in NIT-01 — wire to dashboard dependency tile or remove export.

## Sources

### Primary (HIGH confidence)
- Context7 `/kysely-org/kysely` — PostgresDialect + Pool, transactions, TS strict requirement
- Context7 `/robinblomberg/kysely-codegen` — CLI codegen from DATABASE_URL
- Context7 `/tanstack/virtual` — `@tanstack/react-virtual` row virtualization
- Context7 `/vercel/next.js/v16.2.9` — proxy JSON 401, RSC layout boundaries
- Codebase: `lib/db.ts`, `proxy.ts`, `lib/http/with-*.ts`, `app/api/**/route.ts`
- Origin branch `gsd/quick-260826-ded-data-layer-migrations` — runner/ledger pattern (baseline stale)
- `.planning/PROJECT.md`, `v1.0-MILESTONE-AUDIT.md`, `v2.0-MILESTONE-AUDIT.md`

### Secondary (MEDIUM confidence)
- Brownfield migration practice — external Job/CLI decoupling from app startup
- Next.js enterprise module patterns — thin `app/`, domain modules with backend/UI split
- Kysely brownfield fit — query builder over existing schema without second ORM

### Tertiary (LOW confidence)
- K8s init Job migrate wiring — manifests may not exist yet; validate during Phase 19 deploy planning

---
*Research completed: 2026-08-28*
*Ready for roadmap: yes*
*Milestone: v2.1 Hardening & Deferred Debt (Phase 19+)*