# Phase 22 — UI Review

**Audited:** 2026-08-28
**Baseline:** 22-UI-SPEC.md (approved)
**Screenshots:** not captured (code-only audit; no dev server assumed)
**Verdict:** Advisory — no blockers; ship with recommended fixes

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | All contract primary CTAs present; minor extra/ generic strings |
| 2. Visuals | 2/4 | Export bar merged into header; native selects break shadcn consistency |
| 3. Color | 3/4 | Apply filters misuses primary accent; otherwise 60/30/10 holds |
| 4. Typography | 4/4 | Only `text-xs`/`text-sm`/`text-base` and weights 400 + 600 |
| 5. Spacing | 3/4 | Page shell matches Phase 21; grid uses fixed 400px not viewport calc |
| 6. Experience Design | 3/4 | State coverage strong; selection + validation diverge from spec |

**Overall: 18/24**

---

## Top 3 Priority Fixes

1. **Relocate export controls to bottom export bar** — Export format + Export pack live in the page header (`WeeklyTrackingPage.tsx:168–186`) instead of the spec's zone-5 export bar below the grid; CPMO loses the intended focal hierarchy (grid primary, export secondary). Move `ExportToolbar` below `TrackingGrid` and keep period selector in header only.

2. **Demote Apply filters from primary accent** — `TrackingFiltersBar.tsx:200–207` styles Apply filters as `bg-blue-600`, but UI-SPEC reserves accent for Create period, Save schedule, Submit report, Export pack, and row action links only. Switch to `variant="outline"` or default secondary so accent stays at ~10%.

3. **Align grid height and row selection with contract** — `TrackingGrid.tsx:29` hard-codes `GRID_HEIGHT = 400` instead of `max-h-[calc(100vh-280px)]`; checkbox selection is limited to `submitted` rows (`TrackingGrid.tsx:53–54,139`) while spec says header checkbox selects all filtered rows in memory. Use viewport-relative height and allow selection per export rules in API, or document the submitted-only constraint if intentional.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**WARNING — Extra link copy not in contract**

- `WeeklyTrackingPage.tsx:153–155` adds "Go to Weekly periods" on the no-periods empty state. Contract specifies heading + body only; link is helpful but uncontracted copy.

**WARNING — Generic validation inline text**

- `WeeklyReportForm.tsx:44` renders "Required before submit" for field errors. Contract expects `SubmitValidationError` field paths surfaced inline (`22-UI-SPEC.md` Editor Contract). API paths like `raid_dependency` are mapped, but the visible message is generic rather than naming the field.

**PASS — Contract CTAs verified**

| CTA | Location | Match |
|-----|----------|-------|
| Create period | `WeeklyPeriodsPage.tsx:91` | ✓ |
| Save schedule | `WeeklyConfigForm.tsx:104` | ✓ |
| Submit report | `WeeklyReportEditorPage.tsx:167` | ✓ |
| Open correction | `WeeklyReportEditorPage.tsx:178` | ✓ |
| Export pack | `ExportToolbar.tsx:45` | ✓ |
| Track submissions | `WeeklyPeriodList.tsx:67` | ✓ |
| Open report | `TrackingGrid.tsx:178` | ✓ |
| Apply filters | `TrackingFiltersBar.tsx:206` | ✓ |

**PASS — Empty, loading, error strings**

- Periods, tracking, and editor shells use contract copy for loading (`Loading weekly periods…`, `Loading tracking…`, `Loading report…`), 401/403/500 panels, and all three empty-state pairs.
- Toasts in hooks match contract (`Schedule saved`, `Period created`, `Export downloaded`, `Fix validation errors before submitting.`, etc.).

---

### Pillar 2: Visuals (2/4)

**WARNING — Export toolbar placement breaks page zones**

- UI-SPEC tracking layout: header → summary → filters → grid → **export bar**. Implementation places `ExportToolbar` in the header flex row beside the title and period selector (`WeeklyTrackingPage.tsx:168–186`), collapsing zones 1 and 5. On narrow viewports the header becomes crowded and export competes with the page title for focal attention.

**WARNING — Native `<select>` vs shadcn Select**

- Period selector (`WeeklyTrackingPage.tsx:170–181`), all filter dropdowns (`TrackingFiltersBar.tsx:64–176`), and export format (`ExportToolbar.tsx:26–37`) use styled native `<select>` elements. Config form correctly uses shadcn `Select` (`WeeklyConfigForm.tsx:66–78`). Visual weight, focus rings, and dropdown animation differ across the same workflow.

**WARNING — Virtual grid column alignment**

- `TrackingGrid.tsx:128–184` renders rows as flex `div`s inside a single `TableCell`, not as `TableRow`/`TableCell` pairs. Column widths are hand-tuned (`w-10`, `w-16`, `w-24`) and may drift from sticky header columns on resize or long content. Focal grid is present but hierarchy is fragile compared to Phase 21 table density.

**PASS — Focal points partially met**

- Periods page: config + create cards precede list (`WeeklyPeriodsPage.tsx:68–96`) — matches spec.
- PM editor: stacked form Cards with sticky action bar (`WeeklyReportEditorPage.tsx:150–182`) — matches spec.
- Summary chips render six counts with zero support (`TrackingCountsBar.tsx:24–32`).

---

### Pillar 3: Color (3/4)

**WARNING — Accent overreach on Apply filters**

- `TrackingFiltersBar.tsx:202` applies `bg-blue-600 hover:bg-blue-700` to Apply filters. Contract limits accent to five primary CTAs plus row links and spinner border. Filter apply is a secondary action and should not carry primary blue.

**PASS — Dominant / secondary / semantic**

- Page shells: `bg-slate-50` on all three pages.
- Cards and filter bar: `bg-white`; sidebar unchanged at `bg-[#0f172a]`.
- Primary CTAs (Create period, Save schedule, Submit report, Open correction, Export pack) correctly use `bg-blue-600`.
- Row links (`Track submissions`, `Open report`, project links) use `text-blue-600`.
- RAG/status badges use semantic green/amber/red/slate per contract (`TrackingGrid.tsx:16–27`, `WeeklyReportEditorPage.tsx:20–31`).
- Loading spinners use `border-blue-500` as specified.
- No hardcoded hex colors in `modules/weekly/`.

---

### Pillar 4: Typography (4/4)

**PASS — Size scale**

- Body: `text-sm` on tables, inputs, textareas, loading/error copy.
- Labels: `text-xs font-semibold` on field labels and count chip labels.
- Headings: `text-base font-semibold` on page titles and not-found heading.
- Optional display `text-3xl` for KPI strip not used (counts bar uses xs/sm — acceptable; display role marked optional).

**PASS — Two weights only**

- Grep across `modules/weekly/` finds `font-semibold` (600) for labels/headings and default weight (400) for body. No `font-bold`, `font-medium`, or extrabold in phase code.

---

### Pillar 5: Spacing (3/4)

**PASS — Page shell and section gaps**

- All pages use `flex flex-col lg:flex-row min-h-screen bg-slate-50` and main `flex-1 p-4 lg:p-6 lg:p-8 overflow-auto` — matches Phase 21 / UI-SPEC.
- Section gaps: `gap-4`, `gap-2`, `mb-4`, `mb-6`, table cells `p-2`, Card `px-4`.

**WARNING — Off-scale `space-y-1.5` (6px)**

- Used in form field stacks (`WeeklyConfigForm.tsx:29`, `WeeklyReportForm.tsx` throughout, `TrackingFiltersBar.tsx:20`). Declared scale jumps xs (4px) → sm (8px); 6px is undocumented.

**WARNING — Fixed grid height**

- `TrackingGrid.tsx:29` sets `GRID_HEIGHT = 400` instead of spec's `max-h-[calc(100vh-280px)]`. On tall viewports the grid occupies less than available space; on short viewports it may not adapt.

**PASS — Declared exceptions**

- Textarea `min-h-[80px]` matches spec exception.
- Truncation widths `max-w-[240px]` / `max-w-[200px]` match backstop notes.

---

### Pillar 6: Experience Design (3/4)

**PASS — State coverage (loading / error / empty)**

- All three page shells: centered spinner + contract loading string; AlertTriangle + contract error copy for 401/403/500.
- Empty states: period list, tracking grid, no-periods panel, PM not-found — all match Copywriting Contract.
- Mutations disable buttons (`creatingPeriod`, `saving`, `submitting`, `correcting`, `exporting`) with `aria-busy` where applicable.

**PASS — Export UX**

- Export disabled when selection empty with hint "Select at least one project to export." (`ExportToolbar.tsx:47–50`).
- In-flight label "Exporting…" (`ExportToolbar.tsx:45`).
- Success/error toasts wired in `usePeriodTracking.ts`.

**WARNING — Row selection scope**

- Header checkbox aria-label says "Select all submitted" (`TrackingGrid.tsx:90`) and row checkboxes disabled unless `status === 'submitted'`. Spec states header checkbox selects all **filtered** rows in memory. If export requires submitted-only, UI should explain why other rows are not selectable.

**WARNING — Partial inline validation**

- `fieldErrors` from API populate inline hints on `nearest_milestone`, `nearest_milestone_id`, `raid_dependency`, `leadership_support` only. Missing inline coverage for `highlights`, `this_week_rag`, `completed_work`, `next_week_goals` if API returns those paths.

**PASS — Sidebar NAV**

- CPMO-only links inserted after My dashboard, before NAV_SECONDARY (`Sidebar.tsx:194–222`).
- Labels "Weekly periods" / "Weekly tracking" with `CalendarDays` / `ListChecks` icons.
- Active state uses `bg-blue-600` when pathname matches.

**PASS — PM editor flow**

- Debounced PATCH 300ms (`useWeeklyReportEditor.ts:134–136`).
- Submit visible for draft/not_submitted; Open correction for submitted without correction open.
- 409 PATCH shows contract toast; sticky action Card at bottom.

---

## Registry Safety

Registry audit: shadcn official components only; 0 third-party blocks listed in UI-SPEC — no flags.

---

## Files Audited

- `.planning/phases/22-weekly-workflow-surfaces/22-UI-SPEC.md`
- `modules/weekly/ui/periods/WeeklyPeriodsPage.tsx`
- `modules/weekly/ui/periods/WeeklyConfigForm.tsx`
- `modules/weekly/ui/periods/WeeklyPeriodList.tsx`
- `modules/weekly/ui/periods/useWeeklyPeriods.ts`
- `modules/weekly/ui/tracking/WeeklyTrackingPage.tsx`
- `modules/weekly/ui/tracking/TrackingGrid.tsx`
- `modules/weekly/ui/tracking/TrackingCountsBar.tsx`
- `modules/weekly/ui/tracking/TrackingFiltersBar.tsx`
- `modules/weekly/ui/tracking/ExportToolbar.tsx`
- `modules/weekly/ui/tracking/usePeriodTracking.ts`
- `modules/weekly/ui/report/WeeklyReportEditorPage.tsx`
- `modules/weekly/ui/report/WeeklyReportForm.tsx`
- `modules/weekly/ui/report/useWeeklyReportEditor.ts`
- `modules/weekly/ui/shared/VirtualRows.tsx`
- `components/layout/Sidebar.tsx`
