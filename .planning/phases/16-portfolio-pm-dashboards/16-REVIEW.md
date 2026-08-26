---
phase: 16-portfolio-pm-dashboards
reviewed: 2026-08-26T14:30:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - lib/db-dashboards.ts
  - lib/db.ts
  - lib/dashboards/filters.ts
  - lib/dashboards/filter-schema.ts
  - lib/dashboards/kpi.ts
  - lib/dashboards/period-resolver.ts
  - lib/dashboards/rag.ts
  - lib/services/spec-dashboards.service.ts
  - lib/export/dashboard-portfolio.ts
  - lib/repositories/dashboard-filter-state.repo.ts
  - app/api/dashboards/portfolio/route.ts
  - app/api/dashboards/portfolio/filters/route.ts
  - app/api/dashboards/portfolio/export/route.ts
  - app/api/dashboards/portfolio/export/schema.ts
  - app/api/dashboards/pm/route.ts
  - app/api/dashboards/pm/filters/route.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-08-26T14:30:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 16 dashboard backend is structurally sound: portfolio routes are CPMO-only (`withCpmo` + `assertCompanyWrite`), PM routes require non-null `company_id` and pm/cpmo role with assignment-scoped `listProjects`, drill-down/KPI filtering respects the filtered project set, export reuses `buildPortfolioDashboard` (no cross-company leak path), and there is no `getPortfolioSummary` or `getPeriodTracking` reuse on the PM path. RAG normalization and G+A+R = active invariants hold in `kpi.ts`/`rag.ts`.

Two warnings affect KPI/display correctness for edge-case data; no security blockers or tenant-isolation defects were found.

## Warnings

### WR-01: `pm_name` ignores assigned PM when `projects.pm_name` is populated

**File:** `lib/services/spec-dashboards.service.ts:53-56`
**Issue:** `enrichProjectListRows` prefers `p.pm_name` over the active primary assignment's user display name. `getActivePrimaryAssignment` returns `PmAssignmentRow` (no `display_name` column), so the cast to `{ display_name?: string }` is always undefined in production. When `projects.pm_name` is stale but `pm_user_id` comes from the assignment, the list/export shows the wrong PM name while PM filters still work.
**Fix:** Join `users` in `getActivePrimaryAssignment` (or a thin wrapper) and prefer assignment display name when present:

```typescript
const pmName =
  (primary as { display_name?: string } | null)?.display_name ??
  (p.pm_name as string | undefined) ??
  null;
```

### WR-02: Active KPI excludes lowercase `'active'` status from DB default

**File:** `lib/dashboards/rag.ts:15-16`
**Issue:** `isActiveProject` requires exact `status === 'Active'`, but `projects.status` schema default is lowercase `'active'` and `createProject` INSERT omits status, so newly created projects that were never edited via project master will not appear in `active_count`, on-track, watch/act, or RAG chart buckets. Filter `status: 'Active'` has the same blind spot.
**Fix:** Normalize status before compare (e.g. case-insensitive Active check) or backfill/set `'Active'` on create in project master — align with D-02 intent without breaking Closed/Completed casing:

```typescript
export function isActiveProject(p: { status: string; stage: string | null | undefined }): boolean {
  return p.status.toLowerCase() === 'active' && ACTIVE_STAGES.includes(p.stage as (typeof ACTIVE_STAGES)[number]);
}
```

## Info

### IN-01: Stored filter blob re-parsed without value-type validation on GET

**File:** `lib/services/spec-dashboards.service.ts:119-120`
**Issue:** Portfolio/PM GET reads `filters_json` from DB and passes it through `parseDashboardFilters`, which validates keys but not value types. A manually corrupted blob (e.g. `portfolio_year: "2026"` string) would silently match zero rows. PUT routes use Zod, so normal writes are safe.
**Fix:** Optionally run stored filters through `dashboardFiltersSchema.safeParse` on read and fall back to `{}` on failure.

---

_Reviewed: 2026-08-26T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
