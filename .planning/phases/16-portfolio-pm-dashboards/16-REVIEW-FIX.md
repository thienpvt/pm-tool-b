---
phase: 16-portfolio-pm-dashboards
fixed_at: 2026-08-26T14:34:00+07:00
review_path: .planning/phases/16-portfolio-pm-dashboards/16-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 16: Code Review Fix Report

**Fixed at:** 2026-08-26T14:34:00+07:00
**Source review:** `.planning/phases/16-portfolio-pm-dashboards/16-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 2
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: `pm_name` ignores assigned PM when `projects.pm_name` is populated

**Files modified:** `lib/repositories/pm-assignments.repo.ts`, `lib/services/spec-dashboards.service.ts`, `lib/services/spec-dashboards.service.unit.test.ts`
**Commit:** (see git log)
**Applied fix:** Joined `users.display_name` in `getActivePrimaryAssignment`; `enrichProjectListRows` now prefers assignment display name over stale `projects.pm_name`.

### WR-02: Active KPI excludes lowercase `'active'` status from DB default

**Files modified:** `lib/dashboards/rag.ts`, `lib/dashboards/filters.ts`, `lib/dashboards/kpi.unit.test.ts`, `lib/dashboards/filters.unit.test.ts`
**Commit:** (see git log)
**Applied fix:** Case-insensitive active status in `isActiveProject` and dashboard status filter; unit tests for lowercase `'active'`.

## Verification

Tests run in main checkout (isolation none):

```
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test \
  npx vitest run lib/dashboards/kpi.unit.test.ts lib/dashboards/filters.unit.test.ts lib/services/spec-dashboards.service.unit.test.ts
```

---

_Fixed: 2026-08-26T14:34:00+07:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
