---
phase: 04-service-layer
plan: 03
subsystem: services
tags: [services, multi-tenant, idor, tdd, project-scoped, budget, programs]
depends_on:
  requires: [04-01 assertProjectAccess + serviceErrorResponse + risks tracer]
  provides: [11 project/program services, session-gated project sub-resource routes]
  affects: [04-04 portfolio aggregates if any remain, Phase 5 UI consumers]
tech-stack:
  added: []
  patterns:
    - "Thin service = assertProjectAccess first, then repo; NotFoundError on zero-row scoped write"
    - "Route shape: await params → session 401 → service(id, actor, ...) → mapError(repo then service)"
    - "programs.service asserts company_id on customers row — never assertProjectAccess"
    - "budget.service owns Promise.all composition + ValidationError for name/type"
    - "ConflictError maps to 409 for duplicate holiday dates"
key-files:
  created:
    - lib/services/activities.service.ts
    - lib/services/issues.service.ts
    - lib/services/meetings.service.ts
    - lib/services/team.service.ts
    - lib/services/escalations.service.ts
    - lib/services/documents.service.ts
    - lib/services/bugs.service.ts
    - lib/services/holidays.service.ts
    - lib/services/milestones.service.ts
    - lib/services/budget.service.ts
    - lib/services/programs.service.ts
    - app/api/projects/[id]/budget/route.test.ts
    - app/api/programs/[id]/route.test.ts
  modified:
    - app/api/projects/[id]/activities/route.ts
    - app/api/projects/[id]/activities/import/route.ts
    - app/api/projects/[id]/issues/route.ts
    - app/api/projects/[id]/meetings/route.ts
    - app/api/projects/[id]/team/route.ts
    - app/api/projects/[id]/escalations/route.ts
    - app/api/projects/[id]/documents/route.ts
    - app/api/projects/[id]/bugs/route.ts
    - app/api/projects/[id]/holidays/route.ts
    - app/api/projects/[id]/milestones/route.ts
    - app/api/projects/[id]/milestones/[milestoneId]/route.ts
    - app/api/projects/[id]/milestones/[milestoneId]/epics/route.ts
    - app/api/projects/[id]/budget/route.ts
    - app/api/programs/[id]/route.ts
    - lib/services/errors.ts
    - lib/api-errors.ts
decisions:
  - "ConflictError added to shared errors + serviceErrorResponse 409 for holiday duplicates"
  - "deleteActivity/etc treat changes===0 as NotFoundError (CR-02) even when prior route returned {ok:true}"
  - "documents upsert returns {row, created} so route can pick 201 vs 200 without re-querying"
  - "programs ownership is company_id equality on the customer row; admin bypass; null-company only unassigned"
  - "budget HYG-02: cross-company 401 → 403 isolated in its own commit"
estimate:
  tokens: 56000
actuals:
  tokens: 8500
  tasks: 5
  commits: 5
metrics:
  duration_min: 12
  completed: "2026-08-10"
status: complete
requirements-completed: [SVC-01, SVC-04, SVC-07]
coverage:
  - id: D1
    description: "Six simple project services assert ownership before repo"
    requirement: SVC-04
    verification:
      - kind: unit
        ref: lib/services/activities.service.unit.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Budget composition + ValidationError + HYG-02 403"
    requirement: SVC-07
    verification:
      - kind: unit
        ref: app/api/projects/[id]/budget/route.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "No next/server under lib/services (SVC-01)"
    requirement: SVC-01
    verification:
      - kind: other
        ref: "grep -rE next/server|NextRequest|NextResponse lib/services/"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 03: Project-Scoped Route Sweep Summary

Session-gated services close IDOR across remaining project sub-resources and unprotected programs/[id]; budget cross-company answer moves 401 → 403 (HYG-02).

## Completed Tasks

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Six simple pass-through services | tdd | 4783ebc | activities/issues/meetings/team/escalations/documents + unit tests |
| 2 | Five rich services (bugs/holidays/milestones/budget/programs) | tdd | ac70429 | + ConflictError in errors.ts/api-errors.ts |
| 3 | Rewire project sub-resource + programs/[id] routes | execute | 3cfb205 | 13 route files |
| 4 | Budget route onto service (HYG-02 401→403) | execute | 34f0d4b | budget/route.ts + route.test.ts |
| 5 | Route 401/403/owner tests + full suite + SVC-01 | execute | 9245bab | 13 route test files |

## Verification Evidence

| Check | Result |
|-------|--------|
| Full suite JSON reporter | **419 total, 310 passed, 109 skipped, 0 failed** |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` on changed routes/services | exit 0 |
| `grep -rE "next/server\|NextRequest\|NextResponse" lib/services/` | no matches (SVC-01) |
| `grep -c checkBudgetAccess app/api/projects/[id]/budget/route.ts` | 0 |
| Budget cross-company | 403 Forbidden (was 401) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] ConflictError for holiday 409**
- **Found during:** Task 2
- **Issue:** Holiday duplicate-date returned 409 from the route; ValidationError only maps to 400.
- **Fix:** Added status-free `ConflictError` in `lib/services/errors.ts` and mapped it to 409 in `serviceErrorResponse`.
- **Files modified:** `lib/services/errors.ts`, `lib/api-errors.ts`, `lib/services/holidays.service.ts`
- **Commit:** ac70429

**2. [Rule 2 - CR-02] Zero-row deletes become NotFoundError**
- **Found during:** Task 1
- **Issue:** Prior DELETE handlers always returned `{ok:true}` even when zero rows matched.
- **Fix:** Services throw `NotFoundError` when `changes === 0`, matching risks tracer / Phase 2 CR-02.
- **Note:** Owner success path still returns `{ok:true}` when a row is deleted. Clients that treated miss-as-ok may now see 404.

### TDD Gate Compliance

- Tests written with implementation per task commit (single-commit-per-task protocol).
- No separate `refactor(...)` commits needed after GREEN.

## Requirement Coverage

| Requirement | Evidence |
|-------------|----------|
| SVC-01 | No `next/server` / `NextRequest` / `NextResponse` under `lib/services/` |
| SVC-04 | Every project-scoped service function calls `assertProjectAccess` first (programs uses its own company assert) |
| SVC-07 | Cross-company denial unit tests per service + route 403 coverage |

## Threat Surface

| Flag | File | Description |
|------|------|-------------|
| none | — | T-04-11..T-04-15 mitigations landed as planned. ConflictError is a mapping extension for an existing 409, not a new trust boundary. |

## Known Stubs

None.

## Self-Check: PASSED

- 11 service files present under `lib/services/*.service.ts` (plus risks from 04-01)
- Commits 4783ebc, ac70429, 3cfb205, 34f0d4b, 9245bab on branch
- Full suite 0 failed / 109 skipped
