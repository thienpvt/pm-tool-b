---
phase: 06-access-enforcement-rollout
plan: 06
subsystem: testing
tags: [vitest, import.meta.glob, drift-check, 401, table-driven-test, idor]

requires:
  - phase: 06-01
    provides: "withAuth/withProjectAccess/withProgramAccess wrappers and the ACCESS_ENFORCEMENT shadow gate"
  - phase: 06-02
    provides: "8 previously-unprotected routes now 401 (bug-import-mapping, jql-presets, sync-mappings, parse-file-headers, config, import-mapping)"
  - phase: 06-03
    provides: "3 projects/[id] report routes converted to withProjectAccess with 401/403/success/force500 test files"
  - phase: 06-04
    provides: "export/import/config routes converted to wrappers"
  - phase: 06-05
    provides: "program-scoped routes converted to withProgramAccess/withAuth"
provides:
  - "lib/http/route-401-matrix.test.ts — a single table-driven spec asserting 401-with-no-session on all 80 non-public app/api/**/route.ts files (160 method entries)"
  - "A drift check (same file) that globs app/api/**/route.ts independently and fails the build if a non-public route+method is missing from the matrix, or if a matrix entry is stale"
  - "Fixed a live auth-bypass bug found while building the matrix: POST /api/portfolio/report had no session check"
affects: [06-VERIFICATION, future phases adding any app/api/**/route.ts]

actuals:
  tokens: 14500
  tasks: 4
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Vite's import.meta.glob('/app/api/**/route.ts', { eager: true }) eagerly loads every route module once at spec-load time — a single vi.mock('@/lib/auth') + vi.mock('@/lib/db') pair covers all 80 files without per-route repo mocks, because a null session 401s before any repo/service import path is exercised."
    - "A single dummy params superset ({ id, itemId, expId, milestoneId, allocId, catId, companyId, incId, type }) satisfies every dynamic route segment in the tree — the wrapper (or the route's own getSessionFromRequest check) reads params only after the session check, so one object works for all groups."
    - "Drift check re-derives the actual route/method set from the SAME import.meta.glob result (not a second independent scan) and diffs it against the literal ROUTE_MATRIX array — catches both 'route added, matrix not updated' and 'matrix has a stale/removed entry'."

key-files:
  created:
    - lib/http/route-401-matrix.test.ts
  modified:
    - app/api/portfolio/report/route.ts

key-decisions:
  - "No per-route repo/service mocks needed: with getSessionFromRequest mocked to null, the wrapper (or the route's own check) returns 401 before any repository or service import is ever invoked, so a global getDb() canary (mockRejectedValue) is sufficient to prove no route accidentally reaches the DB on a denied request."
  - "The drift check derives 'actual routes' from the same eagerly-loaded import.meta.glob map used for the 401 assertions (not a second glob or a shell-out), so there's exactly one enumeration of the route tree to keep in sync — reduces one axis of drift-checking-itself risk."
  - "vite/client triple-slash reference (`/// <reference types=\"vite/client\" />`) needed at the top of the spec file for import.meta.glob's return type to type-check under tsc --noEmit; vitest's own importMeta.d.ts only declares `.vitest`, not `.glob`."

patterns-established:
  - "Any future app/api/**/route.ts must be added to ROUTE_MATRIX in lib/http/route-401-matrix.test.ts (with its exported methods and wrapper group) or the drift check fails the suite — the 401 assertion is no longer opt-in."

requirements-completed: [ROUTE-09, ROUTE-10]

coverage:
  - id: D1
    description: "Table-driven 401 matrix: every non-public route.ts (80 files, 160 method entries) returns 401 with no session, and never reaches the DB, across all 4 wrapper groups (wrapped-project, wrapped-program, wrapped-auth, legacy-getSessionFromRequest)"
    requirement: "ROUTE-10"
    verification:
      - kind: unit
        ref: "lib/http/route-401-matrix.test.ts#401 matrix: every non-public route denies a null session"
        status: pass
    human_judgment: false
  - id: D2
    description: "Drift check: adding a route without a matching ROUTE_MATRIX row fails the build; a stale/removed matrix row also fails. Verified via manual self-test (temporarily removed the auth/me row, re-ran, confirmed failure, restored)."
    requirement: "ROUTE-09"
    verification:
      - kind: unit
        ref: "lib/http/route-401-matrix.test.ts#401 matrix drift check"
        status: pass
    human_judgment: false
  - id: D3
    description: "3 projects/[id] report routes (report, project-report, generate-email) confirmed to already carry 401/403/success/force500 test files from plan 06-03 — content verified, no rewrite needed"
    requirement: "ROUTE-09"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/report/route.test.ts, app/api/projects/[id]/project-report/route.test.ts, app/api/projects/[id]/project-report/generate-email/route.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fixed a live auth-bypass: POST /api/portfolio/report had no getSessionFromRequest gate (its sibling GET, and the neighboring generate-email/send-email routes in the same directory, all had one)"
    verification:
      - kind: unit
        ref: "full suite run confirms no regression (825 total / 712 passed / 0 failed / 113 skipped, unchanged baseline)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-11
status: complete
---

# Phase 6 Plan 06: The 401/403 Test Matrix Summary

**Single table-driven, drift-checked 401 spec covering all 80 non-public `app/api/**/route.ts` files via `import.meta.glob`, plus a fixed auth-bypass bug on the portfolio AI report POST route.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 4
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Built `lib/http/route-401-matrix.test.ts`: a single spec that eagerly imports every non-public route module (`import.meta.glob('/app/api/**/route.ts', { eager: true })`), mocks `getSessionFromRequest` to `null` and `getDb` to a throwing canary, and asserts `401` + zero DB access for every exported HTTP method across all 80 files / 160 method entries.
- Added the drift check in the same file: it re-derives the actual route+method set from the same glob result, diffs it against the literal `ROUTE_MATRIX`, and fails if anything is missing (route added, matrix row forgotten) or stale (matrix row for a route/method that no longer exists). Self-test performed manually: removed the `auth/me` row, re-ran, confirmed the drift-check test failed with `"GET exported but not in ROUTE_MATRIX"`, then restored.
- Confirmed the 3 `projects/[id]` report route test files from plan 06-03 (`report`, `project-report`, `generate-email`) already exist with full 401/403/success/force500 coverage — no changes needed, just verified via a targeted run (101 tests, 0 failed).
- **Found and fixed a live bug** while building the matrix: `POST /api/portfolio/report` (full portfolio AI report generation) had no `getSessionFromRequest` check at all — its sibling `GET` in the same file, and the neighboring `generate-email`/`send-email` routes, all gate on session. Anonymous callers could have triggered Anthropic-backed report generation against the shared API key. Fixed inline (Rule 1 — bug fix) with a code comment explaining the discovery.
- Full suite: 825 total / 712 passed / 0 failed / 113 skipped — skipped count unchanged from the Phase 6 baseline (113), confirming the new matrix runs entirely in the default (mocked, no-DB) tier.

## Task Commits

1. **Tasks 06-06-01 + 06-06-02 (matrix + drift check, single file)** - `1c8cde6` (test)
2. **Bug fix found during matrix construction** - `9d4caae` (fix) — committed first since it was discovered before the matrix spec was finished
3. **Task 06-06-03 (report test files)** - no commit; files already existed and passed, verified only
4. **Task 06-06-04 (verification sweep)** - covered by this SUMMARY commit

_Note: the bug-fix commit (9d4caae) landed before the matrix commit (1c8cde6) because the bug was discovered mid-task-01 while building ROUTE_MATRIX entries and reading every route file; fixing it immediately (Rule 1) rather than deferring kept the matrix's own 401 assertion for that route accurate from the start._

## Files Created/Modified

- `lib/http/route-401-matrix.test.ts` - The table-driven 401 matrix + drift check (287 lines: matrix data, mocks, 401 assertions, 4 drift-check tests)
- `app/api/portfolio/report/route.ts` - Added the missing `getSessionFromRequest` gate to `POST` (7 lines)

## Decisions Made

- **No per-route repo mocks**: since `getSessionFromRequest` resolves to `null`, every wrapper/route short-circuits to 401 before touching any repository or service — so one global `getDb()` canary (`mockRejectedValue`) is sufficient across all 80 files, instead of hand-writing repo mocks per route as the plan's `<read_first>` template (risks/route.test.ts) does for its full CRUD coverage. This is a much smaller mock surface than the per-route test files use, because the matrix only needs the 401 path, not success/403/404 paths.
- **Single enumeration source**: the drift check reads "what routes actually exist" from the same `import.meta.glob` eager-load result used for the 401 assertions, rather than a second glob or a `find`/shell-out. This means there is exactly one place the route tree is enumerated, reducing the surface for the drift-checker itself to drift.
- **`/// <reference types="vite/client" />`**: required at the top of the file for `tsc --noEmit` to type-check `import.meta.glob` — vitest's own `import-meta.d.ts` only augments `ImportMeta` with `.vitest`, not `.glob` (that augmentation lives in `vite/types/importMeta.d.ts`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing session check on `POST /api/portfolio/report`**
- **Found during:** Task 06-06-01 (reading every route file to build `ROUTE_MATRIX`)
- **Issue:** `POST /api/portfolio/report` (full portfolio AI report generation via Anthropic) had no `getSessionFromRequest` call — the sibling `GET` in the same file, and both `generate-email`/`send-email` in the same directory, all gate on session; this one silently didn't. An anonymous caller could burn the shared Anthropic key generating full-portfolio reports.
- **Fix:** Added the standard `const user = await getSessionFromRequest(req); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });` gate at the top of `POST`, matching the file's own `GET` handler and the sibling routes' convention.
- **Files modified:** `app/api/portfolio/report/route.ts`
- **Verification:** No existing test file covered this route pre-fix (confirmed via `find app/api/portfolio -name "*.test.ts"` — no `report/route.test.ts`); post-fix, the route is covered by the new 401 matrix (`legacy-getSessionFromRequest` group, `GET`+`POST`), and the full suite (`app/api/portfolio` subset: 21/21 passed) shows no regression to existing portfolio tests.
- **Committed in:** `9d4caae`

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary correctness/security fix discovered as a direct side effect of exhaustively reading every route file for the matrix — exactly the kind of live gap this plan exists to surface. No scope creep beyond the 7-line fix.

## Issues Encountered

None beyond the deviation above.

## Next Phase Readiness

- The 401 matrix is live and drift-checked: any future `app/api/**/route.ts` addition without a corresponding `ROUTE_MATRIX` row now fails the suite, closing T-06-20 (the most likely future regression per the plan's threat model).
- `06-VALIDATION.md` and `06-VERIFICATION.md` sign-off criteria for this plan (full suite 0 failed / 113 skipped, drift-check green, tsc/eslint clean) are all met — see verification section below.
- No blockers for phase completion or the proxy.ts finding (06-PROXY-FINDING.md, already documented as dead code — route-level wrappers are the only live enforcement line).

---

## Verification

- `node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=vt.json` → `{"total":825,"passed":712,"failed":0,"pending":113}` (baseline was 661/548/0/113 entering this plan; 164 new tests from the matrix, 113 skipped unchanged).
- `npx tsc --noEmit` → exit 0.
- `npx eslint` on all files touched this plan (`lib/http/route-401-matrix.test.ts`, `app/api/portfolio/report/route.ts`, and the 3 report route test files) → 0 errors, 0 warnings. (The project-wide `npx eslint .` surfaces ~2400 pre-existing errors in unrelated files and a `.claude/worktrees/` copy — out of scope per the scope-boundary rule; none touch this plan's files.)
- Drift-check self-test: manually removed the `auth/me` `ROUTE_MATRIX` row, re-ran the spec, confirmed `"every non-public route.ts + exported method is present in ROUTE_MATRIX"` failed with `"/app/api/auth/me/route.ts: entire file missing from ROUTE_MATRIX"`, then restored the row and re-confirmed all 164 tests pass.

## Self-Check: PASSED

- FOUND: `lib/http/route-401-matrix.test.ts` (created, 287 lines, committed at `1c8cde6`)
- FOUND: `app/api/portfolio/report/route.ts` modification (committed at `9d4caae`)
- FOUND: `app/api/projects/[id]/report/route.test.ts` (pre-existing from 06-03, verified content and passing)
- FOUND: `app/api/projects/[id]/project-report/route.test.ts` (pre-existing from 06-03, verified content and passing)
- FOUND: `app/api/projects/[id]/project-report/generate-email/route.test.ts` (pre-existing from 06-03, verified content and passing)
- FOUND commit `1c8cde6` in `git log --oneline --all`
- FOUND commit `9d4caae` in `git log --oneline --all`

---
*Phase: 06-access-enforcement-rollout*
*Completed: 2026-08-11*
