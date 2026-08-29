---
phase: 27-nits-validation-operator-gate
reviewed: 2026-08-29T03:02:00Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - modules/projects/backend/services/milestones.service.ts
  - modules/projects/backend/services/milestones.service.unit.test.ts
  - modules/weekly/backend/services/nit-01-exports.contract.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 27: Code Review Report

**Reviewed:** 2026-08-29T03:02:00Z
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Deep review of Phase 27 production changes: NIT-01 export contract test (27-01) and NIT-02 `snapshotsEqual` guard on `updateMilestone` (27-02). Traced PATCH → service → repo → audit call chain; compared against D-01..D-06, PLANs, and RESEARCH pitfalls.

Implementation matches locked decisions: local `snapshotsEqual` (no `projects.service` import), repo UPDATE always runs, create/cancel still always audit, contract test uses static imports plus `codeLines` source scans per plan. All 24 vitest cases pass.

No BLOCKER defects in the reviewed files. Three WARNINGs: NIT-02 unit mocks mask real repo snapshot drift on partial PATCH bodies (limiting noise-reduction in production); `adjusted_end`-only updates skip audit by design but lack a regression test; NIT-01 source-scan helper has a brittle false-positive surface. Two INFO items on duplication and contract coverage gaps.

## Narrative Findings (AI reviewer)

### WR-01: NIT-02 no-op test mocks away real repo snapshot drift

**File:** `modules/projects/backend/services/milestones.service.unit.test.ts:131-145`
**Issue:** The NIT-02 test mocks `updateMilestoneRepo` to return the same object as `getMilestoneRepo`. In production, `milestones.repo.updateMilestone` always sets `name` and `start_date` on every UPDATE (`milestones.repo.ts:80-81`). A partial PATCH such as `{ name: 'M' }` when the name is unchanged sets `start_date` to `null` when omitted, so `auditSnapshot(updated)` differs from `auditSnapshot(prior)` even for user-intended no-ops. The guard is coded correctly, but the test gives false confidence that NIT-02 reduces audit noise for typical PATCH payloads.
**Fix:** Extend the no-op test (or add an integration test) so `updateMilestoneRepo` returns a row that reflects real repo normalization — e.g. prior with `start_date: '2026-01-01'`, updated with `start_date: null` after `{ name: 'M' }` — and assert expected behavior explicitly. If skip-on-no-op is required for partial bodies, fix belongs in `milestones.repo.ts` (merge omitted fields from prior row before SET).

### WR-02: `adjusted_end`-only PATCH skips audit with no regression test

**File:** `modules/projects/backend/services/milestones.service.ts:15-24,74-84`
**Issue:** `auditSnapshot` omits `adjusted_end` (accepted per 27-RESEARCH pitfall 2 / A1). A PATCH that changes only `adjusted_end` produces identical before/after snapshots, so `auditLog` is skipped. That matches D-02 scope but is a repudiation gap: CPMO audit viewer will not record adjusted-end edits. No unit test documents or locks this behavior; a future widening of `auditSnapshot` could regress silently.
**Fix:** Add an explicit unit test: prior and updated rows differ only in `adjusted_end`, assert `auditLog` is not called, with a comment citing D-02 / pitfall 2 acceptance. If CPMO needs adjusted-end history, add `adjusted_end` to `auditSnapshot` in a follow-up.

### WR-03: NIT-01 `codeLines` source scan can false-positive on comments/strings

**File:** `modules/weekly/backend/services/nit-01-exports.contract.test.ts:10-14,31-38`
**Issue:** `codeLines` drops lines starting with `//` or `*` only. Inline block comments (`/* listPeriodShellsRepo */`), trailing comments, or string literals containing the token would satisfy `.includes('listPeriodShellsRepo')` without a live import. Current consumer files use real imports (verified), but the contract is weaker than a static import or AST parse.
**Fix:** Prefer verifying actual import statements (regex on `import { … listPeriodShellsRepo … } from` or `import(…)`), or statically import consumer modules in the contract test where feasible without pulling heavy side effects.

## Info

### IN-01: Duplicated `snapshotsEqual` algorithm

**File:** `modules/projects/backend/services/milestones.service.ts:27-32`
**Issue:** `snapshotsEqual` is a copy of `projects.service.ts:44-49`. Plan chose this deliberately (avoid unit-graph import), but JSON.stringify semantics can drift if one copy changes.
**Fix:** Optional shared helper in a neutral module (e.g. `lib/audit-snapshot.ts`) if more services adopt the pattern.

### IN-02: Contract test omits `weekly-reports.service.unit.test.ts` consumer

**File:** `modules/weekly/backend/services/nit-01-exports.contract.test.ts:21-39`
**Issue:** 27-RESEARCH lists `weekly-reports.service.unit.test.ts` as a `listPeriodShells` consumer. Contract test verifies export definition and `listPeriodShellsRepo` in dashboards/tracking only. Acceptable per 27-01 PLAN interfaces, but `listPeriodShells` service wrapper could lose its last dedicated test reference without failing the contract.
**Fix:** Add a source-scan assertion on `weekly-reports.service.unit.test.ts` for `listPeriodShells` if the service wrapper must stay exercised.

---

_Reviewed: 2026-08-29T03:02:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
