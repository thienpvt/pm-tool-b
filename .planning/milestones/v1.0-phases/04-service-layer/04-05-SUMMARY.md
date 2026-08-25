---
phase: 04-service-layer
plan: 05
subsystem: services
tags: [access-control, idor, multi-tenant, budget, epics, allocations, gap-closure]

requires:
  - phase: 04-01
    provides: AccessActor, assertProjectAccess, serviceErrorResponse, repoErrorResponse, typed service errors
  - phase: 04-03
    provides: programs.service.ts (assertProgramAccess pattern), budget.service.ts (parent budget route fix)
  - phase: 02
    provides: PROJECT_COLUMNS allowlist, UnknownColumnError, buildUpdate
provides:
  - lib/services/projects.service.ts (getProject/updateProject/deleteProject)
  - lib/services/budget-items.service.ts (item + expense ops with ownership + scoping guards)
  - assertProgramAccess exported from programs.service.ts for cross-service reuse
  - Closed two live IDORs (epics GET, program-project-allocations POST/GET)
affects:
  - phase-05 route wrappers (both new services already throw Forbidden/NotFound/Validation)
  - Any future route reading/writing program_project_allocations must go through assertProgramAccess + assertProjectAccess

actuals:
  tokens: 16500
  tasks: 5
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Canonical assertProjectAccess replaces file-local checkAccess/authorize copies (one ownership implementation, not N divergent ones)"
    - "Two-sided ownership assert (assertProgramAccess AND assertProjectAccess) for cross-resource writes that touch both a program and a project"
    - "Repository-level scoping guard (getExpenseInItem) mirrors existing item<->project guard so a nested foreign child 404s instead of silently no-op'ing"
    - "UnknownColumnError propagates through the service layer untouched so the route's repoErrorResponse can still map it to 400-with-columns"

key-files:
  created:
    - lib/services/projects.service.ts
    - lib/services/projects.service.unit.test.ts
    - lib/services/budget-items.service.ts
    - lib/services/budget-items.service.unit.test.ts
    - app/api/projects/[id]/route.access.test.ts
    - app/api/projects/[id]/budget/[itemId]/route.access.test.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/route.test.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.test.ts
    - app/api/portfolio/roadmap/epics/route.test.ts
    - app/api/programs/[id]/project-allocations/route.test.ts
  modified:
    - app/api/projects/[id]/route.ts
    - app/api/projects/[id]/budget/[itemId]/route.ts
    - app/api/projects/[id]/budget/[itemId]/route.test.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/route.ts
    - app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.ts
    - app/api/portfolio/roadmap/epics/route.ts
    - app/api/programs/[id]/project-allocations/route.ts
    - lib/services/programs.service.ts
    - lib/repositories/budget.repo.ts

key-decisions:
  - "Kept the epics ownership gate inline in the route (assertProjectAccess directly) rather than a roadmap-epics.service.ts wrapper — plan explicitly allowed this for a thin single-endpoint gate"
  - "Added getExpenseInItem scoping guard beyond what the plan required for gap 2, mirroring the existing budget-item<->project guard, so a foreign expense delete 404s instead of silently deleting nothing"
  - "Fixed a GET-side read leak in project-allocations discovered during gap 4 investigation: programProjectAllocations looked up the program row by id alone with no company scoping"
  - "Exported assertProgramAccess from programs.service.ts (was module-private) so the allocations route reuses the exact same program-ownership logic instead of re-deriving it"

patterns-established:
  - "Route access-control test files use *.route.access.test.ts naming when a pre-existing *.route.test.ts already covers non-access behavior, to avoid merge conflicts on shared describe blocks"

requirements-completed: [SVC-01, SVC-04, SVC-07]

coverage:
  - id: D1
    description: "projects/[id] GET/PATCH/DELETE routed through projects.service.ts; checkAccess deleted"
    requirement: SVC-04
    verification:
      - kind: unit
        ref: lib/services/projects.service.unit.test.ts
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/route.access.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "PATCH {company_id} still 400-with-columns, not 403/404/500 (REPO-03/T-04-25 regression)"
    requirement: SVC-04
    verification:
      - kind: unit
        ref: app/api/projects/[id]/route.access.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Three nested budget-item routes routed through budget-items.service.ts; authorize() deleted; cross-company 401->403"
    requirement: SVC-04
    verification:
      - kind: unit
        ref: lib/services/budget-items.service.unit.test.ts
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/budget/[itemId]/route.access.test.ts
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/budget/[itemId]/expenses/route.test.ts
        status: pass
      - kind: unit
        ref: app/api/projects/[id]/budget/[itemId]/expenses/[expId]/route.test.ts
        status: pass
    human_judgment: false
  - id: D4
    description: "Live read IDOR closed: portfolio/roadmap/epics asserts project ownership before roadmapEpicRows"
    requirement: SVC-07
    verification:
      - kind: unit
        ref: app/api/portfolio/roadmap/epics/route.test.ts
        status: pass
    human_judgment: false
  - id: D5
    description: "Live write IDOR closed: program-project-allocations POST asserts BOTH program and project ownership before upsert; GET read-leak also gated"
    requirement: SVC-07
    verification:
      - kind: unit
        ref: app/api/programs/[id]/project-allocations/route.test.ts
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-08-11
status: complete
---

# Phase 4 Plan 05: Gap Closure — Leftover Access Gates and Two Live IDORs Summary

**Deleted the last two file-local access-control copies (`checkAccess` in `projects/[id]`, `authorize()` in three nested budget routes), routed both through new services, and closed two confirmed-live IDORs — a read IDOR on portfolio epics and a write IDOR on program-project allocations (plus an adjacent read leak found while fixing it).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-08-10T17:26:19Z
- **Completed:** 2026-08-10T17:27:30Z
- **Tasks:** 5/5
- **Files modified:** 19

## The Four Gaps — Closed

### Gap 1 — `projects/[id]/route.ts` inline `checkAccess` (T-04-24)

Deleted the file-local `checkAccess` (was at :8-18, used at :22/:35/:47). GET/PATCH/DELETE
now resolve the session and call new `lib/services/projects.service.ts`
(`getProject`/`updateProject`/`deleteProject`), each asserting ownership via the canonical
`assertProjectAccess` before touching `lib/repositories/projects.repo.ts`.

**No behavior change** for a legitimate caller — same 401/403/404/200 shapes. Critically,
`updateProject` does **not** catch `UnknownColumnError`; it propagates to the route's
`mapError` (checks `UnknownColumnError` first, falls through to `serviceErrorResponse`), so
`PATCH { company_id: 99 }` still returns `400 { columns: ['company_id'] }`, never 403/404/500
(T-04-25 regression test added and passing).

### Gap 2 — Three nested budget-item routes' `authorize()` copies (T-04-23)

`budget/[itemId]/route.ts`, `.../expenses/route.ts`, `.../expenses/[expId]/route.ts` each kept
an identical `authorize(req, projectId)` returning a nullable user, with handlers doing
`if (!await authorize(...)) return 401`. Deleted all three; each route now calls new
`lib/services/budget-items.service.ts`, which asserts project ownership first.

**BEHAVIOR CHANGE (HYG-02):** cross-company caller on any of the three routes now gets **403**
instead of **401** — matching what 04-03 already did to the parent `budget/route.ts`.

Bonus scoping guard added beyond the plan's minimum: `getExpenseInItem` (new repo function)
lets `deleteExpense` 404 when the expense belongs to a different item, instead of silently
running a `DELETE ... WHERE id=? AND budget_item_id=? AND project_id=?` that matches zero rows
and returns `{ ok: true }` regardless. Mirrors the existing item↔project guard already in
`createExpense` (`getBudgetItemInProject`).

### Gap 3 — Live read IDOR on `portfolio/roadmap/epics` (T-04-21, high)

`GET /api/portfolio/roadmap/epics?project_id=X` was session-gated but read any `project_id`
from the query string with zero ownership check — any authenticated user could read any
tenant's epic tree. Added `assertProjectAccess(projectId, actor)` immediately after the
`project_id required` 400, before `roadmapEpicRows` runs. All downstream logic
(`childrenByParent` bucketing, `weighted_pct`, the `no === 'EPIC'` filter, `statusPct`
fallbacks) is byte-identical.

**BEHAVIOR CHANGE:** cross-company `project_id` now returns 403 (was 200 with the foreign
project's epic tree).

While touching this file to satisfy the plan's eslint-clean requirement, replaced four
pre-existing `any` usages with a local `ActivityRow` type — no shape or behavior change,
just typed the same fields the route already destructured.

### Gap 4 — Live write IDOR on `programs/[id]/project-allocations` POST (T-04-22, high)

`upsertProgramProjectAllocation(programId, project_id, headcount)` ran with **no ownership
check on either side** — an authenticated user could allocate another tenant's project into
their own program. Exported `assertProgramAccess` from `programs.service.ts` (previously
module-private, already the canonical program-ownership check used by
`GET/PATCH/DELETE /api/programs/[id]`) and now call it alongside `assertProjectAccess` before
the upsert. Order: session → `project_id required` 400 → program ownership → project
ownership → upsert. Preserved the `Math.max(0, Number(allocated_headcount) || 0)` clamp and
the `{ id, project_id, allocated_headcount }` response shape.

**Also found and fixed while investigating GET** (plan explicitly asked to check): the GET
handler's `programProjectAllocations` repo call looked up the program row by id alone with no
company scoping — any authenticated caller could read another tenant's program name and
portfolio-level allocated headcount. Gated with the same `assertProgramAccess` before the
read.

**BEHAVIOR CHANGE (HYG-02):** foreign program or foreign project on POST → 403 (was a silent
write). Foreign program on GET → 403 (was 200 with that program's data).

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 01 | `66de1b4` | fix(04-05): route projects/[id] through projects.service, delete inline checkAccess |
| 02 | `dcff6b3` | fix(04-05): route budget-item nested routes through budget-items.service, delete local authorize copies |
| 03 | `5d19431` | fix(04-05): close live read IDOR on portfolio roadmap epics |
| 04 | `7470fbe` | fix(04-05): close live write IDOR on program-project allocations, gate GET too |
| 05 | `132a36e` | chore(04-05): type the epics route's activity rows, drop pre-existing any usage |

## Test Baseline (post-plan)

| Metric | Entering | After 04-05 |
|--------|----------|-------------|
| Total | 446 | **506** |
| Passed | 333 | **393** |
| Failed | 0 | **0** |
| Skipped | 113 | **113** |

Skip count held exactly at the 113 baseline throughout every intermediate run — no suite
silently stopped running.

## Verification

- `grep -c "checkAccess" "app/api/projects/[id]/route.ts"` → 0
- `grep -rc "async function authorize" "app/api/projects/[id]/budget/"` → 0 for all three files
- `grep -rE "next/server|NextRequest|NextResponse" lib/services/` → empty
- `grep -rl "getSessionFromRequest"` across all 6 modified routes → all 6 listed
- `npx tsc --noEmit` → exit 0
- `npx eslint` → 0 problems on every file this plan modified (including the pre-existing `any` cleanup in epics/route.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - missing critical functionality] Added scoping guard for expense deletion**
- **Found during:** Task 2 (budget-items.service.ts)
- **Issue:** `deleteExpense` had no guard proving the expense belongs to the asserted item —
  a foreign expense id would silently match zero rows in the scoped `DELETE` and still return
  `{ ok: true }`, hiding the no-op from the caller. `createExpense` already had this class of
  guard (`getBudgetItemInProject`) but the delete path did not have its counterpart.
- **Fix:** Added `getExpenseInItem` repo function; `deleteExpense` throws `NotFoundError` when
  it returns undefined, before calling the repository delete.
- **Files modified:** `lib/repositories/budget.repo.ts`, `lib/services/budget-items.service.ts`
- **Commit:** `dcff6b3`

**2. [Rule 2 - missing critical functionality] Fixed adjacent GET read leak on project-allocations**
- **Found during:** Task 4 (investigating GET per the plan's explicit instruction)
- **Issue:** `programProjectAllocations` looked up the program row (`customers` table) by id
  alone, with no company-scoping WHERE clause — any authenticated user could GET another
  tenant's program name and portfolio-level allocated headcount.
- **Fix:** Called `assertProgramAccess(programId, actor)` before the repo read in GET, same
  as POST.
- **Files modified:** `app/api/programs/[id]/project-allocations/route.ts`
- **Commit:** `7470fbe`

**3. [Rule 3 - blocking issue] Typed epics route's activity rows**
- **Found during:** Task 5 (regression sweep — `npx eslint` on all plan-modified files)
- **Issue:** `epics/route.ts` (modified for the T-04-21 fix) carried four pre-existing
  `@typescript-eslint/no-explicit-any` violations predating this plan. The plan's own
  acceptance criteria requires eslint-clean on files this plan modifies.
- **Fix:** Added a local `ActivityRow` type covering the fields the route already
  destructured; no shape or behavior change.
- **Files modified:** `app/api/portfolio/roadmap/epics/route.ts`
- **Commit:** `132a36e`

## Threat Model Resolution

| ID | Threat | Severity | Status |
|----|--------|----------|--------|
| T-04-21 | Live read IDOR (epics) | high | **Closed** — `assertProjectAccess` before read; repo-not-called-on-denial test passing |
| T-04-22 | Live write IDOR (allocations) | high | **Closed** — both-sided assert before upsert; both-sided denial tests passing; adjacent GET leak also closed |
| T-04-23 | Status-contract split (401 vs 403) | medium | **Closed** — all three nested budget routes now 403 |
| T-04-24 | Canonical-semantics drift (checkAccess) | medium | **Closed** — deleted, routes through projects.service.ts |
| T-04-25 | Tenancy regression on mass-assignment (PATCH) | high | **Closed** — regression test proves `{company_id}` still 400-with-columns |

## Self-Check: PASSED

- [x] `lib/services/projects.service.ts` exists
- [x] `lib/services/budget-items.service.ts` exists
- [x] Commits `66de1b4` `dcff6b3` `5d19431` `7470fbe` `132a36e` present in `git log`
- [x] Full suite: 0 failed, 113 pending (matches baseline)
- [x] All required greps return expected results
- [x] `npx tsc --noEmit` exit 0
- [x] `npx eslint` clean on all plan-modified files
