# Requirements: PM Tool B — Hardening & Deferred Debt (v2.1)

**Defined:** 2026-08-28
**Core Value:** One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.

## v2.1 Requirements

Requirements for this milestone. Each maps to roadmap phases. v2.0 spec APIs (PR-01..PR-15, AUDIT-01) stay shipped — they are not restated unless this milestone adds a UI consumer or a hardening gate.

DATA-01..03 is **one migration task** (replay origin `gsd/quick-260826-ded-data-layer-migrations` as a pattern; regenerate baseline from current schema; do not merge that branch as-is).

### Repo structure

- [x] **MOD-01**: Each feature area in the repo (portfolio, projects, admin, operations, reports, Jira/import, dashboards, weekly, documents, audit — not only new v2 screens) has backend (routes, services, repos) and UI (pages, hooks, components) in separate directories under that module
- [x] **MOD-02**: Existing page and `/api/*` URLs keep working after the split via thin `app/` re-exports

### Data layer (single task)

- [x] **DATA-01**: App start connects, guards, and seeds only — schema init and the migrate loop are not in `getDb()`
- [x] **DATA-02**: Schema changes ship as versioned SQL files applied by `npm run migrate` with a checksum ledger; `migrations/0001` is regenerated from current v2.0 schema (weekly, fiscal, roles, RAID master, dashboard, checklist, audit tables included)
- [x] **DATA-03**: Data-fix `UPDATE`s that currently run as boot-time migrations move to one-off scripts under `scripts/data-fixes/`

### Enforcement

- [x] **ENF-01**: CI fails when a project-scoped `route.ts` exports a handler not wrapped by a sanctioned helper (`withAuth` / `withProjectAccess` / `withProgramAccess` / `withCpmo` / `withRole`); D-23 exemptions are an explicit list
- [x] **ENF-02**: Repository queries go through Kysely on the existing `pg.Pool` so invalid columns fail at compile time; runtime mass-assignment tests stay

### Performance

- [x] **PERF-01**: Large grids (CPMO weekly tracking, long lists, audit) virtualize rows so the page stays usable past ~100 rows
- [x] **PERF-02**: Static chrome (layout, nav, KPI shells) on v2 pages renders as Server Components
- [x] **PERF-03**: Cold-start connect time is measured and has a recorded budget after the migrate cutover

### Leftover route debt

- [x] **THIN-01**: Ops, admin, config, and import-mapping routes call services rather than repositories; D-23 session+tenant vs platform break-glass semantics stay
- [x] **PROXY-01**: An unauthenticated request to `/api/*` receives JSON `{ error: 'Unauthorized' }` with status 401; an unauthenticated page request still redirects to login
- [x] **JIRA-01**: Jira search does not log issue custom fields and returns 400 for a malformed JSON body

### v2 UI — dashboards

- [x] **PDSH-07**: CPMO can open a portfolio dashboard page with spec KPIs, AND filters, drill-downs, and export
- [x] **MDSH-06**: An assigned PM can open a PM dashboard page with weekly, milestone, and RAID action queues and deep links

### v2 UI — weekly

- [x] **PERD-04**: CPMO can create and manage weekly periods in the UI
- [x] **WKRP-07**: A PM with write access can draft, submit, and correct a weekly report in the UI
- [x] **CPMO-05**: CPMO can track period submissions and export the consolidated pack from the UI

### v2 UI — documents

- [x] **DOC-07**: CPMO can manage the document catalog and URL-only templates in the UI
- [x] **DOC-08**: A PM can complete a project's Confluence checklist in the UI (HTTPS link; Approved or Not applicable)
- [x] **DOC-09**: CPMO can view document compliance in the UI

### v2 UI — audit

- [x] **AUDIT-02**: CPMO can view the company-scoped audit log in the UI with filters and before/after snapshots

### Audit nits

- [x] **NIT-01**: `listPeriodShells` and `listOpenProjectDependencies` are either consumed by a dashboard/service or removed
- [x] **NIT-02**: A no-op milestone PATCH (before equals after) does not append an audit row
- [x] **NIT-03**: v1 `budget_items` vs fiscal ledger coexistence is documented, or the UI routes budget screens to the fiscal API
- [x] **NIT-04**: Fiscal KPIs appear on the portfolio dashboard only if they belong in the spec KPI set; otherwise they stay omitted with that decision recorded
- [x] **NYQ-01**: Each v2.1 phase ends with a reconciled (non-draft) `VALIDATION.md` for that phase

### Operator checkpoint

- [x] **HYG-02**: Operator confirms Anthropic malformed-output 502 (vs the old 500) is acceptable for the three report routes; no code change unless the confirm is rejected

## Future Requirements

None. This milestone closes the deferred pack from v1.0/v2.0. New product spec IDs belong in a later milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Merging `origin/gsd/quick-260826-ded-data-layer-migrations` as-is | v1.0-era baseline would drop v2.0 tables; replay runner pattern and regenerate SQL |
| Replacing Jira import, AI reports, or Excel/PPT/Word export | Keep shipped differentiators |
| In-app upload of project document binaries | Spec stores Confluence links only |
| Replacing Next.js / React / PostgreSQL | Stack is validated |
| Second ORM (Prisma / Drizzle) or a second connection pool | ENF-02 is Kysely on the existing `pg.Pool` |
| CASL / casbin | Three fixed roles; extend existing wrappers |
| New PR-01..PR-15 product behavior | Already shipped at the API gate in v2.0 |
| Committing the GuiIT Word spec | Local reference only |
| Rewriting archived v1.0/v2.0 VALIDATION.md files | NYQ-01 covers new v2.1 phases (19+) only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 19 | Complete |
| DATA-02 | Phase 19 | Complete |
| DATA-03 | Phase 19 | Complete |
| PROXY-01 | Phase 20 | Complete |
| JIRA-01 | Phase 20 | Complete |
| ENF-01 | Phase 20 | Complete |
| THIN-01 | Phase 20 | Complete |
| PDSH-07 | Phase 21 | Complete |
| MDSH-06 | Phase 21 | Complete |
| NIT-04 | Phase 21 | Complete |
| PERD-04 | Phase 22 | Complete |
| WKRP-07 | Phase 22 | Complete |
| CPMO-05 | Phase 22 | Complete |
| PERF-01 | Phase 22 | Complete |
| DOC-07 | Phase 23 | Complete |
| DOC-08 | Phase 23 | Complete |
| DOC-09 | Phase 23 | Complete |
| AUDIT-02 | Phase 23 | Complete |
| MOD-01 | Phase 24 | Complete |
| MOD-02 | Phase 24 | Complete |
| ENF-02 | Phase 25 | Complete |
| PERF-02 | Phase 26 | Complete |
| PERF-03 | Phase 26 | Complete |
| NIT-01 | Phase 27 | Complete |
| NIT-02 | Phase 27 | Complete |
| NIT-03 | Phase 27 | Complete |
| NYQ-01 | Phase 27 | Complete |
| HYG-02 | Phase 27 | Complete |

**Coverage:**

- v2.1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-08-28*
*Last updated: 2026-08-28 after roadmap (Phases 19–27)*
