---
phase: 17-document-templates-confluence-checklist
fixed_at: 2026-08-26T15:14:00Z
review_path: .planning/phases/17-document-templates-confluence-checklist/17-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-08-26T15:14:00Z
**Source review:** `.planning/phases/17-document-templates-confluence-checklist/17-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

**Verification:** Unit tests run in main checkout (`workflow.use_worktrees=false` / isolation none). `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/pm_tool_test`. Vitest 4, 51/51 passed in `projects.service.unit.test.ts` and `project-document-checklist.service.unit.test.ts`.

## Fixed Issues

### CR-01: Stage-change checklist generation uses actor company, not project owner company

**Files modified:** `lib/services/projects.service.ts`, `lib/services/projects.service.unit.test.ts`
**Commit:** `85be0e9`
**Applied fix:** `generateProjectChecklist` on stage change now uses `Number(current.company_id)` with finite validation instead of `actor.company_id`.

### WR-01: Checklist PATCH rules validate body only, not merged state

**Files modified:** `lib/services/project-document-checklist.service.ts`, `lib/services/project-document-checklist.service.unit.test.ts`
**Commit:** `85be0e9`
**Applied fix:** Merge existing row with PATCH body before `assertChecklistPatchRules`; `buildUpdateFields` falls back to existing approval fields when status stays `approved`.

### WR-02: Status downgrade leaves stale approval metadata

**Files modified:** `lib/services/project-document-checklist.service.ts`, `lib/services/project-document-checklist.service.unit.test.ts`
**Commit:** `85be0e9`
**Applied fix:** Clear `approved_at`/`approved_by` when leaving `approved`; clear `na_reason` when leaving `not_applicable`.

### WR-03: Null or empty project stage bypasses mandatory-incomplete guard

**Files modified:** `lib/services/projects.service.ts`, `lib/services/projects.service.unit.test.ts`
**Commit:** `85be0e9`
**Applied fix:** Treat null/empty `project.stage` as `'ALL'` for mandatory-incomplete filtering.

---

_Fixed: 2026-08-26T15:14:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
