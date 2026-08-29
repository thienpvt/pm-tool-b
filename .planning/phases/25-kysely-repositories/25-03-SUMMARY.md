---
phase: 25-kysely-repositories
plan: 03
subsystem: database
tags: [kysely, postgres, auth, settings, dashboards, jsonb-upsert]

requires:
  - phase: 25-02
    provides: pickAllowed helpers and txKyselyTarget ALS bridge
provides:
  - dashboard-filter-state.repo on getKysely with JSONB upsert
  - auth.repo user reads/writes on getKysely (session SQL stays in lib/auth.ts)
  - settings.repo kv get/list/set on getKysely
  - auth.repo.test.ts integration coverage for findUserByUsername
affects: [25-04, dashboard-routes, auth-routes, settings-routes]

actuals:
  tokens: 3200
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns: [getKysely repo conversion, testKysely mock alongside testDb, JSONB onConflict upsert]

key-files:
  created: [lib/repositories/auth.repo.test.ts]
  modified:
    - modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts
    - modules/dashboards/backend/repositories/dashboard-filter-state.repo.test.ts
    - lib/repositories/auth.repo.ts
    - lib/repositories/settings.repo.ts
    - lib/repositories/settings.repo.test.ts

key-decisions:
  - "auth.repo converts user CRUD only; lib/auth.ts session SQL deliberately untouched (D-05)"
  - "settings upsert uses explicit key column — no RETURNING id (D-05)"
  - "dashboard filter JSONB upsert keeps ON CONFLICT (user_id, surface) with updated_at = now()"

patterns-established:
  - "Cross-cutting lib repos mock getKysely → testKysely() same as module repos (D-07)"
  - "JSONB columns stringify before insertInto values"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "Dashboard filter get/upsert via getKysely with JSONB ON CONFLICT (user_id, surface)"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: modules/dashboards/backend/repositories/dashboard-filter-state.repo.test.ts
        status: unknown
    human_judgment: false
  - id: D2
    description: "auth.repo findUserByUsername and password hash read/write via getKysely"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: lib/repositories/auth.repo.test.ts
        status: unknown
    human_judgment: false
  - id: D3
    description: "settings.repo get/list/set via getKysely with ON CONFLICT key upsert"
    requirement: ENF-02
    verification:
      - kind: integration
        ref: lib/repositories/settings.repo.test.ts
        status: unknown
    human_judgment: false

duration: 15min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 03: Dashboards and Lib Repos on Kysely Summary

**Dashboard filter state, auth.repo user CRUD, and settings kv repos converted to getKysely with testKysely mocks**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-29T00:31:00Z
- **Completed:** 2026-08-29T00:46:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Converted `dashboard-filter-state.repo.ts` get/upsert to Kysely with JSONB `onConflict` on `(user_id, surface)`
- Converted `auth.repo.ts` four exports to Kysely; left `lib/auth.ts` session SQL unchanged
- Converted `settings.repo.ts` get/list/set to Kysely with key-based upsert (no RETURNING id)
- Added `auth.repo.test.ts` covering findUserByUsername, password hash round-trip, and getKysely call
- Extended dashboard and settings test files with getKysely mock and call assertions

## Task Commits

Each task followed TDD RED then GREEN:

1. **Task 1: Convert dashboard-filter-state.repo.ts**
   - `389b17a` test(25-03): red dashboard filter kysely
   - `6f34c14` feat(25-03): dashboard filter state kysely
2. **Task 2: Convert auth.repo.ts**
   - `9ba616d` test(25-03): red auth repo kysely
   - `5dcc4f3` feat(25-03): auth repo kysely
3. **Task 3: Convert settings.repo.ts**
   - `044d0e9` test(25-03): red settings repo kysely
   - `bb7bc96` feat(25-03): settings repo kysely

## Files Created/Modified

- `modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts` — Kysely select + JSONB upsert
- `modules/dashboards/backend/repositories/dashboard-filter-state.repo.test.ts` — getKysely mock + assertion
- `lib/repositories/auth.repo.ts` — Kysely selectAll / updateTable for user CRUD
- `lib/repositories/auth.repo.test.ts` — new integration suite (D-07)
- `lib/repositories/settings.repo.ts` — Kysely select + insert onConflict
- `lib/repositories/settings.repo.test.ts` — getKysely mock + setSetting assertion

## Decisions Made

- Session SQL remains in `lib/auth.ts` per D-05 scope boundary
- Explicit column sets on auth/settings writes — no pickAllowed (no free-form field maps)
- `updated_at` normalized to ISO string when Kysely returns Date

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: modules/dashboards/backend/repositories/dashboard-filter-state.repo.ts
- FOUND: lib/repositories/auth.repo.ts
- FOUND: lib/repositories/settings.repo.ts
- FOUND: lib/repositories/auth.repo.test.ts
- FOUND: 389b17a, 6f34c14, 9ba616d, 5dcc4f3, 044d0e9, bb7bc96
