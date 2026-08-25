---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Portfolio One View
current_phase: 10
current_phase_name: Users, Roles & Server Authorization
status: executing
stopped_at: Completed 10-06-PLAN.md
last_updated: "2026-08-25T18:44:21.476Z"
last_activity: 2026-08-26
last_activity_desc: Phase 9 complete, transitioned to Phase 10
state_head: b40c3ab8df9bede5fbd215b8f502a3400ae099e5
progress:
  total_phases: 10
  completed_phases: 1
  total_plans: 14
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-25)

**Core value:** One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.
**Current focus:** Phase 10 — Users, Roles & Server Authorization

## Current Position

Phase: 10 (Users, Roles & Server Authorization) — IN PROGRESS
Plan: 6 of 11 complete (10-01)
Status: Ready to execute
Last activity: 2026-08-26 — Completed 10-01 auth spine tracer

Progress: [█░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**

- Total plans completed: 38 (35 v1.0 + 3 Phase 9)
- Average duration: - min
- Total execution time: - hours

**By Phase:** v1.0 Phases 1–8 complete (35 plans). v2.0 Phase 9 complete (3 plans).

**Recent Trend:**

- Last 5 plans: v1.0 closeout
- Trend: Stable

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 09-mapping-table-tenant-isolation P01 | 45min | 3 tasks | 11 files |
| Phase 09-mapping-table-tenant-isolation P02 | 25min | 3 tasks | 11 files |
| Phase 09-mapping-table-tenant-isolation P03 | 25min | 3 tasks | 12 files |
| Phase 10-users-roles-server-authorization P01 | 12 | 2 tasks | 12 files |
| Phase 10-users-roles-server-authorization P02 | 8min | 3 tasks | 7 files |
| Phase 10-users-roles-server-authorization P03 | 8min | 3 tasks | 9 files |
| Phase 10-users-roles-server-authorization P05 | 12min | 3 tasks | 13 files |
| Phase 10-users-roles-server-authorization P04 | 3min | 3 tasks | 8 files |
| Phase 10-users-roles-server-authorization P06 | 4min | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0 numbering continues from Phase 8; do not reset to Phase 1
- Spec (GuiIT Portfolio One View) is source of truth; keep Jira / AI / Excel-PPT-Word export
- Weekly reports are a parallel product surface, not an enhancement of activity-weighted report pages
- TENANT-01 shipped in Phase 9 (four mapping tables company-scoped)
- Audit wires incrementally from Phase 10; Phase 18 completes append-only coverage
- Word spec stays local — do not commit the `.docx`
- [Phase 9]: Timeline mapping ConflictError via findTimelineMappingByName pre-check
- [Phase 9]: Bug cap eviction scoped by bugMappingIds(companyId) in service not route
- [Phase 9]: JQL unique (company_id, name, context); sync list+POST scoping only
- [Phase 9]: findJqlPresetByName pre-check for ConflictError
- [Phase 10]: AccessActor canonical in lib/services/access.ts; withAuth uses toAccessActor
- [Phase 10]: Role backfill skips null company_id; does not set is_admin from roles
- [Phase 10]: SESSION_DURATION_MS shared by createSession and extendSession
- [Phase 10]: POST /api/auth/session/extend does not Set-Cookie on success (D-11 draft preservation)
- [Phase 10]: Removed is_admin bypass from assertProjectAccess; CPMO company-scoped (D-13)
- [Phase 10]: PM-only D-14 matcher on GET after tenant; assertPmWriteAccess seam for Phase 11 (D-14, D-24)
- [Phase 10]: CPMO user admin split from platform break-glass via withCpmo + company_id scope (D-21)
- [Phase 10]: user_roles excluded from INSERT RETURNING id (composite PK)
- [Phase 10]: RAID/timeline mutators use assertProjectWriteAccess from 10-03; reads keep assertProjectAccess
- [Phase 10]: Meetings/team/bugs/escalations mutators use assertProjectWriteAccess; D-23 ops/admin carve-out unchanged

### Pending Todos

None yet.

### Blockers/Concerns

- HYG-02 Anthropic 502 vs old 500 still needs operator confirm (not v2.0 scope)
- Leftover v1.0 ops-route thinning and proxy JSON 401 remain deferred

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Data Layer | DATA-01, DATA-02, DATA-03 | later (not v2.0) | 2026-08-07 | v1.0 |
| Enforcement | ENF-01, ENF-02 | later (not v2.0) | 2026-08-07 | v1.0 |
| Performance | PERF-01, PERF-02, PERF-03 | later (not v2.0) | 2026-08-07 | v1.0 |

## Session Continuity

Last session: 2026-08-25T18:44:21.388Z
Stopped at: Completed 10-06-PLAN.md
Resume file: None
