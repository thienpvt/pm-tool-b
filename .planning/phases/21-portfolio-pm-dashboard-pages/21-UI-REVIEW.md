# Phase 21 — UI Review

**Audited:** 2026-08-28
**Baseline:** 21-UI-SPEC.md
**Screenshots:** not captured (no dev server on ports 3000, 5173, 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Contract strings largely exact; empty-state headings drift to `text-sm` instead of Heading role |
| 2. Visuals | 2/4 | Charts precede project list despite hierarchy guidance; export CTAs both outline |
| 3. Color | 3/4 | Accent usage disciplined; stage chart bars use undeclared `bg-blue-200` |
| 4. Typography | 3/4 | Four-size scale respected; empty/error headings inconsistently sized |
| 5. Spacing | 3/4 | Page shell and table density match; `space-y-1.5` off 4px scale |
| 6. Experience Design | 2/4 | Portfolio tables lack `overflow-x-auto`; otherwise strong state coverage |

**Overall: 16/24**

**Verdict:** Advisory pass — implementation is substantially aligned with 21-UI-SPEC.md. Fix horizontal scroll and export/hierarchy polish before treating as visually complete.

---

## Top 3 Priority Fixes

1. **Add `overflow-x-auto` wrappers to portfolio project list and drill-down tables** — On narrow viewports, eight-column project table and drill-down columns clip without horizontal scroll (PM queues already wrap correctly). Wrap `PortfolioProjectTable` and populated `PortfolioDrilldownTable` content in `<div className="overflow-x-auto">`.

2. **Style Export Excel as primary CTA** — UI-SPEC declares "Two outline/primary buttons" with accent reserved for export actions; both buttons currently use `variant="outline"`. Apply `className="bg-blue-600 hover:bg-blue-700"` (or default primary variant) to Export Excel; keep Export PDF as outline.

3. **Reconcile visual hierarchy for project list vs charts** — Page zones place charts before the project list, but hierarchy guidance ranks the project list above charts. Either move `PortfolioProjectTable` above `PortfolioCharts`, or add stronger section styling (e.g. `shadow-sm` on project list, muted chart cards) so the list reads as tertiary-in-importance but still scannable.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — Empty-state heading size drift**

PM queue empty headings use `text-sm font-semibold` (`PmActionQueues.tsx:54,119,180`) while UI-SPEC Heading role is `text-base font-semibold`. Copy strings match the contract exactly:

| Element | Spec | Implementation | Match |
|---------|------|----------------|-------|
| Portfolio title | Spec dashboard | `PortfolioDashboardPage.tsx:63` | ✅ |
| PM title | My dashboard | `PmDashboardPage.tsx:52` | ✅ |
| Apply / Clear / Reset | Apply filters / Clear filters / Reset defaults | Filter bars `:288-306` | ✅ |
| Queue actions | Open report / View milestone / View RAID | `PmActionQueues.tsx:89,150,211` | ✅ |
| Loading | Loading dashboard… | Both pages `:34-35` | ✅ |
| 401 / 403 / load errors | Contract strings | `ERROR_COPY` constants | ✅ |
| Export toasts | Export downloaded / Export failed — try again. | `usePortfolioSpecDashboard.ts:97-104` | ✅ |
| Filter save error | Couldn't save filters — try again. | Hooks `:64,80` | ✅ |
| NIT-04 footnote | Budget and fiscal metrics… | `PortfolioDashboardPage.tsx:103-105` | ✅ |

Portfolio list and drill-down empty copy match verbatim (`PortfolioProjectTable.tsx:56-59`, `PortfolioDrilldownTable.tsx:133-136`).

### Pillar 2: Visuals (2/4)

**WARNING — Hierarchy vs layout tension**

UI-SPEC focal-point guidance ranks KPI row → filter bar → **project list** → charts → drill-down, but `PortfolioDashboardPage.tsx:100-102` renders charts before the project list. KPI tiles correctly dominate with `text-3xl` numbers and `shadow-sm` (`PortfolioKpiTiles.tsx:42-63`).

**WARNING — Export button visual weight**

Both export buttons use `variant="outline"` (`PortfolioDashboardPage.tsx:69-84`). Spec expects a primary-accent Export Excel alongside an outline Export PDF.

**Pass — Sidebar NAV**

Role-gated links inserted after Portfolio Report, before Portfolio Budget (`Sidebar.tsx:161-191`). Labels "Spec dashboard" / "My dashboard" with `LayoutDashboard` / `ClipboardList` icons match contract.

**Pass — KPI drill-down affordance**

Clickable tiles use `cursor-pointer`, `ring-2 ring-blue-600` when selected, `aria-pressed`, and `aria-label` (`PortfolioKpiTiles.tsx:70-79`).

### Pillar 3: Color (3/4)

**WARNING — Undeclared stage bar color**

Stage chart bars use `bg-blue-200` (`PortfolioCharts.tsx:65`) while UI-SPEC reserves `blue-600` for accent CTAs/links/rings and assigns RAG semantic colors only to RAG charts/badges. Stage bars should use a neutral track fill (e.g. `bg-slate-200`) to preserve 60/30/10 balance.

**Pass — Accent discipline**

Accent `blue-600` appears on: Apply filters buttons, row links, KPI selection ring, loading spinner border — all declared usages. No hardcoded hex in dashboard modules.

**Pass — RAG semantics**

Badges use `bg-green-100 text-green-700`, `bg-amber-100 text-amber-700`, `bg-red-100 text-red-700` (`PortfolioProjectTable.tsx:15-18`, `PmActionQueues.tsx:82`). Overdue badge uses `bg-red-100 text-red-700`.

**Pass — NIT-04**

Six spec KPI tiles only; fiscal footnote is muted `text-xs text-muted-foreground`; component tests assert no budget/ROI/currency patterns.

### Pillar 4: Typography (3/4)

**Sizes in use:** `text-xs` (labels, table heads), `text-sm` (body, controls), `text-base` (page/section titles), `text-3xl` (KPI numbers) — matches declared four-size scale.

**Weights:** `font-semibold` on labels/headings/KPI numbers; body defaults to 400 — matches two-weight limit.

**WARNING — Inconsistent empty-state heading size**

Portfolio list empty heading uses `font-semibold text-slate-600` inside a `text-sm` cell (`PortfolioProjectTable.tsx:55-56`). PM queues use explicit `text-sm font-semibold` for empty headings. Spec Heading role is `text-base font-semibold` — promote empty headings to `text-base` for consistency.

### Pillar 5: Spacing (3/4)

**Pass — Page shell**

Both dashboards use `flex flex-col lg:flex-row min-h-screen bg-slate-50` with main `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` — matches spec.

**Pass — Component density**

Table heads `h-8 px-2 text-xs`, cells `p-2 text-sm`; filter controls `h-8`; KPI tiles `min-h-[72px]` with `gap-4` grid — aligned with compact admin density.

**WARNING — Off-scale filter label gap**

`FieldRow` uses `space-y-1.5` (6px) in both filter bars (`PortfolioFiltersBar.tsx:12`, `PmFiltersBar.tsx:12`). Declared scale uses 4px multiples; prefer `space-y-1` (4px) or `gap-1`.

**Acceptable arbitrary values**

`max-w-[200px]` truncate on name cells, `min-h-[72px]` on KPI tiles — both explicitly allowed by UI-SPEC.

### Pillar 6: Experience Design (2/4)

**WARNING — Missing horizontal scroll on portfolio tables**

UI-SPEC requires `overflow-x-auto` on portfolio project list and drill-down panel. PM queues wrap tables correctly (`PmActionQueues.tsx:51,116,177`), but `PortfolioProjectTable.tsx:37-90` and populated `PortfolioDrilldownTable.tsx:139-165` render `<Table>` without a scroll wrapper.

**Pass — Loading / error / empty coverage**

- Centered spinner + "Loading dashboard…" on initial GET (both pages)
- 401/403/500 mapped to contract error strings with muted icon
- All six empty-state pairs implemented per copywriting contract
- Apply/Clear/Reset disabled while `refreshing`; export buttons disabled while `exporting` with inline "Exporting…" on Excel
- Toast messages for export and filter save failures
- PM dashboard refetches on tab visibility return (`usePmDashboard.ts:89-97`)

**Pass — Drill-down interaction**

Tile click toggles selection; panel hidden when `activeKey` is null; only one active drill-down at a time.

**Pass — Filter persistence flow**

Draft state syncs from GET filters on mount; Apply PUTs then refetches; Clear/Reset POST then refetch.

---

## Files Audited

- `components/layout/Sidebar.tsx`
- `app/dashboards/portfolio/page.tsx`
- `app/dashboards/pm/page.tsx`
- `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`
- `modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx`
- `modules/dashboards/ui/portfolio/PortfolioCharts.tsx`
- `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`
- `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx`
- `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx`
- `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts`
- `modules/dashboards/ui/pm/PmDashboardPage.tsx`
- `modules/dashboards/ui/pm/PmActionQueues.tsx`
- `modules/dashboards/ui/pm/PmFiltersBar.tsx`
- `modules/dashboards/ui/pm/usePmDashboard.ts`
- `.planning/phases/21-portfolio-pm-dashboard-pages/21-UI-SPEC.md`
