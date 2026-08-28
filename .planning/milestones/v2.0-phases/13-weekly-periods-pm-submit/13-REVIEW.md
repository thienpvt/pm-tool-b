---
phase: 13-weekly-periods-pm-submit
reviewed: 2026-08-26T06:55:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - lib/db-weekly-reports.ts
  - lib/iso-week.ts
  - lib/repositories/weekly-periods.repo.ts
  - lib/repositories/weekly-reports.repo.ts
  - lib/services/weekly-reports.service.ts
  - lib/services/errors.ts
  - lib/api-errors.ts
  - app/api/weekly-periods/route.ts
  - app/api/weekly-periods/schema.ts
  - app/api/weekly-periods/config/route.ts
  - app/api/weekly-periods/config/schema.ts
  - app/api/projects/[id]/weekly-reports/route.ts
  - app/api/projects/[id]/weekly-reports/[reportId]/route.ts
  - app/api/projects/[id]/weekly-reports/[reportId]/schema.ts
  - app/api/projects/[id]/weekly-reports/[reportId]/submit/route.ts
  - app/api/projects/[id]/weekly-reports/[reportId]/correct/route.ts
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: fixed
---

# Phase 13: Code Review Report

**Reviewed:** 2026-08-26T06:55:00Z  
**Depth:** deep  
**Files Reviewed:** 16  
**Status:** issues_found

## Summary

Reviewed Phase 13 weekly periods and PM submit implementation against D-08–D-18 security and data-integrity contracts. Access control (`withCpmo`, `assertProjectWriteAccess`, company-scoped `listPeriodShells`), progress_pct copy-at-submit (no write-back), RAID-on-submit-only (not on PATCH), pre-write validation, physical DELETE absence, and version snapshot immutability are correctly implemented.

Two critical defects remain: correction flow loses RAID draft state after 13-03 snapshot shape change, and submit is non-atomic so partial failures can duplicate RAID master rows on retry. Two warnings cover test/prod connection divergence in `withPgTransaction` and concurrent submit races.

## Critical Issues

### CR-01: Correction wipes RAID draft — `snapshot.raid` not mapped to `draft_raid_json`

**File:** `lib/services/weekly-reports.service.ts:188-208,464-491`  
**Issue:** 13-03 submit stores locked RAID in `snapshot.raid` (master row copies), not `snapshot.draft_raid_json`. `openWeeklyReportCorrection` calls `snapshotToDraftFields`, which only reads `snapshot.draft_raid_json ?? null`. Opening correction on any report submitted under 13-03 sets `draft_raid_json` to `null`, wiping the shell's prior draft RAID and preventing RAID edits during correction unless the PM re-enters everything manually. This violates D-08 ("copy latest snapshot into draft columns") and breaks the correction → resubmit loop for RAID (WKRP-05).

**Fix:**
```typescript
function raidSnapshotToDraftJson(snapshot: Record<string, unknown>): unknown | null {
  if (snapshot.draft_raid_json != null) return snapshot.draft_raid_json;
  const raid = snapshot.raid;
  if (!raid || typeof raid !== 'object') return null;
  const { risks, issues } = raid as { risks?: unknown[]; issues?: unknown[] };
  const toEntry = (row: unknown) => {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'number' ? r.id : null;
    if (id == null) return null;
    const { id: _id, ...fields } = r;
    return { id, fields };
  };
  return {
    risks: (Array.isArray(risks) ? risks : []).map(toEntry).filter(Boolean),
    issues: (Array.isArray(issues) ? issues : []).map(toEntry).filter(Boolean),
  };
}

function snapshotToDraftFields(snapshot: Record<string, unknown>): DraftUpdateFields {
  // ... existing nearest_milestone mapping ...
  return {
    // ... existing fields ...
    draft_raid_json: raidSnapshotToDraftJson(snapshot),
  };
}
```

Add a unit test where `getLatestVersionSnapshot` returns a 13-03-shaped snapshot (`raid: { risks: [...] }`, no `draft_raid_json`) and assert `openCorrectionOnShell` receives reconstructed `draft_raid_json`.

### CR-02: Submit is non-atomic — RAID master writes before version insert

**File:** `lib/services/weekly-reports.service.ts:365-449`  
**Issue:** `submitWeeklyReport` validates, then calls `createRisk`/`updateRisk`/`createIssue`/`updateIssue` (each commits independently via `getDb()`), then inserts the version row and finalizes the shell. If `insertWeeklyReportVersion` or `finalizeWeeklyReportSubmit` fails after RAID writes succeed, the shell stays unsubmitted but masters are mutated. A retry re-processes `draft_raid_json` entries with `id: 'new'` and creates duplicate RAID rows. This is a data-integrity failure, not a transient UX glitch.

**Fix:** Wrap RAID writes + version insert + shell finalize in a single database transaction (pass `PoolClient` into repo helpers or add a `submitWeeklyReportTx` orchestrator). On any failure, roll back all steps. Alternative minimum mitigation: persist draft with assigned ids after first partial success (complex); prefer full transaction.

```typescript
// Pseudocode — extend repos to accept optional PoolClient
await withPgTransaction(async (client) => {
  // RAID writes via client-aware repo methods
  await insertWeeklyReportVersionTx(client, { ... });
  await finalizeWeeklyReportSubmitTx(client, { ... });
});
```

## Warnings

### WR-01: `withPgTransaction` diverges from `getDb()` URL resolution under Vitest

**File:** `lib/repositories/weekly-periods.repo.ts:41-59`  
**Issue:** `withPgTransaction` uses `process.env.VITEST ? (TEST_DATABASE_URL ?? DATABASE_URL) : DATABASE_URL`, while `getDb()` always uses `DATABASE_URL` and never reads `TEST_DATABASE_URL`. Current repo tests mock `getDb` to `testDb()`, so both paths hit the test DB today. Any future integration test that calls `createPeriodWithShells` without mocking `getDb` will read config from `DATABASE_URL` (possibly non-`_test`) while the transaction writes via `withPgTransaction`'s pool — a split-brain between read and write paths. `withPgTransaction` also lacks the `_test` suffix guard that `test/db.ts` enforces.

**Fix:** Remove the ad-hoc pool in `withPgTransaction`. Reuse `getDb()` (or `testPool()` in tests) and expose a transaction helper on the shared client, e.g. `runInTransaction(fn: (client) => Promise<T>)`, so all weekly-period reads and writes share one connection source and one safety policy.

### WR-02: Concurrent submit race surfaces as unhandled 500

**File:** `lib/services/weekly-reports.service.ts:425-449`, `lib/repositories/weekly-reports.repo.ts:220-234`  
**Issue:** Two concurrent POST `/submit` requests can both read `latest_version = N` and attempt to insert version `N+1`. The second hits the unique constraint on `(report_id, version)` and throws an unhandled Postgres error → generic 500. Correct outcome should be 409 Conflict or idempotent success.

**Fix:** Catch `23505` on version insert and throw `ConflictError('Report already submitted')`, or use `SELECT … FOR UPDATE` on the shell row at the start of submit inside the transaction from CR-02.

## Info

### IN-01: GET shell mutates database (`ensurePrevWeekRag`)

**File:** `lib/services/weekly-reports.service.ts:274-301`  
**Issue:** `getWeeklyReportShell` (GET route) calls `ensurePrevWeekRag`, which may `UPDATE weekly_reports SET prev_week_rag` on first read. Intended per D-07 but is a write-on-read side effect (audit, caching, read replicas).

**Fix:** Document as intentional, or lazy-fill only on first PATCH/submit instead of GET.

### IN-02: `listPeriodShellsRepo` is period-scoped only at repo layer

**File:** `lib/repositories/weekly-reports.repo.ts:371-383`, `lib/services/weekly-reports.service.ts:516-537`  
**Issue:** Repo query filters by `period_id` only. Service layer correctly enforces `assertCompanyWrite`, `actor.company_id === companyId`, and `getWeeklyPeriodByCompany` before calling the repo. No HTTP route exposes this yet (D-18). Defense-in-depth gap if a future caller invokes the repo directly.

**Fix:** Optional: add `company_id` join/filter in `listPeriodShellsRepo` or document repo as service-internal only.

---

## Focus-area checklist (requested)

| Area | Verdict |
|------|---------|
| Cross-company period/shell IDOR | **Pass** — `listPeriodShells` company match; shell queries scoped by `project_id`; period routes use `actor.company_id`; CPMO routes use `withCpmo` |
| progress_pct write-back | **Pass** — copied to snapshot/version only; `updateProject` called with `{ rag }` only when RAG differs |
| RAID writes on draft PATCH | **Pass** — `saveWeeklyReportDraft` persists `draft_raid_json` on shell only |
| Validation after RAID writes | **Pass** — `validateSubmitDraft` runs before RAID service calls |
| Physical DELETE | **Pass** — no DELETE routes or repo helpers on weekly tables |
| assertProjectWriteAccess / withCpmo | **Pass** — mutations call write access in service; period routes use `withCpmo` |
| Snapshot mutability after submit | **Pass** — INSERT-only version helper; PATCH blocked when `correction_open` false |
| TEST vs prod DB mixups | **Partial** — see WR-01; current repo tests safe via `getDb` mock |

---

_Reviewed: 2026-08-26T06:55:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
