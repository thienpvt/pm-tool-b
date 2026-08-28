# Feature Research

**Domain:** v2.1 Hardening & Deferred Debt — brownfield Next.js 16 App Router PPM (post–PR-01..15 API gate)
**Researched:** 2026-08-28
**Confidence:** HIGH (scoped to deferred items in PROJECT.md, v1/v2 milestone audits, and live codebase shape)

## Feature Landscape

This milestone closes **engineering debt and missing UI surfaces**, not new product spec. PR-01..PR-15 and AUDIT-01 are shipped at the API/service gate (`ui_phase: false`). v2.1 makes the repo maintainable, deploy-safe, performant, and **usable** by wiring React consumers to existing APIs.

Brownfield PPM hardening typically follows three tracks in parallel after an API-first delivery:

1. **Structural** — colocate backend (routes, services, repos) and UI (pages, hooks, components) per domain module while keeping `app/` as a thin App Router shell.
2. **Operational** — decouple schema evolution from request path (external migrate job, versioned SQL, one-off data fixes).
3. **Surface completion** — ship the screens users expect for dashboards, weekly cadence, compliance checklist, and audit review.

---

### Category A — Repo Structure (MOD-01)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|----------------------|
| MOD-01 | Repo-wide per-module **backend** + **UI** directories (sibling dirs per feature area) | **Table stakes (engineering)** | Enterprise brownfield refactors converge on domain modules once `lib/services` + `app/api` + scattered `app/**/_components` outgrow navigation. Thin `app/` routes import from module barrels; `@/` alias preserved. | **HIGH** — touches every feature area (portfolio, projects, admin, operations, reports, Jira/import, dashboards, weekly, checklist, audit, auth, resources, programs), not only new v2 screens | **Depends on:** stable layer contracts (route → service → repo). **Must not break:** App Router file conventions (`page.tsx`, `route.ts` stay under `app/` or re-export from module UI); `@/` imports. **Pattern:** `modules/<domain>/backend/{routes,services,repos}` + `modules/<domain>/ui/{pages,hooks,components}` with `app/` delegating, OR equivalent `features/<domain>/server|client` split — planning decision, not product behavior. |

**Typical behavior:** Each module owns its vertical slice. Routes remain discoverable under `app/api/**` (Next.js requirement) but delegate to module backend code. Pages/hooks move out of ad-hoc `app/**/_components` into module UI dirs. Shared chrome (`app/_components`, layout) stays cross-cutting. Barrel `index.ts` per module defines public API; internal paths are private.

**Scope guard:** Move existing areas — portfolio home/roadmap/report/budget/members, project nested pages, admin, operations, Jira/import mapping, AI/export reports — not greenfield modules.

---

### Category B — Data Layer (DATA-01..03, single task)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| DATA-01 | App start **connects only** — no schema init / migrate loop in `getDb()` | **Table stakes (ops)** | Production PPM apps decouple schema from request path to avoid cold-start races, deploy coupling, and multi-replica DDL contention. Industry default: migrate job runs before or alongside deploy, app assumes schema version. | **HIGH** — removes `migratePostgresSchema` + v2 DDL helpers from hot path | **Blocks:** safe Railway/K8s rolling deploys. **Pattern source:** replay `origin/gsd/quick-260826-ded-data-layer-migrations` runner/ledger — **do not merge branch as-is** (v1.0-era baseline omits v2.0 tables). |
| DATA-02 | Versioned SQL migration files + ledger table | **Table stakes (ops)** | Auditable, replayable schema history is standard for regulated environments (bank ATTT). In-code DDL arrays are acceptable in early MVP, not in mature brownfield. | **MEDIUM** (with DATA-01) | Regenerated `migrations/0001` baseline must include v2.0 weekly, fiscal, roles, RAID master, dashboard, checklist, audit tables from current `lib/db.ts`. |
| DATA-03 | Data-fix `UPDATE`s as **one-off scripts**, not migrations | **Table stakes (ops)** | Mixing corrective DML with DDL migrations causes re-run hazards and obscures audit trail. One-off scripts are idempotent, named, and run manually or in controlled jobs. | **LOW–MEDIUM** | Existing backfills (`migrateMappingTableTenancy`, role backfill, etc.) become scripts or repeatable migration seeds with clear provenance. |

**Typical behavior:** `npm run migrate` (or K8s Job / CI pre-deploy step) applies pending SQL; app reads `DATABASE_URL`, pools connections, fails fast if schema version mismatch. Seeds may remain dev-only.

---

### Category C — Enforcement (ENF-01, ENF-02)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| ENF-01 | CI/ESLint gate: project-scoped `route.ts` must use sanctioned wrapper (`withAuth` / `withProjectAccess` / role helpers) | **Table stakes (security)** | Multi-tenant PPM cannot rely on code review alone; one unwrapped route is an IDOR. Static enforcement is standard after layer reorg (v1.0 ROUTE-03..11). | **MEDIUM** | AST or path-based rule over `app/api/**/route.ts`. Exemptions list for documented carve-outs (D-23 ops/admin platform routes) must be explicit. |
| ENF-02 | Repositories adopt **Kysely** over raw `pg.Pool` queries | **Differentiator (engineering quality)** | Kysely fits brownfield: DB is authority, `kysely-codegen` from existing schema, compile-time column safety without second ORM. Keeps repos as SQL home; services unchanged. | **HIGH** — incremental repo-by-repo; 40+ repo files | **Depends on:** DATA-02 stable schema (types match DB). **Depends on:** repos remain sole SQL layer (REPO-01..06). **Not:** Prisma, Drizzle schema-first, or replacing Postgres. |

**Typical behavior:** ENF-01 fails PR/CI on new raw handlers. ENF-02 adds typed `db.selectFrom('projects').select([...])` with allowlists enforced by TypeScript; runtime behavior identical if migrated faithfully.

---

### Category D — Performance (PERF-01..03)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| PERF-01 | Virtualized large grids (CPMO weekly tracking, portfolio lists, audit log) | **Table stakes (UX at scale)** | Enterprise PMO grids routinely hold 500–5000+ rows; non-virtualized DOM kills scroll and TTI. `@tanstack/react-virtual` or equivalent is default for React data grids. | **MEDIUM** per grid | **UI depends on:** existing list APIs (`/api/weekly-periods/...`, `/api/dashboards/...`, `/api/audit`). Apply where row count > ~100. |
| PERF-02 | Static page chrome as **Server Components** (layouts, headers, nav, KPI shells) | **Differentiator (perf)** | App Router best practice: server-render static chrome, client leaves for interactivity. Reduces JS bundle and improves FCP on dashboard/weekly pages. | **MEDIUM** | Works with MOD-01 UI dirs: `ui/components/server/` vs `client/`. Existing decomposed hooks stay client. |
| PERF-03 | Cold-start time measured and **budgeted** | **Table stakes (ops/SLO)** | After DATA-01 removes boot DDL, establish baseline + budget (e.g. p95 connect < X ms). Without measurement, perf regressions go unnoticed. | **LOW–MEDIUM** | **Depends on:** DATA-01 (otherwise budget confounds migrate time). CI or smoke script records `getDb()` connect latency. |

---

### Category E — Leftover Route Debt (THIN-01, PROXY-01, JIRA-01)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| THIN-01 | Ops / admin / config / import-mapping routes through **services** (SVC-01 / ROUTE-05 remainder) | **Table stakes (architecture)** | v1.0 closed project-scoped routes; non-core paths still hand-roll session + repo calls. Incomplete layer stack is the #1 source of authz drift in brownfield Next apps. | **MEDIUM** | Routes: `app/api/operations/**`, `/api/admin/companies`, `/api/config`, import-mapping, jira-config, resources/portfolio-epics. D-23 carve-out: session+tenant only, not full product role matrix. |
| PROXY-01 | `proxy.ts` returns **JSON 401** for `/api/*` callers, not HTML 307 | **Table stakes (API contract)** | SPA hooks and fetch clients expect `{ error: 'Unauthorized' }` + 401. HTML redirect breaks JSON parse and confuses Jira/AI clients (documented v1.0 finding). | **LOW** | Detect `Accept: application/json` or `/api/` prefix. HTML redirect may remain for document navigations. |
| JIRA-01 | Jira search: remove debug `console.log`, guard `req.json()` | **Table stakes (hygiene)** | Production integration routes must not leak custom fields to logs; malformed body should 400, not 500. Pre-existing Phase 8 review items. | **LOW** | `app/api/jira/search/route.ts` (or post–MOD-01 equivalent). No behavior change to happy path. |

---

### Category F — Operator Checkpoint (NOT a feature)

| ID | Item | Category | Notes |
|----|------|----------|-------|
| HYG-02 | Operator confirms Anthropic malformed-output **502 vs old 500** | **Checkpoint — not a feature** | v1.0 changed three report routes from 500→502 on bad model output. Before closing: operator verifies no dashboard/alert keys off old 500. **No rewrite unless rejected.** Not scoped as user-facing capability; do not create REQUIREMENTS checkbox as product behavior. |

---

### Category G — v2 UI Consumers (UI-DASH, UI-WEEK, UI-DOC, UI-AUDIT)

APIs and tests exist; **no React pages fetch them today**. For a PPM product, missing UI = incomplete product regardless of `ui_phase: false` gate.

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| UI-DASH | Portfolio + PM dashboard pages consuming `/api/dashboards/portfolio`, `/api/dashboards/pm`, filters, export | **Table stakes (product)** | PR-13/PR-14 define executive and PM landing experiences. API satisfied PDSH/MDSH; users expect tiles, charts, filters, drill-downs, action queues. | **HIGH** | **Depends on:** PR-04 assignment scope, existing `spec-dashboards.service.ts`. Reuse v1 portfolio home patterns where KPI definitions align; **must match spec KPI rules**, not v1 aggregates. Lives in module UI dir (dashboards). |
| UI-WEEK | Weekly period config, PM submit/correct, CPMO tracking/consolidation pages | **Table stakes (product)** | Weekly cadence is core PMO value (PR-10..12). CPMO lives in submission grids; PM lives in draft/submit flow. | **VERY HIGH** | **Depends on:** `/api/weekly-periods/**`, `/api/projects/[id]/weekly-reports/**`, tracking/export APIs. Largest UI surface; virtualize tracking grid (PERF-01). |
| UI-DOC | Document catalog, templates, project checklist, compliance view | **Table stakes (product)** | PR-15 compliance workflow is unusable without checklist UI. Generate-on-create/stage already API-wired. | **HIGH** | **Depends on:** `/api/document-catalog`, `/api/document-templates`, `/api/projects/[id]/documents/checklist`, `/api/dashboards/document-compliance`. Confluence link-only — no upload UI. |
| UI-AUDIT | CPMO audit log viewer (filter, paginate, before/after) | **Table stakes (product — bank context)** | AUDIT-01 GET `/api/audit` is CPMO+company-scoped. Regulated PMO expects searchable audit trail UI, not curl. | **MEDIUM** | **Depends on:** existing audit service + GET API. Virtualize if row volume high. |

**Typical behavior:** Client hooks fetch JSON APIs with session cookie; server-side auth unchanged. UI hides controls by role but **never replaces** server enforcement (AUTH-05). Deep links from PM dashboard actions (MDSH-05) land on weekly/milestone/RAID screens.

---

### Category H — Audit Nits (NIT-01, NIT-02, NYQ-01)

| ID | Feature | Category | Why Expected | Complexity | Dependencies / Notes |
|----|---------|----------|--------------|------------|------|
| NIT-01 | Wire or remove unused `listPeriodShells` service wrapper / `listOpenProjectDependencies` export | **Table stakes (engineering hygiene)** | Orphaned exports confuse Phase 16+ consumers and imply unfinished integration. Either dashboard services use them or delete re-exports. | **LOW** | `listPeriodShells`: Phase 14/16 bypass service wrapper. `listOpenProjectDependencies`: exported for Phase 16 but never imported — wire if fiscal/dependency tile needed, else remove. |
| NIT-02 | Fiscal KPIs on portfolio dashboard (if spec-aligned); silence no-op milestone PATCH audit; resolve/document v1 `budget_items` coexistence | **Differentiator / doc** | Phase 16 intentionally omitted budget tiles; confirm with spec whether fiscal KPIs belong on PDSH. No-op audit noise pollutes CPMO viewer. Dual budget models (v1 `budget_items` vs fiscal ledger) need explicit UX or deprecation doc. | **LOW–MEDIUM** | **Depends on:** UI-DASH. Milestone PATCH: skip audit when before==after. Budget: parallel coexistence was intentional — document or redirect UI to fiscal API. |
| NYQ-01 | Nyquist `validate-phase` pass on draft VALIDATION.md files | **Table stakes (quality gate)** | v1/v2 audits: all VALIDATION.md remain `status: draft`. Reconcile test coverage claims vs live tests. | **MEDIUM** (mechanical) | Discovery/orchestration; not user-facing. Run per phase, update VALIDATION frontmatter. |

---

### Shipped Differentiators (retain — not v2.1 scope)

| Feature | Value | v2.1 relationship |
|---------|-------|-------------------|
| Jira Cloud import + sync mappings | Execution data without double entry | Keep; JIRA-01 hygiene only |
| AI report generation (Anthropic) | Leadership narrative acceleration | Keep; HYG-02 checkpoint only |
| Excel / PPT / Word / PDF export | Bank deliverable formats | Reuse in UI-WEEK consolidation, UI-DASH export |
| Layered auth (`withAuth`, `withProjectAccess`, role asserts) | Tenant isolation | Extend via ENF-01, THIN-01 |

---

### Anti-Features (Commonly Requested, Problematic)

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Merge `origin/gsd/quick-260826-ded-data-layer-migrations` as-is** | Faster DATA delivery | Branch baseline is post–v1.0 / pre–v2.0; merge **drops** weekly, fiscal, roles, RAID master, dashboard, checklist, audit tables | Replay runner/ledger/**pattern**; regenerate `migrations/0001` from current schema |
| Big-bang repo restructure in one PR | "Clean break" | Unreviewable diff; breaks `@/` paths, CI, and bisect | MOD-01 module-by-module moves with re-exports; keep `app/` routes stable until cutover |
| Dual migration paths (boot DDL **and** external job) | Transitional safety | Two writers race; ambiguous source of truth | DATA-01 removes boot migrate entirely after cutover |
| Full Kysely rewrite in single phase | "Done with ENF-02" | High regression risk across 40+ repos | Incremental repo migration; Vitest gate per repo |
| New product features beyond deferred list | Stakeholder asks | Scope creep; v2.0 spec already shipped at API | v2.1 closes debt only; new PR-IDs → future milestone |
| UI-only authorization on new pages | Faster UI | AUTH-05 violation; bank ATTT failure | Server gates unchanged; UI mirrors API errors |
| Second ORM / Prisma / Drizzle schema-first | "Modern stack" | Conflicts with Kysely-over-pool decision; duplicate migration ownership | Kysely query builder only; SQL migrations via DATA-02 |
| Replacing Jira / AI / export | Simplification | Core differentiators per PROJECT.md Out of Scope | Keep integrations; thin routes only |
| Physical DELETE for governed entities | "Clean database" | Violates spec immutability (weekly versions, audit, soft-end dependencies) | Existing soft-delete / deactivate patterns |
| Running migrations inside every pod without leader lock | Simplicity | Replica race on DDL (documented K8s anti-pattern) | External Job or leader-elected advisory lock if ever co-located |
| Collapsing v1 `budget_items` without migration plan | Single budget model | Breaks existing portfolio budget pages and tests | NIT-02: document coexistence or staged deprecation with UI routing |

---

## Feature Dependencies

```
DATA-01..03 (external migrate, versioned SQL)
    └──requires──> stable baseline from current lib/db.ts (regenerate, not merge branch)
    └──enables──> PERF-03 meaningful cold-start budget
    └──enables──> ENF-02 kysely-codegen types matching production schema

ENF-02 (Kysely)
    └──requires──> repos remain SQL home; DATA-02 schema stable
    └──parallel──> MOD-01 (can migrate repos inside module backend dirs)

ENF-01 (wrapper CI)
    └──parallel──> THIN-01 (new service routes must still pass wrapper gate)

MOD-01 (module split)
    └──should precede or interleave──> UI-DASH / UI-WEEK / UI-DOC / UI-AUDIT (greenfield UI lands in module ui/)
    └──must not break──> app/api route paths, @/ imports

THIN-01 + PROXY-01 + JIRA-01
    └──parallel──> no product API dependency

UI-DASH ──requires──> /api/dashboards/* (shipped)
UI-WEEK ──requires──> /api/weekly-periods/*, /api/projects/[id]/weekly-reports/* (shipped)
UI-DOC  ──requires──> document-catalog, templates, checklist, compliance APIs (shipped)
UI-AUDIT ──requires──> GET /api/audit (shipped)

UI-WEEK ──enhanced by──> PERF-01 (tracking grid virtualization)
UI-DASH / UI-WEEK / UI-DOC / UI-AUDIT ──enhanced by──> PERF-02 (RSC chrome)

NIT-01 ──depends on──> decision: wire listOpenProjectDependencies into UI-DASH or delete
NIT-02 ──depends on──> UI-DASH (fiscal KPI question)
NYQ-01 ──parallel──> all phases (validation hygiene)

HYG-02 ──blocks nothing──> operator checkpoint only
```

### Dependency Notes

- **DATA before PERF-03:** Cold-start budget is meaningless while `getDb()` still runs DDL.
- **MOD-01 vs UI consumers:** New v2 pages should land in module `ui/` dirs from day one; retrofitting avoids double moves.
- **UI depends on existing APIs:** No new backend requirements for UI-DASH/WEEK/DOC/AUDIT unless audit finds gaps — consume shipped routes.
- **Kysely depends on repos:** Services must not import Kysely; column allowlists migrate from string arrays to typed selects.
- **ENF-01 depends on wrapper inventory:** Document D-23 exemptions before rule lands.

---

## MVP Definition

### v2.1 Launch With (must ship)

- [ ] **DATA-01..03** — External migrate job; app connects only; versioned SQL; one-off data-fix scripts
- [ ] **UI-DASH + UI-WEEK + UI-DOC + UI-AUDIT** — React consumers for spec APIs (product completeness)
- [ ] **THIN-01 + PROXY-01 + JIRA-01** — Close v1 route debt
- [ ] **ENF-01** — Wrapper CI gate on project-scoped routes
- [ ] **MOD-01** — Repo-wide backend/UI split (every feature area)

### Should Ship (high value, sequenced)

- [ ] **PERF-01** — Virtualized CPMO tracking and other large grids
- [ ] **PERF-02** — RSC static chrome on new v2 pages
- [ ] **ENF-02** — Kysely in repositories (incremental)
- [ ] **PERF-03** — Cold-start budget after DATA-01
- [ ] **NIT-01 + NIT-02** — Orphan exports, audit noise, budget coexistence doc
- [ ] **NYQ-01** — validate-phase reconciliation

### Operator Gate (not a feature checkbox)

- [ ] **HYG-02** — Operator confirms 502 behavior; no code change unless rejected

### Explicitly Out of v2.1

- New PR-01..15 product behavior (already shipped)
- Replacing Jira / AI / export
- Merging DATA branch as-is
- Second ORM or Postgres swap

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UI-WEEK (weekly surfaces) | HIGH | VERY HIGH | P1 |
| UI-DASH (portfolio + PM dashboards) | HIGH | HIGH | P1 |
| DATA-01..03 (migrate out of boot) | HIGH (ops/reliability) | HIGH | P1 |
| MOD-01 (module backend/UI split) | MEDIUM (maintainability) | HIGH | P1 |
| THIN-01 (service-layer completion) | MEDIUM (security/consistency) | MEDIUM | P1 |
| UI-DOC (checklist/compliance) | HIGH | HIGH | P1 |
| UI-AUDIT (audit viewer) | MEDIUM–HIGH (bank) | MEDIUM | P1 |
| ENF-01 (wrapper CI) | HIGH (security) | MEDIUM | P1 |
| PROXY-01 (JSON 401) | MEDIUM | LOW | P1 |
| PERF-01 (virtualized grids) | HIGH (CPMO UX) | MEDIUM | P2 |
| ENF-02 (Kysely) | MEDIUM (DX/safety) | HIGH | P2 |
| PERF-02 (RSC chrome) | MEDIUM | MEDIUM | P2 |
| JIRA-01 (search hygiene) | LOW | LOW | P2 |
| NIT-01..02 (orphans, audit noise) | LOW | LOW | P2 |
| PERF-03 (cold-start budget) | MEDIUM (ops) | LOW | P2 |
| NYQ-01 (validate-phase) | LOW (process) | MEDIUM | P2 |
| HYG-02 (operator checkpoint) | N/A | LOW | Gate |

**Priority key:** P1 = milestone must close debt; P2 = should ship in v2.1 if capacity allows; Gate = operator confirmation, not feature work.

---

## REQUIREMENTS.md Category Grouping (for orchestrator)

| Category | IDs | Rationale |
|----------|-----|-----------|
| **Structure** | MOD-01 | Repo-wide module layout; enables clean UI landing zones |
| **Data** | DATA-01, DATA-02, DATA-03 | Single phased task; external migrate + SQL files + data-fix scripts |
| **Enforcement** | ENF-01, ENF-02 | CI wrapper gate; Kysely adoption in repos |
| **Performance** | PERF-01, PERF-02, PERF-03 | Grid virtualization, RSC chrome, cold-start SLO |
| **Route debt** | THIN-01, PROXY-01, JIRA-01 | Service thinning, API 401 contract, Jira hygiene |
| **UI surfaces** | UI-DASH, UI-WEEK, UI-DOC, UI-AUDIT | v2 API consumers; product-complete spec workflows |
| **Nits & validation** | NIT-01, NIT-02, NYQ-01 | Orphan wiring, fiscal/audit/budget cleanup, Nyquist pass |
| **Operator gate** | HYG-02 | **Not a feature category** — checkpoint in PLAN/VERIFICATION only |

---

## Table Stakes Summary (v2.1)

1. **UI consumers** for dashboards, weekly workflow, document checklist, audit viewer — APIs alone are insufficient for product use
2. **External migrations** — app start connects; deploy pipeline owns schema
3. **Module backend/UI split** — whole repo, not only new screens
4. **Route debt closure** — services for ops/admin/config/import; JSON 401; Jira hygiene
5. **Wrapper CI enforcement** — no new unwrapped project-scoped routes
6. **Virtualized grids** — CPMO tracking at enterprise row counts

---

## Sources

- `.planning/PROJECT.md` — v2.1 Active requirements (HIGH)
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md` — tech_debt inventory, UI deferred (HIGH)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — SVC-01/ROUTE-05/PROXY/Jira leftovers (HIGH)
- `.planning/milestones/v2.0-REQUIREMENTS.md` — Future Requirements DATA/ENF/PERF (HIGH)
- Next.js enterprise module patterns — thin `app/`, `features/` or `modules/` with backend/UI split (MEDIUM)
- Brownfield migration practice — decouple schema from app startup; external Job/CLI (MEDIUM)
- Kysely brownfield fit — query builder over existing schema, external migrations (MEDIUM)

---
*Feature research for: v2.1 Hardening & Deferred Debt*
*Researched: 2026-08-28*
