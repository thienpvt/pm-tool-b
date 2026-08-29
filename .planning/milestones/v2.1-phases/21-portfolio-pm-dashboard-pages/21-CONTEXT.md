# Phase 21: Portfolio & PM Dashboard Pages - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

CPMO and assigned PMs open spec dashboards in the product UI. Pages land in `modules/dashboards/ui/`. Fiscal KPIs appear on the portfolio dashboard only if they belong in the spec KPI set; otherwise they stay omitted with that decision recorded.

**Requirements:** PDSH-07, MDSH-06, NIT-04

**In:**
- React pages that consume existing `/api/dashboards/portfolio` (GET, filters, export) and `/api/dashboards/pm` (GET, filters)
- Spec KPI tiles, AND filters, drill-downs matching tiles, xlsx/pdf export (PDSH-07)
- PM weekly / milestone / RAID action queues with existing `href` deep links (MDSH-06)
- NIT-04 recorded: omit fiscal KPIs from the spec portfolio dashboard
- Sidebar entries so CPMO/PM can open the pages
- Vitest component/hook tests as the automated gate; UI-SPEC is required (`workflow.ui_phase=true`)

**Out:**
- Rewriting Phase 16 APIs, KPI formulas, or filter persistence (D-01..D-16 stay)
- Replacing v1 `/` portfolio home, `/api/portfolio`, or `/portfolio/budget`
- Module-wide backend/UI split of other features (Phase 24)
- Weekly period UI (Phase 22), document checklist / audit viewer (Phase 23)
- Virtualizing large grids (PERF-01 is Phase 22)
- New npm packages, CASL, D-23 re-gate

</domain>

<decisions>
## Implementation Decisions

### Routes and module layout
- **D-01:** Implement page trees under `modules/dashboards/ui/` (portfolio + PM). Thin App Router re-exports at `app/dashboards/portfolio/page.tsx` and `app/dashboards/pm/page.tsx` (`'use client'` re-export of the module page). Do not wait for Phase 24 to move existing API/service files.
- **D-02:** URLs are `/dashboards/portfolio` and `/dashboards/pm`. Do **not** reuse `/dashboard` (existing per-project dashboard) or overwrite `/`.
- **D-03:** Add Sidebar NAV links: "Spec dashboard" → `/dashboards/portfolio` (visible when `roles` includes `cpmo`); "My dashboard" → `/dashboards/pm` (visible when `roles` includes `pm` or `cpmo`). Keep v1 Portfolio `/` and Project Dashboard `/dashboard` as they are.
- **D-04:** Consume existing APIs only. No new dashboard endpoints. No changes to `computePortfolioKpis` / `getPortfolioDashboard` / `getPmDashboard` except if a UI-only type export is needed.

### Portfolio page (PDSH-07)
- **D-05:** One GET `/api/dashboards/portfolio` loads `filters`, `kpis`, `charts`, `list`, `drilldowns`. Render KPI tiles (active, on-track, watch/act, overdue-milestone project count, High open RAID, technology-council), stage + RAG charts, filtered project list, and drill-down tables from that payload.
- **D-06:** Filter chrome binds to the existing AND keys (`portfolio_year`, `program`, `unit`, `pm_user_id`, `stage`, `status`, `rag`, `type`, `weekly_report_enabled`). Persist via existing GET/PUT/POST `/api/dashboards/portfolio/filters` (clear/defaults). Changing filters refetches the dashboard GET.
- **D-07:** Tile click opens the matching `drilldowns` list (overdue_milestones, high_raid, technology_council). List rows deep-link to existing project/milestone/RAID screens when an id is present.
- **D-08:** Export buttons call existing POST `/api/dashboards/portfolio/export` with `format: 'xlsx' | 'pdf'` and download the blob. Do not add a client-side Excel/PDF library.
- **D-09:** Portfolio page is CPMO-only. Non-CPMO 403 from the API → show existing forbidden/empty pattern (do not invent a second authz layer). Viewer never sees the NAV link.

### PM page (MDSH-06)
- **D-10:** GET `/api/dashboards/pm` loads assigned projects plus `actions.weekly|milestones|raid` (or the shipped JSON shape). Render three queues; each row uses the server-provided `href` (weekly report, `/projects/:id/milestones`, RAID). Do not invent new mutator pages.
- **D-11:** Completing an action is the existing destination page. Returning to the dashboard refetches GET (live, no cache) so resolved rows drop (MDSH-05 already on the API).
- **D-12:** CPMO visiting `/dashboards/pm` still sees only their own assignment window (API D-09). Viewer 403.
- **D-13:** PM filters use existing `/api/dashboards/pm/filters` with the same AND keys as portfolio, scoped to assigned projects.

### NIT-04 fiscal KPIs
- **D-14:** **Omit** fiscal budget / ROI / benefit KPIs from the spec portfolio dashboard. Phase 16 D-14 already excluded `computeFiscalBudgetMetrics` from spec tiles. Record this in UI-SPEC and a short comment in the portfolio page module: fiscal numbers live on `/portfolio/budget`, not on spec KPIs.
- **D-15:** Do not add fiscal fields to `PortfolioKpis`. Do not embed `/api/portfolio/budgets` on this page.

### Auth, chrome, testing
- **D-16:** Reuse `Sidebar`, shadcn `Card`/`Button`/`Badge`/`Table` (or existing table markup), `sonner` toasts. Match current density (compact, Vietnamese+English labels as neighboring pages do).
- **D-17:** `workflow.ui_phase` is true — UI-SPEC is a planning gate. Automated tests: hook/component tests with mocked `fetch` for 200/401/403, filter persist, export POST, and fiscal-KPI omission (no budget numbers in the spec KPI row).

### Claude's Discretion
- Chart library: prefer existing in-repo chart usage; if none, CSS/simple bars from `charts.by_stage` / `charts.by_rag` counts — do not `npm install` a chart package.
- Exact file split inside `modules/dashboards/ui/` (hooks vs components).
- Empty/loading/error copy.
- Whether NAV labels are Vietnamese, English, or bilingual — match Sidebar neighbors (`Portfolio` is English today).
</decisions>

<canonical_refs>
## Canonical References

### Phase scope
- `.planning/ROADMAP.md` — Phase 21 goal, success criteria, UI hint yes
- `.planning/REQUIREMENTS.md` — PDSH-07, MDSH-06, NIT-04
- `.planning/PROJECT.md` — UI-DASH, PR-13/PR-14 already validated as APIs in Phase 16

### Locked prior decisions
- `.planning/milestones/v2.0-phases/16-portfolio-pm-dashboards/16-CONTEXT.md` — D-01..D-16 KPI, filter, export, PM assignment, no fiscal tiles
- `.planning/milestones/v2.0-phases/16-portfolio-pm-dashboards/16-PATTERNS.md` — API analogs
- `lib/services/spec-dashboards.service.ts` — payload contract
- `lib/dashboards/kpi.ts` — `PortfolioKpis` (no fiscal fields)
- `app/api/dashboards/portfolio/route.ts` — `withCpmo`
- `app/api/dashboards/pm/route.ts` — `withAuth` + pm|cpmo
- `components/layout/Sidebar.tsx` — NAV / PROJECT_NAV
- `.planning/phases/20-api-contract-leftover-routes/20-CONTEXT.md` — ENF-01 wrappers already on these routes
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getPortfolioDashboard` / `getPmDashboard` — one GET returns tiles + list + drilldowns / action queues
- Filter routes + `dashboard_filter_state` — already persist per user+surface
- `exportPortfolioDashboard` — xlsx/pdf already implemented
- `Sidebar` — role-aware NAV (`is_admin` / `roles.includes('cpmo')`)
- shadcn in `components/ui/*`, `toast` from sonner
- `app/usePortfolioDashboard.ts` — v1 `/api/portfolio` hook; **do not reuse for spec dashboards** (wrong API)
- `app/projects/[id]/dashboard/page.tsx` — per-project dashboard; do not conflate with spec CPMO/PM surfaces

### Established Patterns
- Client pages: `'use client'` + `fetch` + `useEffect` (most app pages)
- CPMO gates: API `withCpmo`; UI hides NAV rather than duplicating policy
- Deep links are strings on JSON rows (Phase 16 D-13) — UI just renders `<Link href={row.href}>`

### Integration Points
- App Router needs a file under `app/` — hence thin re-exports from `modules/dashboards/ui/`
- `tsconfig` `@/*` maps to repo root, so `@/modules/dashboards/ui/...` works without extra config
</code_context>

<specifics>
## Specific Ideas

- Grey areas auto-accepted: module+re-export layout, `/dashboards/*` URLs, consume Phase 16 APIs as-is, omit fiscal KPIs (NIT-04), no new packages.
- Phase 16 D-13 said thin pages were optional because `ui_phase` was false then. This phase makes the pages the success criterion.
</specifics>

<deferred>
## Deferred Ideas

- Repo-wide `modules/<feature>/{backend,ui}` for other areas — Phase 24
- Weekly period / report UI — Phase 22
- Document checklist and audit viewer — Phase 23
- Grid virtualization — PERF-01 / Phase 22
</deferred>
