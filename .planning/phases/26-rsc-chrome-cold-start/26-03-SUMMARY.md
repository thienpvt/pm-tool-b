---
phase: 26-rsc-chrome-cold-start
plan: 03
subsystem: testing
tags: [vitest, postgres, perf-03, cold-start, getDb]

requires:
  - phase: 26-02
    provides: Phase 26 chrome rollout complete; lib/db boot path unchanged
provides:
  - lib/db.cold-start.test.ts p95 integration benchmark for getDb()
  - COLD-START.md recorded budget artifact (2000ms target, 5000ms CI fail)
affects: []

actuals:
  tokens: 12000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "vi.resetModules + dynamic import('./db') per cold-start sample"
    - "pool.end() teardown; skipIf(!hasTestDb) for CI without TEST_DATABASE_URL"
    - "COLD-START.md refreshed by timing suite when DB available"

key-files:
  created:
    - lib/db.cold-start.test.ts
    - .planning/phases/26-rsc-chrome-cold-start/COLD-START.md
  modified: []

key-decisions:
  - "Warm-cache guard uses 1ms threshold (cached singleton ~0ms; localhost cold start ~5ms)"
  - "Relative import('./db') with resetModules for reliable module singleton reset"

patterns-established:
  - "TDD RED/GREEN: test(26-03) then feat(26-03) per task"
  - "Hand-roll p95; no APM npm packages; single production Pool via getDb/getPool"

requirements-completed: [PERF-03]

coverage:
  - id: D1
    description: getDb cold-start p95 measured with resetModules loop (20 samples)
    requirement: PERF-03
    verification:
      - kind: integration
        ref: "lib/db.cold-start.test.ts#p95 connect+assert ≤ 5000ms"
        status: pass
    human_judgment: false
  - id: D2
    description: COLD-START.md records PERF-03 budget targets 2000ms / 5000ms
    requirement: PERF-03
    verification:
      - kind: unit
        ref: "lib/db.cold-start.test.ts#records PERF-03 target 2000ms and CI fail threshold 5000ms"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-29
status: complete
---

# Phase 26 Plan 03: getDb Cold-Start p95 Summary

**Vitest p95 benchmark for getDb() connect+assert+seed with recorded COLD-START.md budget (2000ms target, 5000ms CI fail)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-29T02:18:00Z
- **Completed:** 2026-08-29T02:26:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `lib/db.cold-start.test.ts` measuring 20 cold-start samples via `vi.resetModules` and dynamic `import('./db')`
- p95 gate fails above 5000ms; warm-singleton guard detects stale module cache (18+ sub-1ms samples)
- `COLD-START.md` records measured samples (p95 6.8ms local) or SKIP when `TEST_DATABASE_URL` unset
- No changes to production `getDb()` path; no second Pool; no new npm packages

## Task Commits

1. **Task 1 RED:** End-to-end getDb cold-start p95 suite — `840ab61` (test)
2. **Task 1 GREEN:** End-to-end getDb cold-start p95 suite — `af02e74` (feat)
3. **Task 2 RED:** Write COLD-START.md budget artifact — `5e70db3` (test)
4. **Task 2 GREEN:** Write COLD-START.md budget artifact — `c56ed08` (feat)

## Files Created/Modified

- `lib/db.cold-start.test.ts` — p95 integration benchmark + artifact existence test
- `.planning/phases/26-rsc-chrome-cold-start/COLD-START.md` — recorded budget with sample table

## Decisions Made

- Warm-cache threshold lowered to 1ms: cached singleton returns ~0ms while legitimate localhost cold starts are ~5–10ms; plan's 50ms threshold false-failed on real measurements
- Used relative `import('./db')` alongside `vi.resetModules()` for reliable singleton reset in Vitest node project

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Warm-cache guard threshold adjusted from 50ms to 1ms**
- **Found during:** Task 1 (cold-start measurement loop)
- **Issue:** With `TEST_DATABASE_URL` set, 19/20 samples were below 50ms despite valid cold starts (~5–10ms); only cached singleton hits ~0ms
- **Fix:** Detect warm cache when 18+ samples complete in under 1ms (true singleton short-circuit)
- **Files modified:** lib/db.cold-start.test.ts
- **Verification:** Test passes with DB (p95 6.8ms, warmCount 0); fails without resetModules (sample 2 = 0.0ms)
- **Committed in:** af02e74

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Threshold change preserves PERF-03 intent (detect false-green warm singleton) without blocking fast local Postgres.

## Issues Encountered

- Test database required `npm run migrate` to stamp `schema_migrations` ledger before cold-start samples

## User Setup Required

None — set `TEST_DATABASE_URL` to a `*_test` database for timed samples; suite skips timing when unset.

## Next Phase Readiness

- Phase 26 complete (26-01 chrome, 26-02 rollout, 26-03 cold-start budget)
- PERF-03 connect+assert cost is visible and gated in CI when test DB is configured

## Self-Check: PASSED

- FOUND: lib/db.cold-start.test.ts
- FOUND: .planning/phases/26-rsc-chrome-cold-start/COLD-START.md
- FOUND: .planning/phases/26-rsc-chrome-cold-start/26-03-SUMMARY.md
- FOUND: 840ab61
- FOUND: af02e74
- FOUND: 5e70db3
- FOUND: c56ed08

---
*Phase: 26-rsc-chrome-cold-start*
*Completed: 2026-08-29*
