---
phase: 21-portfolio-pm-dashboard-pages
reviewed: 2026-08-28T09:02:00Z
depth: deep
files_reviewed: 24
files_reviewed_list:
  - modules/dashboards/ui/shared/types.ts
  - modules/dashboards/ui/shared/downloadBlob.ts
  - modules/dashboards/ui/shared/downloadBlob.test.ts
  - modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx
  - modules/dashboards/ui/portfolio/PortfolioDashboardPage.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx
  - modules/dashboards/ui/portfolio/PortfolioFiltersBar.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioKpiTiles.tsx
  - modules/dashboards/ui/portfolio/PortfolioKpiTiles.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioCharts.tsx
  - modules/dashboards/ui/portfolio/PortfolioCharts.component.test.tsx
  - modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx
  - modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx
  - modules/dashboards/ui/pm/usePmDashboard.ts
  - modules/dashboards/ui/pm/PmDashboardPage.tsx
  - modules/dashboards/ui/pm/PmDashboardPage.component.test.tsx
  - modules/dashboards/ui/pm/PmFiltersBar.tsx
  - modules/dashboards/ui/pm/PmActionQueues.tsx
  - app/dashboards/portfolio/page.tsx
  - app/dashboards/pm/page.tsx
  - components/layout/Sidebar.tsx
  - components/layout/Sidebar.dashboard-nav.component.test.tsx
  - vitest.config.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-08-28T09:02:00Z  
**Depth:** deep  
**Files Reviewed:** 24  
**Status:** issues_found

## Summary

Deep review of Phase 21 portfolio and PM dashboard UI modules, app route re-exports, Sidebar NAV additions, vitest config, and component tests. API consumption correctly targets `/api/dashboards/*` (no `/api/portfolio` usage). Fiscal KPIs are omitted per NIT-04. Sidebar role gating matches D-09 (NAV visibility only; server authz unchanged).

One **blocker**: unhandled fetch/JSON failures in both dashboard hooks render a blank page instead of the contracted error copy. Several **warnings** cover UI-SPEC typography/placement gaps, missing defensive guards, and duplicated filter-bar logic. Overall structure and test coverage are strong for the happy path and HTTP status errors (401/403/500).

## Critical Issues

### CR-01: Network/parse failures render blank page (no error state)

**File:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts:19-50`, `modules/dashboards/ui/pm/usePmDashboard.ts:16-47`  
**Also:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx:55`, `modules/dashboards/ui/pm/PmDashboardPage.tsx:46`

**Issue:** Both `load()` implementations use `try/finally` without `catch`. When `fetch()` rejects (network offline, CORS, aborted request) or `res.json()` throws (malformed body on 200), `loading` becomes `false`, `error` stays `null`, and `data` stays `null`. Both pages then hit `if (!data) return null`, producing a completely blank main area. UI-SPEC requires the network error copy ("Couldn't load the dashboard. Try again.") for network failures; tests only cover HTTP 500, not thrown exceptions.

**Fix:**
```typescript
const load = useCallback(async (isRefresh = false) => {
  if (isRefresh) setRefreshing(true);
  else setLoading(true);
  try {
    const res = await fetch('/api/dashboards/portfolio'); // or /pm
    // ... existing status handling ...
    setData(await res.json());
    setError(null);
  } catch {
    setError('load_failed');
    setData(null);
  } finally {
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }
}, []);
```

Add component tests that stub `fetch` to `Promise.reject(new Error('network'))` and assert error copy renders (not a blank document).

## Warnings

### WR-01: Third font weight violates UI-SPEC typography contract

**File:** `modules/dashboards/ui/portfolio/PortfolioProjectTable.tsx:56`, `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx:133`

**Issue:** UI-SPEC locks typography to two weights: 400 (body) and 600 (`font-semibold`). Empty-state headings use `font-medium` (weight 500), introducing a third weight on dashboard surfaces.

**Fix:** Replace `font-medium` with `font-semibold` (or drop explicit weight and rely on default 400 body weight for empty-state headings).

### WR-02: Portfolio header missing filter-summary subtitle

**File:** `modules/dashboards/ui/portfolio/PortfolioDashboardPage.tsx:61-62`

**Issue:** UI-SPEC page zone 1 requires header "Spec dashboard" **plus subtitle with filter summary count** (e.g. filtered project count), with export actions right-aligned. Implementation renders title and export buttons only. PM page correctly shows assigned project count (`PmDashboardPage.tsx:53-55`); portfolio page is asymmetric and omits the contracted subtitle.

**Fix:** Add a muted subtitle under the title, e.g. `{data.list.length} project(s) matching filters`, or a summary derived from active filter keys per UI-SPEC.

### WR-03: Drill-down panel crashes if API returns null/undefined rows

**File:** `modules/dashboards/ui/portfolio/PortfolioDrilldownTable.tsx:125-131`

**Issue:** `const rows = drilldowns[activeKey] as DrilldownRow[]` assumes an array. If the key is missing or nullish (partial JSON, schema drift), `rows.length` throws at runtime and breaks the entire dashboard after a KPI click.

**Fix:**
```typescript
const rows = (drilldowns[activeKey] ?? []) as DrilldownRow[];
```

### WR-04: Export path lacks catch for network/blob failures

**File:** `modules/dashboards/ui/portfolio/usePortfolioSpecDashboard.ts:85-103`

**Issue:** `exportDashboard` wraps fetch in `try/finally` but not `catch`. A rejected `fetch` or `res.blob()` leaves the user with no toast (UI-SPEC: "Export failed — try again.") although `exporting` is cleared in `finally`.

**Fix:** Add `catch { toast.error('Export failed — try again.'); }` inside the try block scope (before finally).

### WR-05: ~240 lines duplicated between filter bars

**File:** `modules/dashboards/ui/portfolio/PortfolioFiltersBar.tsx`, `modules/dashboards/ui/pm/PmFiltersBar.tsx`

**Issue:** `FieldRow`, `buildPayload`, `setField`, option memoization, and all nine filter controls are copy-pasted verbatim between portfolio and PM filter bars. Any filter bug fix must be applied twice; the files already risk silent divergence.

**Fix:** Extract shared helpers (`DashboardFiltersBar` base or shared `buildPayload` + option hooks) into `modules/dashboards/ui/shared/` and thin-wrap per surface.

## Info

### IN-01: Loose drill-down typing masks schema mismatches

**File:** `modules/dashboards/ui/shared/types.ts:12-16`

**Issue:** Drill-down arrays are typed `unknown[]`, forcing casts in `PortfolioDrilldownTable`. Server rows have a known shape (milestone name, project_id, code, entity_type, id); stronger types would catch missing fields at compile time.

**Fix:** Define `PortfolioDrilldownRows` discriminated by key and use in `PortfolioDashboardPayload`.

### IN-02: downloadBlob revokes object URL synchronously

**File:** `modules/dashboards/ui/shared/downloadBlob.ts:6-7`

**Issue:** `URL.revokeObjectURL` runs immediately after `a.click()`. Some browsers may cancel the download if revocation happens before the save dialog completes.

**Fix:** Defer revocation: `setTimeout(() => URL.revokeObjectURL(url), 0)` or listen for `visibilitychange` before revoke.

---

_Reviewed: 2026-08-28T09:02:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
