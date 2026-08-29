---
phase: 27-nits-validation-operator-gate
fixed_at: 2026-08-29T03:06:00Z
review_path: .planning/phases/27-nits-validation-operator-gate/27-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-08-29T03:06:00Z
**Source review:** `.planning/phases/27-nits-validation-operator-gate/27-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: NIT-02 no-op test mocks away real repo snapshot drift

**Files modified:** `modules/projects/backend/repositories/milestones.repo.ts`, `modules/projects/backend/repositories/milestones.repo.test.ts`, `modules/projects/backend/services/milestones.service.unit.test.ts`
**Commit:** b63a494
**Applied fix:** `updateMilestone` now builds SET clause only for keys present on `body` (`name`, `start_date`, dual-write `plan_end`/`end_date`, `adjusted_end`). Empty SET returns existing row via `getMilestone` instead of issuing `.set({})`. Added repo test asserting `{ name: same }` PATCH preserves `start_date`, plus service unit test documenting that snapshot drift from repo still triggers audit.

### WR-02: `adjusted_end`-only PATCH skips audit with no regression test

**Files modified:** `modules/projects/backend/services/milestones.service.unit.test.ts`
**Commit:** 4534617
**Applied fix:** Added unit test asserting `auditLog` is not called when prior/updated rows differ only in `adjusted_end`, with comment citing D-02 / 27-RESEARCH pitfall 2 acceptance.

### WR-03: NIT-01 `codeLines` source scan can false-positive on comments/strings

**Files modified:** `modules/weekly/backend/services/nit-01-exports.contract.test.ts`
**Commit:** 3122ec0
**Applied fix:** Added `hasImportToken` helper using regex on `import { … token … } from` (multi-line aware). Consumer checks for `listPeriodShellsRepo` and `listOpenProjectDependencies` now require live import statements, not arbitrary source substrings.

## Verification

Tests ran in the isolated worktree (`.claude/worktrees/rf-27-33360-*`) with `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test`:

```
npx vitest run \
  modules/projects/backend/services/milestones.service.unit.test.ts \
  modules/weekly/backend/services/nit-01-exports.contract.test.ts \
  modules/projects/backend/repositories/milestones.repo.test.ts
```

**Result:** 3 files, 44 tests passed.

---

_Fixed: 2026-08-29T03:06:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
