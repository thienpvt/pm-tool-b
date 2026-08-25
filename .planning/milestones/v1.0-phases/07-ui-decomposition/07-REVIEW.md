---
phase: 07-ui-decomposition
reviewed: 2026-08-25T13:02:00Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - app/_components/HealthScoreArc.tsx
  - app/_components/ListRow.tsx
  - app/_components/MiniSparkline.tsx
  - app/_components/ProgramSection.tsx
  - app/_components/ProjectCard.tsx
  - app/_components/helpers.ts
  - app/page.component.test.tsx
  - app/page.tsx
  - app/portfolio/report/page.component.test.tsx
  - app/portfolio/report/page.tsx
  - app/portfolio/report/types.ts
  - app/portfolio/report/usePortfolioReport.ts
  - app/portfolio/report/useReportPageActions.ts
  - app/portfolio/roadmap/_components/EpicColours.ts
  - app/portfolio/roadmap/_components/EpicDetailDialog.tsx
  - app/portfolio/roadmap/_components/PhaseColours.ts
  - app/portfolio/roadmap/_components/ProjectInYearCheck.ts
  - app/portfolio/roadmap/_components/QuickViewPresets.ts
  - app/portfolio/roadmap/_components/RoadmapGrid.tsx
  - app/portfolio/roadmap/_components/RoadmapMilestoneView.tsx
  - app/portfolio/roadmap/_components/RoadmapPhaseGrid.tsx
  - app/portfolio/roadmap/_components/RoadmapToolbar.tsx
  - app/portfolio/roadmap/_components/helpers.ts
  - app/portfolio/roadmap/page.component.test.tsx
  - app/portfolio/roadmap/page.tsx
  - app/portfolio/roadmap/types.ts
  - app/portfolio/roadmap/useRoadmapPage.ts
  - app/projects/[id]/milestones/page.component.test.tsx
  - app/projects/[id]/milestones/page.tsx
  - app/projects/[id]/milestones/types.ts
  - app/projects/[id]/milestones/useMilestonesActions.ts
  - app/projects/[id]/milestones/useMilestonesPage.ts
  - app/projects/[id]/report/page.component.test.tsx
  - app/projects/[id]/report/page.tsx
  - app/projects/[id]/report/types.ts
  - app/projects/[id]/report/useProjectReport.ts
  - app/projects/[id]/report/useProjectReportPageActions.ts
  - app/projects/[id]/timeline/page.component.test.tsx
  - app/projects/[id]/timeline/page.tsx
  - app/projects/[id]/timeline/types.ts
  - app/projects/[id]/timeline/useTimelineActions.ts
  - app/projects/[id]/timeline/useTimelinePage.ts
  - app/types.ts
  - app/usePortfolioDashboard.ts
  - components/timeline/ImportMappingDialog.component.test.tsx
  - components/timeline/ImportMappingDialog.tsx
  - components/timeline/_components/ActivityFields.ts
  - components/timeline/_components/CsvParser.ts
  - components/timeline/_components/ImportPreview.tsx
  - components/timeline/_components/MappingStep.tsx
  - components/timeline/_components/MappingStepPanels.tsx
  - components/timeline/_components/UploadStep.tsx
  - components/timeline/_components/ValueNormalizers.ts
  - components/timeline/_components/importLogic.ts
  - components/timeline/types.ts
  - components/timeline/useImportMapping.ts
  - vitest.config.ts
findings:
  critical: 4
  warning: 11
  info: 0
  total: 15
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-25T13:02:00Z
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

Standard-depth adversarial review of the Phase 7 UI decomposition: thin page containers, colocated hooks, and extracted feature modules across portfolio dashboard, reports, roadmap, milestones, timeline, and import dialog. No UI-09 violations (client code importing `@/lib/db`, repositories, services, or integrations) were found in scope.

The decomposition structure is sound, but several extracted data hooks preserve fragile fetch patterns from the god pages: missing `res.ok` checks, no rejection handlers on promise chains, and success callbacks fired unconditionally. The highest-impact defects are an import dialog that closes and refreshes data even when import fails, portfolio report pages that can crash on API error payloads, and multiple hooks that leave the UI stuck in a perpetual loading state on network failure.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Import dialog closes and refreshes on failed import

**File:** `components/timeline/ImportMappingDialog.tsx:179-200`
**Issue:** `onImported()` and `onOpenChange(false)` run unconditionally after the import `try/catch`, including when the fetch throws, when `res.ok` is false, or when `result.errors` is non-empty. The user sees a failure toast but the dialog closes and the parent timeline reloads as if import succeeded — violating UI-11 behavior freeze and risking partial/corrupt state display.
**Fix:**
```typescript
try {
  const res = await fetch(`/api/projects/${projectId}/activities/import`, { /* ... */ });
  const result = await res.json();
  if (!res.ok || result.errors?.length) {
    toast.error(result.errors?.length
      ? `Import xong với ${result.errors.length} lỗi`
      : (result.error ?? 'Import thất bại'));
    return;
  }
  toast.success(/* ... */);
  onImported();
  onOpenChange(false);
} catch {
  toast.error('Import thất bại');
} finally {
  setImporting(false);
}
```

### CR-02: Portfolio report hook stores API error JSON as report data

**File:** `app/portfolio/report/usePortfolioReport.ts:35-37`
**Issue:** `loadData` parses JSON and calls `setData(d)` without checking `res.ok`. An auth or server error body like `{ error: "..." }` is truthy and lacks `programs`, causing a runtime crash when the page accesses `data.programs.flatMap(...)` at `app/portfolio/report/page.tsx:63`.
**Fix:**
```typescript
const res = await fetch(url);
const d = await res.json();
if (!res.ok) {
  setData(null);
  return;
}
setData(d);
```

### CR-03: Dashboard hook leaves loading spinner forever on fetch failure

**File:** `app/usePortfolioDashboard.ts:10-12`
**Issue:** `loadPortfolio` chains `.then(r => r.json()).then(...)` with no `.catch()` or `.finally()`. A network error or non-JSON response never calls `setLoading(false)`, leaving `app/page.tsx:88-99` stuck on the loading spinner indefinitely.
**Fix:**
```typescript
const loadPortfolio = useCallback(() => {
  setLoading(true);
  fetch('/api/portfolio')
    .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load portfolio')))
    .then(d => setData(d))
    .catch(() => setData(null))
    .finally(() => setLoading(false));
}, []);
```

### CR-04: Roadmap hook leaves loading spinner forever on fetch failure

**File:** `app/portfolio/roadmap/useRoadmapPage.ts:17-21`
**Issue:** The initial roadmap fetch sets `loading` to false only inside the success `.then()`. Network failure or rejected JSON parse never clears loading, so `app/portfolio/roadmap/page.tsx:194-205` spins forever.
**Fix:**
```typescript
useEffect(() => {
  fetch('/api/portfolio/roadmap')
    .then(r => r.ok ? r.json() : Promise.reject())
    .then((d: RoadmapData) => setData(d))
    .catch(() => setData(null))
    .finally(() => setLoading(false));
}, []);
```

## Warnings

### WR-01: Epic lazy-load stuck in perpetual "loading" state on failure

**File:** `app/portfolio/roadmap/useRoadmapPage.ts:43-51`
**Issue:** `loadEpics` sets `epicsByProject[projectId]` to `'loading'` before fetch. If the request fails or returns a non-OK body, the entry is never replaced with an array or cleared, so the phase grid shows a permanent loading indicator with no retry path.
**Fix:** Wrap fetch in try/catch and on failure set `{ ...prev, [projectId]: [] }` or delete the key so the user can retry expand.

### WR-02: Timeline page hook accepts error payloads as valid state

**File:** `app/projects/[id]/timeline/useTimelinePage.ts:10-17`
**Issue:** All four `useEffect` fetches call `.then(r => r.json()).then(setState)` without checking `res.ok` or attaching `.catch()`. A 403/500 JSON error object is stored as activities/project/team/holidays, causing downstream filters and renders to behave incorrectly or throw.
**Fix:** Check `r.ok` before parsing; on failure keep prior state or set safe defaults and optionally toast.

### WR-03: Milestones page hook has same unchecked fetch pattern

**File:** `app/projects/[id]/milestones/useMilestonesPage.ts:11-31`
**Issue:** `loadMilestones`, `loadAllActivities`, and project/team fetches parse JSON unconditionally. Failed responses populate state with error objects; no error surfacing to the user.
**Fix:** Mirror `useProjectReport.loadData` — guard with `if (!r.ok) throw ...` and toast on catch.

### WR-04: Timeline mutations add rows to UI without verifying POST success

**File:** `app/projects/[id]/timeline/useTimelineActions.ts:47-80`
**Issue:** `addActivity`, `createChild`, and `duplicateActivity` call `await res.json()` and append the result to state without checking `res.ok`. A validation error response (missing `id`) still mutates local state and may set `newActivityIdRef` to undefined.
**Fix:**
```typescript
const res = await fetch(/* ... */);
if (!res.ok) { toast.error('Failed to create activity'); return; }
const row = await res.json();
setActivities(a => [...a, row]);
```

### WR-05: Milestone PDF export injects unescaped user content via document.write

**File:** `app/projects/[id]/milestones/useMilestonesActions.ts:131-202`
**Issue:** Activity names, Jira keys, phase labels, and milestone/project names are interpolated directly into HTML passed to `win.document.write()`. A malicious or accidental `<script>` or HTML in an activity name executes in the print window context.
**Fix:** Escape HTML entities before interpolation, or build the document with DOM APIs / `textContent`:
```typescript
const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
// use esc(parent.activity), esc(phase), etc.
```

### WR-06: Project report PDF export injects unescaped HTML

**File:** `app/projects/[id]/report/useProjectReportPageActions.ts:116-119`
**Issue:** `exportPdf` writes `p.htmlReport` directly into a new window via `document.write`. Report HTML is generated from project data and AI output; unescaped content enables stored XSS when printing/exporting.
**Fix:** Sanitize `htmlReport` before write, or render through a DOM fragment with controlled insertion instead of string interpolation.

### WR-07: Project report AI/email helpers ignore HTTP status

**File:** `app/projects/[id]/report/useProjectReport.ts:62-88`
**Issue:** `generateAiReport`, `generateEmailContent`, and `sendEmailViaApi` return `r.json()` without checking `res.ok`. Callers in `useProjectReportPageActions` inspect `j.error` in the body but miss generic HTTP failures where the body shape differs, leading to silent no-ops (`if (!j) return` never triggers on `{}`).
**Fix:** Return `null` or throw when `!r.ok`; parse error field consistently.

### WR-08: Ambiguous date parsing branch is a no-op

**File:** `components/timeline/_components/ValueNormalizers.ts:13-15`
**Issue:** In `normalizeDate`, when `c.length === 4`, both branches of `if (ai > 12)` return `${c}-${b}-${a}` — identical output. DD/MM vs MM/DD ambiguity is not actually resolved; US-format dates may import with swapped month/day.
**Fix:** When `ai > 12`, treat `a` as day: `` `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}` ``; otherwise treat `a` as month: `` `${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}` ``.

### WR-09: Import template save assumes success without res.ok

**File:** `components/timeline/ImportMappingDialog.tsx:117-122`
**Issue:** `saveTemplate` parses JSON and prepends to `savedMappings` even when the POST fails. A failed save shows success toast path only in try, but error responses that parse as JSON still mutate local template list incorrectly.
**Fix:** `if (!res.ok) throw new Error();` before `await res.json()`.

### WR-10: Portfolio report config/key saves ignore response status

**File:** `app/portfolio/report/useReportPageActions.ts:77-90`
**Issue:** `saveApiKey` and `saveCeoEmail` POST to `/api/config` without checking `res.ok`, then show success toasts and clear inputs unconditionally.
**Fix:** Check `res.ok`; on failure toast error and preserve input.

### WR-11: Milestone delete updates UI even when DELETE fails

**File:** `app/projects/[id]/milestones/useMilestonesActions.ts:67-75`
**Issue:** `deleteMilestone` awaits fetch but never checks `res.ok`. Local selection and milestone list refresh proceed even if the server rejected the delete (permissions, FK constraint).
**Fix:** `if (!res.ok) { toast.error('...'); return; }` before updating local state.

---

_Reviewed: 2026-08-25T13:02:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
