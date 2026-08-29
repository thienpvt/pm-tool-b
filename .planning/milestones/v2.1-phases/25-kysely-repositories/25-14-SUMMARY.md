---
phase: 25-kysely-repositories
plan: 14
subsystem: database
tags: [kysely, pickAllowed, postgres, mass-assignment, repositories, issues, meetings, escalations, team]

requires:
  - phase: 25-kysely-repositories
    provides: getKysely factory, pickAllowed helper, testKysely harness, W9b pattern from 25-13
provides:
  - issues.repo.ts on getKysely with pickAllowed updateIssue and RAID sql ordering
  - meetings.repo.ts on getKysely with pickAllowed updateMeeting
  - escalations.repo.ts on getKysely with pickAllowed updateEscalation
  - team.repo.ts on getKysely with pickAllowed updateTeamMember
affects: [25-15, with-auth UnknownColumnError mapping]

actuals:
  tokens: 13000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "pickAllowed(COLUMNS, fields) before updateTable().set() for mass-assignment guard"
    - "RAID CASE/ORDER fragments preserved via kysely sql tagged templates (issues)"
    - "deleteResult helper maps numDeletedRows to legacy changes shape (meetings, team)"

key-files:
  created: []
  modified:
    - modules/projects/backend/repositories/issues.repo.ts
    - modules/projects/backend/repositories/issues.repo.test.ts
    - modules/projects/backend/repositories/meetings.repo.ts
    - modules/projects/backend/repositories/meetings.repo.test.ts
    - modules/projects/backend/repositories/escalations.repo.ts
    - modules/projects/backend/repositories/escalations.repo.test.ts
    - modules/projects/backend/repositories/team.repo.ts
    - modules/projects/backend/repositories/team.repo.test.ts

key-decisions:
  - "ISSUE/MEETING/ESCALATION/TEAM_COLUMNS unchanged — project_id and id remain excluded (D-04)"
  - "No createEscalation/deleteEscalation — route has no POST/DELETE today"
  - "Test imports retargeted from broken ../../test to @/test/db and @/test/repo-db"

patterns-established:
  - "W9b rest: four remaining allowlist writers on getKysely + pickAllowed PATCH guard"

requirements-completed: [ENF-02]

coverage:
  - id: D1
    description: "updateIssue rejects project_id via pickAllowed UnknownColumnError"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/issues.repo.test.ts#rejects an unknown column"
        status: unknown
    human_judgment: true
    rationale: "Integration tests require TEST_DATABASE_URL — skipped in CI-less local run"
  - id: D2
    description: "updateMeeting, updateEscalation, updateTeamMember use pickAllowed with id/project_id excluded"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "modules/projects/backend/repositories/meetings.repo.test.ts#rejects an unknown column"
        status: unknown
    human_judgment: true
    rationale: "Integration tests require TEST_DATABASE_URL — skipped in CI-less local run"
  - id: D3
    description: "withAuth still maps UnknownColumnError to HTTP 400 without wrapper edits (D-06)"
    requirement: ENF-02
    verification:
      - kind: unit
        ref: "lib/http/with-auth.test.ts#maps a thrown UnknownColumnError to 400"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 25 Plan 14: W9b Issues/Meetings/Escalations/Team Summary

**Four remaining allowlist writers converted to getKysely with pickAllowed PATCH guards; HTTP 400 UnknownColumnError chain verified via with-auth tests**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T01:19:00Z
- **Completed:** 2026-08-29T01:21:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Converted issues.repo.ts to getKysely with pickAllowed(ISSUE_COLUMNS) and RAID sql CASE/ORDER parity
- Converted meetings.repo.ts with pickAllowed(MEETING_COLUMNS) and deleteResult compatibility
- Converted escalations.repo.ts and team.repo.ts with pickAllowed on update paths only
- Retargeted all four test files to @/test imports and testKysely mock (fixes broken ../../test paths)
- Verified with-auth UnknownColumnError → 400 mapping unchanged (20/20 pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert issues.repo.ts** - `ded2456` (test), `e252bad` (feat)
2. **Task 2: Convert meetings.repo.ts** - `7d89e1b` (test), `94eb4cb` (feat)
3. **Task 3: Convert escalations and team repos** - `3773347` (test), `e2c81a3` (feat)

## Files Created/Modified

- `modules/projects/backend/repositories/issues.repo.ts` - Full Kysely conversion with RAID ordering
- `modules/projects/backend/repositories/meetings.repo.ts` - CRUD on getKysely + pickAllowed update
- `modules/projects/backend/repositories/escalations.repo.ts` - List/update on getKysely + pickAllowed
- `modules/projects/backend/repositories/team.repo.ts` - CRUD + report/export queries on getKysely
- Four corresponding `.test.ts` files - @/test imports + getKysely mock

## Decisions Made

- Followed 25-13 W9b pattern verbatim for consistency
- listTechnologyCouncilIssues rewritten as Kysely join builder (same semantics as raw SQL)
- No createEscalation added — API surface unchanged per plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Repo integration tests skipped locally (no TEST_DATABASE_URL) — compile/import verified
- route.access.test.ts PATCH/DELETE owner tests fail without DATABASE_URL (audit.repo getKysely) — pre-existing env gap; UnknownColumnError test and all with-auth tests pass

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All seven allowlist write repos now use pickAllowed (25-13 + 25-14)
- Ready for 25-15 SET-fragment helper cleanup (W10)

## Self-Check: PASSED

- FOUND: modules/projects/backend/repositories/issues.repo.ts
- FOUND: modules/projects/backend/repositories/meetings.repo.ts
- FOUND: modules/projects/backend/repositories/escalations.repo.ts
- FOUND: modules/projects/backend/repositories/team.repo.ts
- FOUND: ded2456, e252bad, 7d89e1b, 94eb4cb, 3773347, e2c81a3

---
*Phase: 25-kysely-repositories*
*Completed: 2026-08-29*
