---
phase: 07-ui-decomposition
fixed_at: 2026-08-25T13:10:00Z
review_path: .planning/phases/07-ui-decomposition/07-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 0
skipped: 15
status: none_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-08-25T13:10:00Z
**Source review:** `.planning/phases/07-ui-decomposition/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 15
- Fixed: 0
- Skipped (WONTFIX): 15

## Fixed Issues

None — all in-scope findings are pre-existing behavior preserved under HYG-02 (UI-11 behavior freeze). No source commits were made.

## Skipped Issues (WONTFIX — HYG-02 behavior freeze)

Each finding below was compared against the pre-decomposition god page or dialog (git parent of the phase-07 extract commit). The extracted hooks/components copy the same fetch/error/export patterns verbatim; fixing them would change runtime behavior vs the pre-refactor pages.

### CR-01: Import dialog closes and refreshes on failed import

**File:** `components/timeline/ImportMappingDialog.tsx:179-200`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `ImportMappingDialog.tsx` (parent of `0125a3d`) called `onImported()` and `onOpenChange(false)` unconditionally after the import try/catch, identical to the extracted code.
**Original issue:** Dialog closes and parent reloads even when import fails.

### CR-02: Portfolio report hook stores API error JSON as report data

**File:** `app/portfolio/report/usePortfolioReport.ts:35-37`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `app/portfolio/report/page.tsx` (parent of `61f2ab2`) `loadData` parsed JSON and called `setData(d)` without checking `res.ok`.
**Original issue:** Error JSON body stored as report data; page may crash on `data.programs`.

### CR-03: Dashboard hook leaves loading spinner forever on fetch failure

**File:** `app/usePortfolioDashboard.ts:10-12`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `app/page.tsx` (parent of `cb06699`) used `fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); })` with no `.catch()`.
**Original issue:** Network failure never clears loading state.

### CR-04: Roadmap hook leaves loading spinner forever on fetch failure

**File:** `app/portfolio/roadmap/useRoadmapPage.ts:17-21`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `app/portfolio/roadmap/page.tsx` (parent of `be61175`) set `loading` false only inside the success `.then()`.
**Original issue:** Initial roadmap fetch failure leaves perpetual spinner.

### WR-01: Epic lazy-load stuck in perpetual "loading" state on failure

**File:** `app/portfolio/roadmap/useRoadmapPage.ts:43-51`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split roadmap page `loadEpics` used the same `'loading'` placeholder and `.then(r => r.json())` with no failure recovery.
**Original issue:** Failed epic fetch never clears loading indicator.

### WR-02: Timeline page hook accepts error payloads as valid state

**File:** `app/projects/[id]/timeline/useTimelinePage.ts:10-17`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `app/projects/[id]/timeline/page.tsx` (parent of `6f93682`) used `.then(r => r.json()).then(setState)` for activities/project/team/holidays without `res.ok` checks.
**Original issue:** HTTP error JSON stored as page state.

### WR-03: Milestones page hook has same unchecked fetch pattern

**File:** `app/projects/[id]/milestones/useMilestonesPage.ts:11-31`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `app/projects/[id]/milestones/page.tsx` (parent of `af48f37`) parsed JSON unconditionally for milestones, activities, project, and team.
**Original issue:** Failed responses populate state with error objects.

### WR-04: Timeline mutations add rows to UI without verifying POST success

**File:** `app/projects/[id]/timeline/useTimelineActions.ts:47-80`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split timeline page `addActivity`, `createChild`, and `duplicateActivity` appended `await res.json()` to state without checking `res.ok`.
**Original issue:** Validation error responses still mutate local activity list.

### WR-05: Milestone PDF export injects unescaped user content via document.write

**File:** `app/projects/[id]/milestones/useMilestonesActions.ts:131-202`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split milestones page built HTML with interpolated activity/milestone names and used `win.document.write(html)` unchanged.
**Original issue:** Unescaped HTML in print window.

### WR-06: Project report PDF export injects unescaped HTML

**File:** `app/projects/[id]/report/useProjectReportPageActions.ts:116-119`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split project report page `exportPdf` wrote `htmlReport` via `document.write` with the same template string.
**Original issue:** Unescaped report HTML in print window.

### WR-07: Project report AI/email helpers ignore HTTP status

**File:** `app/projects/[id]/report/useProjectReport.ts:62-88`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split page POST handlers returned `r.json()` without `res.ok`; callers checked `j.error` the same way as `useProjectReportPageActions` does today.
**Original issue:** Generic HTTP failures may silent no-op.

### WR-08: Ambiguous date parsing branch is a no-op

**File:** `components/timeline/_components/ValueNormalizers.ts:13-15`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split `ImportMappingDialog.tsx` inline `normalizeDate` had identical branches when `c.length === 4` (both return `${c}-${b}-...-${a}` vs same).
**Original issue:** DD/MM vs MM/DD ambiguity not resolved.

### WR-09: Import template save assumes success without res.ok

**File:** `components/timeline/ImportMappingDialog.tsx:117-122`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split dialog `saveTemplate` parsed JSON and prepended to `savedMappings` without checking `res.ok`.
**Original issue:** Failed POST still mutates local template list.

### WR-10: Portfolio report config/key saves ignore response status

**File:** `app/portfolio/report/useReportPageActions.ts:77-90`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split portfolio report `saveApiKey` / `saveCeoEmail` POSTed to `/api/config` and showed success toasts without `res.ok`.
**Original issue:** Failed config save shows success.

### WR-11: Milestone delete updates UI even when DELETE fails

**File:** `app/projects/[id]/milestones/useMilestonesActions.ts:67-75`
**Reason:** HYG-02 behavior freeze — pre-existing. Pre-split milestones `deleteMilestone` awaited DELETE then refreshed local state without checking `res.ok`.
**Original issue:** Server-rejected delete still clears selection and list.

## Verification

No source files were modified. Classification was performed by diffing extracted modules against pre-decomposition god pages via `git show {extract-commit}^:{path}`. Worktree setup ran in isolated checkout (`.claude/worktrees/rf-07-*`); no syntax gates were required because no code changes were applied.

---

_Fixed: 2026-08-25T13:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
