---
phase: 11-project-master-pm-assignment-stakeholders
plan: 05
subsystem: ui
tags: [react, nextjs, projects, pm-assignments, stakeholders, governance]

requires:
  - phase: 11-02
    provides: project create/update APIs with project_code, portfolio_year, governance fields
  - phase: 11-03
    provides: nested pm-assignments API
  - phase: 11-04
    provides: nested stakeholders API
provides:
  - New-project form posts project_code, portfolio_year, customer_id
  - Project detail edit dialog with identity/governance fields and warning toasts
  - Detail page lists pm-assignments and stakeholders from nested APIs
affects: [phase-16-dashboards]

actuals:
  tokens: 8200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Client fetches /api/auth/me for CPMO UX only; server asserts remain access gate"
    - "PATCH success toasts warnings array separately from success toast (D-07)"

key-files:
  created: []
  modified:
    - app/projects/new/page.tsx
    - app/projects/[id]/page.tsx

key-decisions:
  - "PM assignment effective_from stays server CURRENT_DATE — UI posts user_id + role only (matches 11-03 service)"
  - "Stakeholder add form accepts user_id or external name/email; server validates write access"

patterns-established:
  - "Governance PATCH warnings surfaced via toast.warning without failing the save"

requirements-completed: [PROJ-01, PROJ-03, PMAS-03, STKH-03]

coverage:
  - id: D1
    description: "New project form requires and posts project_code, portfolio_year, customer_id"
    requirement: PROJ-01
    verification:
      - kind: unit
        ref: "lib/services/projects.service.unit.test.ts (28 tests pass)"
        status: pass
    human_judgment: true
    rationale: "Create form field wiring needs visual UAT on /projects/new"
  - id: D2
    description: "Detail edit sends stage/governance fields; PATCH warnings toasted"
    requirement: PROJ-03
    verification:
      - kind: other
        ref: "node source check — page.tsx includes stage"
        status: pass
    human_judgment: true
    rationale: "Edit dialog field layout and warning UX need human review"
  - id: D3
    description: "Detail page GETs pm-assignments list and CPMO can POST/PATCH windows"
    requirement: PMAS-03
    verification:
      - kind: unit
        ref: "lib/services/pm-assignments.service.unit.test.ts (pass)"
        status: pass
      - kind: other
        ref: "node source check — page.tsx includes pm-assignments"
        status: pass
    human_judgment: true
    rationale: "Assignment list rendering and CPMO mutate controls need browser verification"
  - id: D4
    description: "Detail page GETs stakeholders list; write access can POST/PATCH"
    requirement: STKH-03
    verification:
      - kind: unit
        ref: "lib/services/stakeholders.service.unit.test.ts (pass)"
        status: pass
      - kind: other
        ref: "node source check — page.tsx includes stakeholders"
        status: pass
    human_judgment: true
    rationale: "Stakeholder forms and end-window actions need browser verification"

duration: 8min
completed: 2026-08-26
status: complete
---

# Phase 11 Plan 05: Existing Create/Detail UI Wiring Summary

**Create and detail screens expose project_code, portfolio_year, L0–L5 governance fields, and nested PM assignment / stakeholder lists — server tests remain the gate (D-20).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-26T02:58:00+07:00
- **Completed:** 2026-08-26T03:06:00+07:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- New-project wizard step 1 collects project_code and portfolio_year; POST body includes all three required identity keys (code, year, program customer_id).
- Project detail edit dialog extended with stage, status, RAG, progress, timeline ends, weekly-report flag, classification/governance; project_code input disabled for non-CPMO; PATCH warnings toasted via `toast.warning`.
- Detail page fetches and renders compact PM assignment and stakeholder history cards with CPMO assignment form and write-access stakeholder add/end actions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add identity fields to new project form** - `aaa6b3a` (feat)
2. **Task 2: Detail edit plus assignment and stakeholder lists** - `22155bf` (feat)

## Files Created/Modified

- `app/projects/new/page.tsx` — project_code + portfolio_year inputs, client validation, POST payload
- `app/projects/[id]/page.tsx` — governance edit fields, warning toasts, pm-assignments/stakeholders lists and forms

## Decisions Made

- PM assignment UI omits custom effective_from because insert uses CURRENT_DATE in the repository layer.
- Company user picker for assignments loads `/api/admin/users` when session is CPMO; stakeholder form uses numeric user_id or external fields for broader write-access users.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4 in this repo does not accept the plan's `-x` flag; ran `npx vitest run` without it (all tests passed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CPMO can operate identity, assignments, and stakeholders from existing screens; Phase 16 dashboards should consume the same list APIs/helpers.
- Human UAT recommended: create project as CPMO; edit stage/code on detail; verify assignment and stakeholder lists populate from nested routes.

## Self-Check: PASSED

- FOUND: app/projects/new/page.tsx
- FOUND: app/projects/[id]/page.tsx
- FOUND: .planning/phases/11-project-master-pm-assignment-stakeholders/11-05-SUMMARY.md
- FOUND: commit aaa6b3a
- FOUND: commit 22155bf

---
*Phase: 11-project-master-pm-assignment-stakeholders*
*Completed: 2026-08-26*
