# Phase 24 — UI Review

**Audited:** 2026-08-28
**Baseline:** 24-UI-SPEC.md (preserve-existing contract)
**Screenshots:** not captured (no dev server at localhost:3000, 5173, or 8080)

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Key strings unchanged; component tests assert pre-split copy |
| 2. Visuals | 3/4 | Thin P1 shells correct; pre-existing chrome gaps preserved, not introduced |
| 3. Color | 3/4 | Slate/blue palette preserved; operations shadcn tokens unchanged from pre-split |
| 4. Typography | 3/4 | font-bold/medium usage preserved; split did not add new weights |
| 5. Spacing | 4/4 | Page shell classes match pre-split git baseline |
| 6. Experience Design | 4/4 | Loading/error/empty states intact; 33/33 sample component tests pass |

**Overall: 21/24**

**Split verdict:** No evidence the module split accidentally redesigned UI. Deviations flagged below are pre-existing baseline debt, preserved verbatim by mechanical moves.

---

## Top 3 Priority Fixes

1. **Run URL smoke with dev server when available** — Code-only audit could not capture pixel-level regression; hit Page Inventory URLs and confirm Sidebar NAV + primary headings match pre-split behavior.
2. **Document operations chrome isolation** — `/operations` and `/operations/[id]` render without `Sidebar` or standard `bg-slate-50` shell (confirmed same in pre-split `app/operations/page.tsx` at commit `291bcd0`); not a split regression, but inconsistent with UI-SPEC page-shell table — flag for future harmonization only if product wants it.
3. **Spot-check portfolio home decomposition** — `app/page.tsx` now delegates to `modules/portfolio/ui/home/PortfolioHomePage` with subcomponents; component tests pass (`Portfolio Health Check`, loading copy, view-mode toggle). No redesign detected; optional manual smoke recommended after large file decomposition.

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

**WARNING (pre-existing, not split):** Bilingual mix remains (English admin panel + Vietnamese Jira/RAG dialogs in `AdminPage.tsx`; Vietnamese operations copy). Contract says preserve — preserved.

Evidence the split did not alter copy:

- P1 shells are pure re-exports with no JSX:
  - `app/page.tsx` → `@/modules/portfolio/ui/home/PortfolioHomePage`
  - `app/admin/page.tsx` → `@/modules/admin/ui/AdminPage`
  - `app/operations/page.tsx` → `@/modules/operations/ui/OperationsListPage`
  - `app/portfolio/report/page.tsx` → `@/modules/reports/ui/portfolio-report/PortfolioReportPage`
  - `app/dashboards/portfolio/page.tsx` → `@/modules/dashboards/ui/portfolio/PortfolioDashboardPage`
- Component tests assert unchanged strings:
  - `PortfolioHomePage.component.test.tsx`: `Portfolio Health Check`, `Loading portfolio...`
  - `PortfolioReportPage.component.test.tsx`: `Reporting Period:`, `Chọn Milestone`
  - `PortfolioDashboardPage.component.test.tsx`: heading `Spec dashboard`
- No generic UX anti-patterns introduced (`Submit`, `Click Here`, `No data`, etc.) in moved module UI.

### Pillar 2: Visuals (3/4)

**WARNING:** Operations module pages use a standalone layout (`p-6 max-w-6xl mx-auto`) without `Sidebar` — same structure as pre-split inline `app/operations/page.tsx`. Split preserved this isolation; it diverges from UI-SPEC authenticated chrome but is not a redesign.

**WARNING:** Admin and portfolio resources pages omit `bg-slate-50` on root shell (`AdminPage.tsx:370`, `PortfolioResourcesPage.tsx:658`). Pre-split admin at `291bcd0:app/admin/page.tsx` also used `min-h-screen` without canvas background — preserved, not introduced.

Positive preservation signals:

- Portfolio home, portfolio report, spec dashboard retain `flex flex-col lg:flex-row min-h-screen bg-slate-50` + `Sidebar`.
- Portfolio home header focal point unchanged: `text-2xl font-bold text-slate-900` on `Portfolio Health Check` (`PortfolioHeader.tsx:17`).
- Icon-only admin row actions retain `title` attributes (`AdminPage.tsx:495–509`).
- Dashboard error panel uses centered `AlertTriangle` + copy (`PortfolioDashboardPage.tsx:46–49`).

### Pillar 3: Color (3/4)

**WARNING:** Dual palette persists — portfolio/admin/dashboards use explicit `slate-*` / `blue-600`; operations uses shadcn semantic tokens (`bg-card`, `text-muted-foreground`, `text-green-600`). Counts in moved UI: ~28 files with `blue-600` accent; operations pages use 14 `text-muted-foreground`/`bg-card` references. Pre-split operations already used this pattern — not expanded by split.

No hardcoded hex/rgb in audited module UI (`modules/{portfolio,admin,operations,reports,dashboards}/ui/**/*.tsx`).

Semantic RAG colors preserved where used (`bg-green-100 text-green-700`, etc. in operations detail).

Accent usage not expanded on decorative elements during split; primary CTAs remain `bg-blue-600 hover:bg-blue-700`.

### Pillar 4: Typography (3/4)

**WARNING:** UI-SPEC declares max two weights (400, 600), but production baseline uses `font-bold` (700) and `font-medium` (500) extensively — e.g. `AdminPage.tsx` h1 `font-bold`, tab buttons `font-medium`, operations KPI tiles `text-2xl font-bold`. Git baseline at `291bcd0` shows identical patterns on home and admin. **Split did not introduce a third weight tier**; existing debt preserved.

Size scale preserved: body `text-sm`, labels `text-xs`, headings mix of `text-base`/`text-xl`/`text-2xl`/`text-3xl` as before decomposition.

Portfolio home display heading remains `text-2xl font-bold` (matches pre-split `app/page.tsx`).

### Pillar 5: Spacing (4/4)

Page shell contract preserved against git baseline:

| Route | Main padding | Canvas | Pre-split match |
|-------|-------------|--------|-----------------|
| `/` (home) | `p-4 lg:p-6` | `bg-slate-50` | Yes (`291bcd0:app/page.tsx`) |
| `/dashboards/portfolio` | `p-4 lg:p-6 lg:p-8` | `bg-slate-50` | Yes (already in modules) |
| `/admin` | `p-4 lg:p-6` | no canvas bg | Yes (pre-split admin) |
| `/portfolio/report` | `p-4 lg:p-6` | `bg-slate-50` | Yes |
| `/operations` | `p-6 max-w-6xl mx-auto` | none | Yes (pre-split) |

Arbitrary spacing values (`text-[10px]`, `min-w-[640px]`, `min-h-[72px]`) present in home/report/admin — pre-existing per-page exceptions, unchanged by move.

### Pillar 6: Experience Design (4/4)

State coverage preserved:

- **Loading:** Portfolio home + spec dashboard spinners with copy (`PortfolioHomePage.tsx:88–99`, `PortfolioDashboardPage.tsx:27–38`).
- **Error:** Dashboard `ERROR_COPY` unauthorized/forbidden/load_failed panels (`PortfolioDashboardPage.tsx:16–20, 41–52`).
- **Empty:** Operations list empty state with icon + guidance (`OperationsListPage.tsx:111–116`).
- **Disabled:** Export buttons respect `exporting`/`refreshing` flags on dashboard.
- **Destructive:** Operations delete uses `confirm()` before DELETE — unchanged pattern.

Vitest: 33/33 tests passed across `PortfolioHomePage`, `PortfolioDashboardPage`, and `PortfolioReportPage` component suites.

Auth-gated admin redirect preserved (`AdminPage.tsx:127–128` → `router.replace('/')`).

---

## Registry Safety

Registry audit: 0 third-party blocks (UI-SPEC lists "none"; `components.json` `registries: {}`), no flags.

Phase rule honored: no new `npx shadcn add` evidence in moved UI trees.

---

## Files Audited

**Contract & shells**
- `.planning/phases/24-repo-wide-module-split/24-UI-SPEC.md`
- `app/page.tsx`, `app/admin/page.tsx`, `app/operations/page.tsx`, `app/portfolio/report/page.tsx`, `app/dashboards/portfolio/page.tsx`

**Module UI (P1 targets)**
- `modules/portfolio/ui/home/PortfolioHomePage.tsx` + `_components/PortfolioHeader.tsx`
- `modules/admin/ui/AdminPage.tsx`
- `modules/operations/ui/OperationsListPage.tsx`, `OperationsDetailPage.tsx`
- `modules/reports/ui/portfolio-report/PortfolioReportPage.tsx`
- `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx`, `PortfolioKpiTiles.tsx`

**Tests & contracts**
- `modules/portfolio/ui/home/PortfolioHomePage.component.test.tsx`
- `modules/reports/ui/portfolio-report/PortfolioReportPage.component.test.tsx`
- `modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx`
- `modules/operations/backend/operations-module-split.test.ts`

**Git baseline (pre-split comparison)**
- `291bcd0:app/page.tsx`, `291bcd0:app/admin/page.tsx`, `291bcd0:app/operations/page.tsx`
