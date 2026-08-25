---
phase: 06-access-enforcement-rollout
plan: 03
subsystem: api
tags: [withProjectAccess, access-control, nextjs, vitest, ai-integration]

requires:
  - phase: 06-access-enforcement-rollout
    plan: 01
    provides: withProjectAccess (opts.rawBody, shadow-deny re-entry), assertProjectAccess (returns row)
  - phase: 04
    provides: getWeeklyProjectReport / getProjectReport services (already take actor)
provides:
  - "app/api/projects/[id]/report, project-report, project-report/generate-email all on withProjectAccess"
  - "401/403/success/force500 route-level test coverage for all 3 (previously zero test files)"
affects: [06-06, 06-07]

actuals:
  tokens: 21000
  tasks: 4
  commits: 3
requirements-completed: [ROUTE-03, ROUTE-09, ROUTE-10]

tech-stack:
  added: []
  patterns:
    - "opts.rawBody: true on withProjectAccess for POST handlers that keep their own WR-05 malformed-JSON 400 body-parse, avoiding a double req.json() read"

key-files:
  created:
    - app/api/projects/[id]/report/route.test.ts
    - app/api/projects/[id]/project-report/route.test.ts
    - app/api/projects/[id]/project-report/generate-email/route.test.ts
  modified:
    - app/api/projects/[id]/report/route.ts
    - app/api/projects/[id]/project-report/route.ts
    - app/api/projects/[id]/project-report/generate-email/route.ts

key-decisions:
  - "generate-email/route.ts keeps integrationErrorResponse(e) WITHOUT force500 — it never had one pre-conversion (its Anthropic errors map to the frozen 502 split per lib/api-errors.ts's documented Pitfall-5 comment). Adding force500 here would be an unrequested behavior change, not a preservation of one. The plan's literal grep-1-per-file acceptance line for this file conflicts with its own 'preserve force500 split' objective; the objective (freeze existing behavior) wins."
  - "Both report GET handlers hand ctx.params.id + ctx.actor straight to the already-actor-aware Phase 4 services (getWeeklyProjectReport, getProjectReport) — no per-route logic needed beyond removing the raw session check."

coverage:
  - id: D1
    description: "All 3 routes use withProjectAccess; no raw getSessionFromRequest remains"
    requirement: "ROUTE-03"
    verification:
      - kind: other
        ref: "grep -rl getSessionFromRequest on the 3 route files => no matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "401 without session, 403 for cross-company project_id on all 3 routes (GET where present, POST on all)"
    requirement: "ROUTE-09, ROUTE-10"
    verification:
      - kind: unit
        ref: "app/api/projects/[id]/report/route.test.ts — 401/403 GET+POST"
        status: pass
      - kind: unit
        ref: "app/api/projects/[id]/project-report/route.test.ts — 401/403 GET+POST"
        status: pass
      - kind: unit
        ref: "app/api/projects/[id]/project-report/generate-email/route.test.ts — 401/403 POST"
        status: pass
    human_judgment: false
  - id: D3
    description: "force500 preserved on report + project-report POST (500 on Anthropic upstream error); generate-email keeps its unchanged 502 split"
    requirement: "ROUTE-03"
    verification:
      - kind: other
        ref: "grep -c force500 app/api/projects/[id]/report/route.ts app/api/projects/[id]/project-report/route.ts => 1 each"
        status: pass
      - kind: unit
        ref: "report/route.test.ts + project-report/route.test.ts — Anthropic upstream error maps to 500"
        status: pass
      - kind: unit
        ref: "generate-email/route.test.ts — Anthropic upstream error maps to 502 (documented, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full suite 0 failed, exactly 113 skipped; tsc/eslint clean on all 6 touched files"
    verification:
      - kind: other
        ref: "node node_modules/vitest/vitest.mjs run --reporter=json => 661 total / 548 passed / 0 failed / 113 pending"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit => exit 0"
        status: pass
      - kind: other
        ref: "npx eslint <6 files> => exit 0"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-08-11
status: complete
---

# Phase 6 Plan 03: Convert the 3 projects/[id] Report Routes Summary

**The 3 stragglers Phase 5 didn't reach — report, project-report, and project-report/generate-email — now go through withProjectAccess, closing ROUTE-03's full projects/[id]/** coverage and adding the 401/403/force500 test files these AI-generation routes never had.**

## Performance

- **Duration:** ~28 min
- **Completed:** 2026-08-11
- **Tasks:** 4
- **Files modified:** 3, created: 3

## Accomplishments

- `app/api/projects/[id]/report/route.ts` — GET/POST wrapped in `withProjectAccess`. GET hands `params.id` + `actor` to the Phase 4 `getWeeklyProjectReport` service. POST uses `rawBody: true` (keeps its own WR-05 malformed-JSON 400) and its `integrationErrorResponse(e, { force500: true })` catch, byte-for-byte preserved.
- `app/api/projects/[id]/project-report/route.ts` — same shape; GET calls `getProjectReport`, POST keeps `force500: true`.
- `app/api/projects/[id]/project-report/generate-email/route.ts` — POST wrapped in `withProjectAccess`; keeps its unchanged `integrationErrorResponse(e)` (no force500 — this route's Anthropic errors were never in the 500 split).
- 3 new test files, none of which existed before: 401 (no session), 403 (cross-company `project_id` via a mocked `projectAccessRow` with a different `company_id`), owner-success (frozen response shape + Anthropic client invocation), and force500-preservation (Anthropic upstream error → 500 on the two report routes, 502 on generate-email).

## Task Commits

1. **Task 1: convert report/route.ts** - `8c334ad` (refactor)
2. **Task 2: convert project-report + generate-email routes** - `b93853f` (refactor)
3. **Task 3: add 401/403/success/force500 tests** - `29c6dc8` (test)
4. **Task 4: boundary sweep + summary** - this commit (docs)

## Files Created/Modified

- `app/api/projects/[id]/report/route.ts` - `withProjectAccess` GET+POST, `rawBody: true` on POST.
- `app/api/projects/[id]/project-report/route.ts` - `withProjectAccess` GET+POST, `rawBody: true` on POST.
- `app/api/projects/[id]/project-report/generate-email/route.ts` - `withProjectAccess` POST, `rawBody: true`.
- `app/api/projects/[id]/report/route.test.ts` - 7 tests (401/403/200 GET; 401/403/200/force500 POST).
- `app/api/projects/[id]/project-report/route.test.ts` - 7 tests (same shape as above).
- `app/api/projects/[id]/project-report/generate-email/route.test.ts` - 4 tests (401/403/200/502).

## Decisions Made

- `generate-email/route.ts` does NOT gain `force500: true`. It never had it pre-conversion — its Anthropic errors map through the frozen 502 branch documented in `lib/api-errors.ts` ("Anthropic — behavior freeze... report routes return 500 today, generate-email routes 502"). The plan's task-02 acceptance line literally greps for `force500` count 1 in this file, but the plan's own objective and `06-VALIDATION.md`'s "Frozen behavior that must NOT change" both say preserve the existing force500/502 split — adding force500 here would flip a genuine behavior, contradicting the stated freeze. Followed the freeze; documented as a deviation below.
- Used `opts.rawBody: true` (built in 06-01) on every POST here so each route's own WR-05 malformed-JSON handling stays the sole body parser — the wrapper's auto `req.json()` never runs, avoiding a double body-stream read.

## Deviations from Plan

**1. [Rule 4 - documented, not auto-fixed] `generate-email/route.ts` acceptance-criteria grep vs. behavior-freeze objective conflict**
- **Found during:** Task 2
- **Issue:** Task 06-03-02's acceptance criteria literally states `grep -c "force500" ... generate-email/route.ts` should return 1, but this route's pre-conversion code never called `integrationErrorResponse` with `{ force500: true }` — its Anthropic upstream errors map to 502, not 500 (documented, frozen split in `lib/api-errors.ts`).
- **Resolution:** Kept the route's existing `integrationErrorResponse(e)` call unchanged (no force500), preserving the frozen 502 behavior. The acceptance-criteria grep for this one file will read 0, not 1 — everywhere else in the plan (report route, project-report route, and the plan's own prose "Preserve... the force500 split") confirms freeze is the actual intent.
- **Files modified:** `app/api/projects/[id]/project-report/generate-email/route.ts` (no force500 added)
- **Commit:** `b93853f`

## Issues Encountered

Full suite had 9 pre-existing failures at plan start from parallel executors (06-02/06-04/06-05) working on disjoint files (jira, export, portfolio routes) mid-edit at the time of the first full-suite run. These were outside this plan's scope (`app/api/projects/[id]/report/**` and `project-report/**` only) and resolved on their own as those parallel plans completed — final full-suite run shows 0 failed, confirming no interference.

## User Setup Required

None.

## Next Phase Readiness

- ROUTE-03 (every `projects/[id]/**` route on the wrapper) is now fully closed — all 21 routes (18 from Phase 5 + these 3) are converted.
- ROUTE-09/ROUTE-10 (401/403 coverage) now cover all 21 `projects/[id]/**` routes, no gaps left in this tree.
- Full suite: 661 total / 548 passed / 0 failed / 113 skipped.

---
*Phase: 06-access-enforcement-rollout*
*Completed: 2026-08-11*
