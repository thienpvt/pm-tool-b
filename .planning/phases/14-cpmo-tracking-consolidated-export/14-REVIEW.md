---
phase: 14-cpmo-tracking-consolidated-export
reviewed: 2026-08-26T00:30:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - lib/services/weekly-tracking.service.ts
  - lib/export/consolidated-weekly.ts
  - lib/repositories/weekly-export.repo.ts
  - lib/repositories/weekly-reports.repo.ts
  - lib/db-weekly-reports.ts
  - app/api/weekly-periods/[periodId]/tracking/route.ts
  - app/api/weekly-periods/[periodId]/export/route.ts
  - app/api/weekly-periods/[periodId]/export/preview/route.ts
  - app/api/weekly-periods/[periodId]/export/schema.ts
  - app/api/weekly-periods/[periodId]/export/preview/schema.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: warnings_fixed
---

# Phase 14: Code Review Report

**Reviewed:** 2026-08-26T00:30:00Z  
**Depth:** standard  
**Files Reviewed:** 10  
**Status:** issues_found

## Summary

Phase 14 delivers CPMO period tracking and consolidated export with the intended security posture: all three routes use `withCpmo`, services call `assertCompanyWrite` plus `getWeeklyPeriodByCompany` tenant checks, export reads only `weekly_report_versions.snapshot` (not live RAID or v1 `/api/export/weekly-report/[id]`), tracking counts are computed before filters, and export logs are append-only with `data_version` populated.

No blocker-tier defects were found in the targeted checklist (cross-company IDOR, live RAID leak, missing auth gates, count shrink-on-filter, physical DELETE, missing `data_version`). Four warnings remain around filename/header hardening, missing-version silent export, duplicate `project_ids`, and unvalidated `periodId` path params.

## Narrative Findings (AI reviewer)

### Checklist verification (no finding — passed)

| Check | Verdict | Evidence |
|-------|---------|----------|
| Cross-company period IDOR | **Pass** | `getWeeklyPeriodByCompany(companyId, periodId)` + `listPeriodShellsRepo` join on `weekly_periods.company_id`; service rejects `actor.company_id !== companyId` |
| Live RAID in export | **Pass** | Preview/export only call `getLatestVersionSnapshot`; `assembleSnapshotSections` reads `snapshot.raid`; no `risks`/`issues` repo calls on export path |
| v1 weekly-report export reuse | **Pass** | New `lib/export/consolidated-weekly.ts`; no import of v1 route or `getWeeklyProjectReport` |
| `withCpmo` / `assertCompanyWrite` | **Pass** | All three routes use `withCpmo`; all service entrypoints call `assertCompanyWrite` before DB reads |
| Filters shrinking counts | **Pass** | `buildCounts(allRows)` before `applyTrackingFilters`; unit test at `weekly-tracking.service.unit.test.ts:258` |
| Physical DELETE | **Pass** | `weekly_export_logs` INSERT-only; DDL has no DELETE helpers |
| Export log `data_version` | **Pass** | `Math.max(...latest_version)` passed to `insertWeeklyExportLog` and audit payload |
| Format validation | **Pass** | `periodExportSchema` Zod enum `xlsx \| docx \| pptx` at route boundary |

## Warnings

### WR-01: Content-Disposition filename lacks control-character sanitization

**File:** `lib/export/consolidated-weekly.ts:117-119`, `app/api/weekly-periods/[periodId]/export/route.ts:20`

**Issue:** `sanitizeConsolidatedFilename` strips filesystem metacharacters but not HTTP control characters (`\r`, `\n`, `\0`, `\t`). The export route embeds the result unencoded in `Content-Disposition: attachment; filename="..."`. While `display_name` is normally system-generated via `formatPeriodDisplayName`, any DB tampering or future editable display names could enable response-header injection or broken downloads.

**Fix:**
```typescript
export function sanitizeConsolidatedFilename(displayName: string, ext: string): string {
  const safe = displayName
    .replace(/[\u0000-\u001F\u007F]/g, '_') // strip control chars
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || 'consolidated';
  const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'xlsx';
  return `${safe} consolidated.${safeExt}`;
}
```
Prefer RFC 5987 `filename*` alongside `filename` for non-ASCII period names.

### WR-02: Missing version snapshot silently exports blank submitted reports

**File:** `lib/services/weekly-tracking.service.ts:263-264`, `306-307`

**Issue:** When `getLatestVersionSnapshot` returns `undefined` for a shell marked `submitted` with `latest_version >= 1`, the code substitutes `{}` and proceeds. Export/preview then produce an empty pack (no RAID, highlights, RAG) without error. This diverges from `weekly-reports.service.ts:519-520`, which throws `NotFoundError` for a missing version row, and can mislead CPMO that a compliant export was generated.

**Fix:**
```typescript
const snapshot = await getLatestVersionSnapshot(shell.report_id, shell.latest_version);
if (!snapshot) {
  throw new NotFoundError('Not found', 'weekly_report_version');
}
snapshotByReportId.set(shell.report_id, snapshot);
```

### WR-03: Duplicate `project_ids` allowed in preview/export body

**File:** `app/api/weekly-periods/[periodId]/export/schema.ts:4`, `export/preview/schema.ts:4`, `lib/services/weekly-tracking.service.ts:103-133`

**Issue:** Zod validates `project_ids` as a non-empty array of positive integers but does not enforce uniqueness. Body `{ project_ids: [100, 100] }` passes validation, passes `assertExportEligible`, and produces duplicate sections/sheets in the consolidated pack.

**Fix:**
```typescript
project_ids: z.array(z.number().int().positive()).min(1).refine(
  (ids) => new Set(ids).size === ids.length,
  { message: 'project_ids must be unique' },
),
```

### WR-04: Unvalidated `periodId` path parameter

**File:** `app/api/weekly-periods/[periodId]/tracking/route.ts:46-47`, `export/route.ts:8-9`, `export/preview/route.ts:8-9`

**Issue:** Routes coerce `periodId` with `Number(periodIdParam)` without checking `Number.isInteger(periodId) && periodId > 0`. Values like `abc` → `NaN` or `1.5` → `1.5` fall through to the service/DB layer, yielding ambiguous 404/500 instead of a consistent 400.

**Fix:**
```typescript
const periodId = Number(periodIdParam);
if (!Number.isInteger(periodId) || periodId <= 0) {
  return NextResponse.json({ error: 'Invalid periodId' }, { status: 400 });
}
```

## Info

### IN-01: Unused styling constants in consolidated export generator

**File:** `lib/export/consolidated-weekly.ts:33-34`

**Issue:** `PHASE_BG` and `PHASE_FONT` are declared but never referenced. Dead code adds noise when maintaining export styling.

**Fix:** Remove unused constants or wire them into section styling if intended.

### IN-02: `getLatestVersionSnapshot` has no tenant guard at repo layer

**File:** `lib/repositories/weekly-reports.repo.ts:343-354`

**Issue:** Snapshot fetch is keyed only by `(report_id, version)` with no join to `weekly_periods.company_id`. Phase 14 service layer validates shells before calling, so this is not exploitable via the new routes today, but a future caller that skips eligibility checks could read cross-tenant snapshots by report ID.

**Fix:** Add an optional `companyId` parameter and join `weekly_reports → weekly_periods` in the SQL, or expose snapshot reads only through a company-scoped service wrapper.

---

_Reviewed: 2026-08-26T00:30:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
