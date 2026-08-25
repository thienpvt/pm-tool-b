# Phase 13: Review Fix Tasks

Derived from `13-REVIEW.md` critical findings. All CR/WR items applied 2026-08-26.

- CR-01: `raidSnapshotToDraftJson` maps `snapshot.raid` master rows back to draft entries.
- CR-02: `submitWeeklyReport` wraps RAID writes + version insert + finalize in `runInTransaction` (ALS so `getDb()` joins the same client). Integration test asserts risk rollback.
- WR-01: `withPgTransaction` delegates to `runInTransaction` / the `getDb()` pool.
- WR-02: `SELECT … FOR UPDATE` on the shell + `23505` → `ConflictError`.

---

Derived from `13-REVIEW.md` critical findings. Execute in order; CR-02 depends on transaction infrastructure from WR-01 fix.

## CR-01 — Restore RAID draft on correction open

**Files:** `lib/services/weekly-reports.service.ts`, `lib/services/weekly-reports.service.unit.test.ts`

1. Add `raidSnapshotToDraftJson(snapshot)` helper that:
   - Returns `snapshot.draft_raid_json` when present (backward compat with 13-02 snapshots).
   - Otherwise maps `snapshot.raid.risks` / `snapshot.raid.issues` master rows to `{ id: number, fields: Omit<row, 'id'> }` entries.
2. Update `snapshotToDraftFields` to use the helper for `draft_raid_json`.
3. Add unit test: mock `getLatestVersionSnapshot` with 13-03 shape (`raid: { risks: [{ id: 5, description: 'x', status: 'Open' }] }`, no `draft_raid_json`); assert `openCorrectionOnShell` receives `draft_raid_json.risks[0].id === 5`.

**Acceptance:** POST `/correct` on a report submitted with RAID populates editable `draft_raid_json`; correction resubmit can modify existing RAID entries without re-entry.

---

## CR-02 — Atomic submit transaction

**Files:** `lib/services/weekly-reports.service.ts`, `lib/repositories/weekly-reports.repo.ts`, optionally `lib/repositories/weekly-periods.repo.ts` (reuse transaction helper)

1. Introduce shared `runInTransaction(fn)` on the db layer (or extend `withPgTransaction` to use `getDb()` pool — see WR-01).
2. Add client-aware repo variants (or optional `client` param) for:
   - `insertWeeklyReportVersion`
   - `finalizeWeeklyReportSubmit`
3. Refactor `submitWeeklyReport` so RAID master writes + version insert + shell finalize share one transaction boundary **or** document and implement compensating rollback if RAID services cannot join the transaction (preferred: pass client into risk/issue repo writes for submit-only path).
4. Add unit/integration test: simulate `insertWeeklyReportVersion` failure after `createRisk`; assert no orphan risk row remains (or full rollback).

**Acceptance:** Partial submit failure leaves shell and RAID masters unchanged; retry does not duplicate `id: 'new'` entries.

---

## WR-01 — Unify DB connection for period creation (do with CR-02)

**Files:** `lib/repositories/weekly-periods.repo.ts`, `lib/db.ts` or `test/db.ts`

1. Remove standalone `Pool` construction in `withPgTransaction` (lines 41–59).
2. Route transactions through the same pool as `getDb()` / `testDb()`.
3. Ensure Vitest repo tests still pass without `getDb` mock drift.

**Acceptance:** `createPeriodWithShells` read and write paths always hit the same database; `_test` suffix policy applies uniformly in tests.

---

## WR-02 — Handle concurrent submit (after CR-02)

**Files:** `lib/services/weekly-reports.service.ts`, `lib/repositories/weekly-reports.repo.ts`

1. Inside submit transaction, `SELECT … FOR UPDATE` on the shell row before version increment.
2. Catch Postgres `23505` on version insert; map to `ConflictError`.

**Acceptance:** Double POST submit returns 409, not 500.

---

## Verification commands

```bash
npx vitest run lib/services/weekly-reports.service.unit.test.ts -x
npx vitest run lib/repositories/weekly-periods.repo.test.ts -x
npx vitest run app/api/projects/[id]/weekly-reports/route.access.test.ts -x
```
