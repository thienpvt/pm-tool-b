---
phase: 24-repo-wide-module-split
fixed_at: 2026-08-28T14:30:00Z
review_path: .planning/phases/24-repo-wide-module-split/24-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
verification_environment: isolated worktree (.claude/worktrees/rf-24--)
---

# Phase 24: Code Review Fix Report

**Fixed at:** 2026-08-28T14:30:00Z
**Source review:** `.planning/phases/24-repo-wide-module-split/24-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-03; IN-01 skipped per scope)
- Fixed: 5
- Skipped: 0

**Verification:** `npx vitest run` on four module-split contract test files (114 tests) passed in the isolated worktree. `npx tsc --noEmit` reported no errors in `handlers.ts` files (pre-existing unrelated tsc noise in admin UI files only).

## Fixed Issues

### CR-01: Wave 6 P3 handler files are syntactically invalid

**Files modified:** 14 `handlers.ts` files under `modules/projects/backend/routes/projects/[id]/`
**Commit:** `8fcb670`
**Applied fix:** Re-extracted handler bodies from pre-split git originals (`78f54d9^`). Each handler is now a plain async function with complete module service imports, no orphaned `withProjectAccess`/`{ schema: ... }` fragments, and `_req.url` (not bare `req.url`) where the request URL is needed.

### CR-02: P3 route shells dropped Zod validation on mutating methods

**Files modified:** 9 `app/api/projects/[id]/**/route.ts` shells
**Commit:** `469aa75`
**Applied fix:** Reattached `{ schema: ... }` to `withProjectAccess` on mutating exports per the CR-02 table (benefits PATCH, bugs POST, documents POST/PUT, stakeholders PATCH, dependencies PATCH, escalations PUT, holidays POST, milestone epics POST, milestone PUT).

### WR-01: Stale portfolio contract tests reference deleted lib/services paths

**Files modified:** `modules/portfolio/backend/portfolio-module-split.test.ts`
**Commit:** `297c67d`
**Applied fix:** Retargeted D-03 contract assertions to `modules/projects/backend/services/roi.service.ts` and `projects.service.ts`.

### WR-02: app/api integration tests mock deleted @/lib/services paths

**Files modified:** `modules/operations/backend/operations-module-split.test.ts`, `modules/admin/backend/admin-module-split.test.ts`
**Commit:** `9e51a40`
**Applied fix:** Route tests were already moved to module paths with correct `vi.mock('@/modules/*/backend/services/*')` targets (no stale `app/api/operations/**` or `app/api/admin/**` test files remain). Added D-09 contract assertions that module route tests mock module service paths and do not reference deleted `@/lib/services/operations.service` or `@/lib/services/admin-platform.service`.

### WR-03: projects-module-split.test.ts passes despite handler syntax errors

**Files modified:** `modules/projects/backend/projects-module-split.test.ts`, `modules/projects/backend/routes/projects/[id]/roi/handlers.ts`
**Commit:** `6fa6200`
**Applied fix:** Added P3 Wave 6 smoke checks on all 14 previously broken handlers plus a repo-wide scan of every `handlers.ts` under `projects/[id]/` (no dangling imports, no orphaned `{ schema:`, no bare `req.url` when param is `_req`). Fixed latent `_req`/`req.url` mismatch in `roi/handlers.ts` caught by the new assertion.

---

_Fixed: 2026-08-28T14:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
