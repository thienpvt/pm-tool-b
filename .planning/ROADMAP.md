# Roadmap: PM Tool B

## Overview

v1.0 shipped the layer reorg (route → service → repository), tenant wrappers, integration clients, and god-page splits. v2.0 brought that stack into compliance with the GuiIT Portfolio One View spec: CPMO / PM / Viewer authorization, L0–L5 project master, RAID and milestones as masters with immutable weekly snapshots, CPMO period cadence, portfolio/PM dashboard APIs, Confluence document checklists, and a company-scoped append-only audit log — without replacing Jira import, AI reports, or Excel/PPT/Word export.

v2.1 closes leftover debt on that stack: one external migration cutover, leftover route/API hygiene, React consumers for the v2 APIs (landed in per-module `ui/`), a repo-wide backend/UI split, Kysely on the existing pool, performance budgets, and a nits/Nyquist/operator closeout. Phase numbering continues from v2.0 (Phases 9–18). v2.1 is Phases 19–27. Granularity is `standard`; nine phases (not twelve) because DATA-01..03 stay one migration task, leftover route debt clusters, and nits/Nyquist/HYG-02 close out together.

## Milestones

- ✅ **v1.0 Layer Reorg & Hardening** — Phases 1–8 (shipped 2026-08-25)
- ✅ **v2.0 Portfolio One View** — Phases 9–18 (shipped 2026-08-26)
- 🚧 **v2.1 Hardening & Deferred Debt** — Phases 19–27 (planning)

## Phases

<details>
<summary>✅ v1.0 Layer Reorg & Hardening (Phases 1–8) — SHIPPED 2026-08-25</summary>

- [x] Phase 1: Test Harness (1/1 plans) — completed 2026-08-07
- [x] Phase 2: Repository Layer (3/3 plans) — completed 2026-08-10
- [x] Phase 3: Integration Clients (4/4 plans) — completed 2026-08-10
- [x] Phase 4: Service Layer (7/7 plans) — completed 2026-08-11
- [x] Phase 5: Route Thinning & Validation (3/3 plans) — completed 2026-08-11
- [x] Phase 6: Access Enforcement Rollout (7/7 plans) — completed 2026-08-25
- [x] Phase 7: UI Decomposition (9/9 plans) — completed 2026-08-25
- [x] Phase 8: INTG-08 Credential Cutover (1/1 plans) — completed 2026-08-25

Full phase detail: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements archive: [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.0 Portfolio One View (Phases 9–18) — SHIPPED 2026-08-26</summary>

- [x] Phase 9: Mapping Table Tenant Isolation (3/3 plans) — completed 2026-08-26
- [x] Phase 10: Users, Roles & Server Authorization (11/11 plans) — completed 2026-08-26
- [x] Phase 11: Project Master, PM Assignment & Stakeholders (5/5 plans) — completed 2026-08-26
- [x] Phase 12: Milestone & RAID Master Registers (3/3 plans) — completed 2026-08-26
- [x] Phase 13: Weekly Periods & PM Submit (3/3 plans) — completed 2026-08-26
- [x] Phase 14: CPMO Tracking & Consolidated Export (3/3 plans) — completed 2026-08-26
- [x] Phase 15: Budget, Value, ROI & Dependencies (3/3 plans) — completed 2026-08-26
- [x] Phase 16: Portfolio & PM Dashboards (3/3 plans) — completed 2026-08-26
- [x] Phase 17: Document Templates & Confluence Checklist (3/3 plans) — completed 2026-08-26
- [x] Phase 18: Append-Only Audit Log (3/3 plans) — completed 2026-08-26

Full phase detail: [.planning/milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md)
Requirements archive: [.planning/milestones/v2.0-REQUIREMENTS.md](milestones/v2.0-REQUIREMENTS.md)
Audit: [.planning/milestones/v2.0-MILESTONE-AUDIT.md](milestones/v2.0-MILESTONE-AUDIT.md) (`tech_debt`, 79/79 requirements)
Phase artifacts: [.planning/milestones/v2.0-phases/](milestones/v2.0-phases/)

</details>

- [x] **Phase 19: Data Layer Cutover** - External versioned SQL migrate; app start connects and seeds only (completed 2026-08-28)
- [x] **Phase 20: API Contract & Leftover Routes** - JSON 401, Jira hygiene, wrapper CI gate, ops/admin/config through services (completed 2026-08-28)
- [x] **Phase 21: Portfolio & PM Dashboard Pages** - CPMO and assigned-PM dashboards in module UI, with the fiscal-KPI call (completed 2026-08-28)
- [x] **Phase 22: Weekly Workflow Surfaces** - Periods, PM submit/correct, CPMO tracking/export; tracking grid virtualized (completed 2026-08-28)
- [x] **Phase 23: Document Checklist & Audit Viewer** - Catalog, Confluence checklist, compliance, company-scoped audit UI (completed 2026-08-28)
- [ ] **Phase 24: Repo-wide Module Split** - Every remaining feature area in `modules/<feature>/{backend,ui}` with thin `app/` re-exports
- [ ] **Phase 25: Kysely Repositories** - Repositories query through Kysely on the existing pool
- [ ] **Phase 26: RSC Chrome & Cold Start** - Server Component chrome on v2 pages; measured post-migrate cold-start budget
- [ ] **Phase 27: Nits, Validation & Operator Gate** - Orphan exports, audit noise, budget coexistence, Nyquist closeout, HYG-02 confirm

## Phase Details

### Phase 19: Data Layer Cutover

**Goal**: Schema evolution is an external migrate job; a running app no longer initializes or mutates schema on cold start
**Depends on**: Phase 18 (v2.0 shipped)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):

  1. After migrate has run, app start connects, asserts the ledger, and seeds only — `getDb()` does not create schema or run the migrate loop
  2. Schema changes ship as versioned SQL applied by `npm run migrate` with a checksum ledger; `migrations/0001` is regenerated from current v2.0 schema (weekly, fiscal, roles, RAID master, dashboard, checklist, and audit tables included)
  3. Data-fix `UPDATE`s that used to run as boot-time migrations live as one-off scripts under `scripts/data-fixes/` and are not re-run on every process start
  4. A brownfield database can be stamped onto the ledger without dropping v2.0 tables — the origin `gsd/quick-260826-ded-data-layer-migrations` branch is a runner/ledger pattern only and is never merged as-is

**Plans:** 4/4 plans complete

Plans:
**Wave 1**

- [x] 19-01-PLAN.md — Checksum ledger migrate engine, assertMigrated, tsx CLI

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02-PLAN.md — Regenerated v2.0 migrations/0001 + operator README
- [x] 19-03-PLAN.md — Operator data-fix scripts under scripts/data-fixes/

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-04-PLAN.md — Slim getDb; Docker/CI/Railway migrate before start

### Phase 20: API Contract & Leftover Routes

**Goal**: Unauthenticated API callers get JSON, leftover ops/admin/config/import-mapping routes go through services, and project-scoped handlers cannot ship unwrapped
**Depends on**: Phase 19
**Requirements**: PROXY-01, JIRA-01, ENF-01, THIN-01
**Success Criteria** (what must be TRUE):

  1. An unauthenticated request to `/api/*` receives JSON `{ error: 'Unauthorized' }` with status 401; an unauthenticated page request still redirects to login
  2. Jira search does not log issue custom fields and returns 400 for a malformed JSON body
  3. CI fails when a project-scoped `route.ts` exports a handler not wrapped by a sanctioned helper (`withAuth` / `withProjectAccess` / `withProgramAccess` / `withCpmo` / `withRole`); D-23 exemptions are an explicit list
  4. Ops, admin, config, and import-mapping routes call services rather than repositories; D-23 session+tenant vs platform break-glass semantics stay

**Plans:** 7/7 plans complete

Plans:
**Wave 1**

- [x] 20-01-PLAN.md — Proxy JSON 401 for unauthenticated `/api/*`
- [x] 20-02-PLAN.md — Jira search hygiene (Invalid JSON 400, no field dump)
- [x] 20-03-PLAN.md — ESLint wrapper gate, allowlist, CI `npm run lint`
- [x] 20-04-PLAN.md — Operations systems collection/`[id]` through service
- [x] 20-06-PLAN.md — Admin-platform service (companies, demo-requests, resource-audit)
- [x] 20-07-PLAN.md — Settings/jira-config/rag-config services + import-mapping verify

**Wave 2** *(blocked on 20-04)*

- [x] 20-05-PLAN.md — Nested operations budget/expense/incident routes through service

### Phase 21: Portfolio & PM Dashboard Pages

**Goal**: CPMO and assigned PMs open spec dashboards in the product UI (pages land in `modules/dashboards/ui/`)
**Depends on**: Phase 20
**Requirements**: PDSH-07, MDSH-06, NIT-04
**Success Criteria** (what must be TRUE):

  1. CPMO can open a portfolio dashboard page with spec KPIs, AND filters, drill-downs, and export
  2. An assigned PM can open a PM dashboard page with weekly, milestone, and RAID action queues and deep links
  3. Fiscal KPIs appear on the portfolio dashboard only if they belong in the spec KPI set; otherwise they stay omitted with that decision recorded

**Plans:** 4/4 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 21-01-PLAN.md — Vitest glob, tracer Spec dashboard KPIs, Sidebar NAV, NIT-04 omission

**Wave 2** *(blocked on Wave 1)*

- [x] 21-02-PLAN.md — Portfolio AND filters, persist, 401/403/loading
- [x] 21-04-PLAN.md — PM dashboard queues, filters, deep links

**Wave 3** *(blocked on 21-01 and 21-02)*

- [x] 21-03-PLAN.md — Charts, drill-downs, project list, export

### Phase 22: Weekly Workflow Surfaces

**Goal**: CPMO and PMs run the weekly cadence in the UI, and the tracking grid stays usable at enterprise row counts
**Depends on**: Phase 21
**Requirements**: PERD-04, WKRP-07, CPMO-05, PERF-01
**Success Criteria** (what must be TRUE):

  1. CPMO can create and manage weekly periods in the UI
  2. A PM with write access can draft, submit, and correct a weekly report in the UI
  3. CPMO can track period submissions and export the consolidated pack from the UI
  4. Large grids (CPMO weekly tracking, and other long lists in this surface) virtualize rows so the page stays usable past ~100 rows

**Plans:** 5/5 plans complete

Plans:
**Wave 1**

- [x] 22-01-PLAN.md — Tracer: VirtualRows, Sidebar weekly links, periods list shell

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02-PLAN.md — Period create and company weekly config
- [x] 22-03-PLAN.md — Tracking grid, filters, counts, period query
- [x] 22-05-PLAN.md — PM editor plus Phase 16 path re-export

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-04-PLAN.md — Export pack toolbar and blob download

**UI hint**: yes

### Phase 23: Document Checklist & Audit Viewer

**Goal**: CPMO and PMs complete document-catalog and Confluence-checklist work in the UI; CPMO can inspect the company audit trail
**Depends on**: Phase 22
**Requirements**: DOC-07, DOC-08, DOC-09, AUDIT-02
**Success Criteria** (what must be TRUE):

  1. CPMO can manage the document catalog and URL-only templates in the UI
  2. A PM can complete a project's Confluence checklist in the UI (HTTPS link; Approved or Not applicable)
  3. CPMO can view document compliance in the UI
  4. CPMO can view the company-scoped audit log in the UI with filters and before/after snapshots

**Plans:** 5/5 plans complete
**UI hint**: yes

Plans:
**Wave 1**

- [x] 23-01-PLAN.md — Tracer: catalog list/shell plus Sidebar catalog/compliance/audit links

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 23-02-PLAN.md — Catalog create/edit/retire plus URL-only templates panel
- [x] 23-03-PLAN.md — PM Confluence checklist plus project hub card
- [x] 23-04-PLAN.md — CPMO document compliance page
- [x] 23-05-PLAN.md — CPMO audit viewer plus VirtualRows

### Phase 24: Repo-wide Module Split

**Goal**: Every existing feature area — not only the new v2 screens — keeps backend and UI in separate module directories, and old URLs still resolve
**Depends on**: Phase 23
**Requirements**: MOD-01, MOD-02
**Success Criteria** (what must be TRUE):

  1. Each feature area in the repo (portfolio, projects, admin, operations, reports, Jira/import, dashboards, weekly, documents, audit) has backend (routes, services, repos) and UI (pages, hooks, components) in separate directories under that module
  2. Existing page and `/api/*` URLs keep working after the split via thin `app/` re-exports

**Plans:** 1/10 plans executed
**UI hint**: yes

Plans:
**Wave 1**

- [x] 24-01-PLAN.md — Dashboards backend tracer (P1/P2/P6/S1/S2)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 24-02-PLAN.md — Audit backend split

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 24-03-PLAN.md — Weekly backend plus P3 wrapper-stays

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 24-04-PLAN.md — Documents backend plus checklist P3

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 24-05-PLAN.md — Portfolio UI/backend (except /portfolio/report)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 24-06-PLAN.md — Projects UI/backend (except weekly, checklist, reports)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 24-07-PLAN.md — Reports module including D-11 /portfolio/report

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 24-08-PLAN.md — Jira/import dialogs and APIs

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 24-09-PLAN.md — Admin module plus D-07 companies

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 24-10-PLAN.md — Operations module plus D-07 sweep

**Cross-cutting constraints:**

- No new npm dependency is added (D-08).

### Phase 25: Kysely Repositories

**Goal**: Invalid column names fail at compile time while runtime mass-assignment protection stays
**Depends on**: Phase 24
**Requirements**: ENF-02
**Success Criteria** (what must be TRUE):

  1. Repository queries go through Kysely on the existing `pg.Pool` — referencing a column that is not on the table fails TypeScript compile
  2. Runtime mass-assignment tests still reject extra fields; allowlists are not abandoned
  3. The app still uses a single connection pool (no second ORM and no second pool)

**Plans**: TBD

### Phase 26: RSC Chrome & Cold Start

**Goal**: v2 page chrome is server-rendered, and cold-start connect time has a recorded budget now that migrate is off the request path
**Depends on**: Phase 25
**Requirements**: PERF-02, PERF-03
**Success Criteria** (what must be TRUE):

  1. Static chrome (layout, nav, KPI shells) on v2 pages renders as Server Components
  2. Cold-start connect time is measured and has a recorded budget after the migrate cutover

**Plans**: TBD
**UI hint**: yes

### Phase 27: Nits, Validation & Operator Gate

**Goal**: Leftover nits are resolved, every v2.1 phase has a reconciled validation file, and the operator has confirmed the Anthropic 502 behavior
**Depends on**: Phase 26
**Requirements**: NIT-01, NIT-02, NIT-03, NYQ-01, HYG-02
**Success Criteria** (what must be TRUE):

  1. `listPeriodShells` and `listOpenProjectDependencies` are either consumed by a dashboard/service or removed
  2. A no-op milestone PATCH (before equals after) does not append an audit row
  3. v1 `budget_items` vs fiscal ledger coexistence is documented, or the UI routes budget screens to the fiscal API
  4. Operator confirms Anthropic malformed-output 502 (vs the old 500) is acceptable for the three report routes; no code change unless the confirm is rejected
  5. Each v2.1 phase (19+) has a reconciled (non-draft) `VALIDATION.md`; archived v1.0/v2.0 validation files are not rewritten

**Plans**: TBD
**UI hint**: yes

## Progress

v1.0 Phases 1–8 and v2.0 Phases 9–18 are complete (see milestone archives above).

**Execution Order:** 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 19. Data Layer Cutover | 4/4 | Complete    | 2026-08-28 |
| 20. API Contract & Leftover Routes | 7/7 | Complete    | 2026-08-28 |
| 21. Portfolio & PM Dashboard Pages | 4/4 | Complete    | 2026-08-28 |
| 22. Weekly Workflow Surfaces | 5/5 | Complete    | 2026-08-28 |
| 23. Document Checklist & Audit Viewer | 5/5 | Complete    | 2026-08-28 |
| 24. Repo-wide Module Split | 1/10 | In Progress|  |
| 25. Kysely Repositories | 0/TBD | Not started | - |
| 26. RSC Chrome & Cold Start | 0/TBD | Not started | - |
| 27. Nits, Validation & Operator Gate | 0/TBD | Not started | - |
