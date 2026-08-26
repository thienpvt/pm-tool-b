---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Portfolio One View
current_phase: 14
current_phase_name: CPMO Tracking & Consolidated Export
status: executing
stopped_at: Phase 13 complete, ready to plan Phase 14
last_updated: "2026-08-26T00:10:29.927Z"
last_activity: 2026-08-26
last_activity_desc: Phase 13 complete, transitioned to Phase 14
state_head: f71118e64ab6fbc1c2a7c6b345bd198b683913ea
progress:
  total_phases: 10
  completed_phases: 5
  total_plans: 28
  completed_plans: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-25)

**Core value:** One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.
**Current focus:** Phase 10 — Users, Roles & Server Authorization

## Current Position

Phase: 14 (CPMO Tracking & Consolidated Export) — READY TO EXECUTE
Plan: Not started
Status: Ready to execute
Last activity: 2026-08-26 — Phase 13 complete, transitioned to Phase 14

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
| Phase 10-users-roles-server-authorization P07 | 5min | 2 tasks | 8 files |
| Phase 10-users-roles-server-authorization P08 | 12min | 2 tasks | 12 files |
| Phase 10-users-roles-server-authorization P09 | 25 | 3 tasks | 27 files |
| Phase 10-users-roles-server-authorization P11 | 8min | 2 tasks | 2 files |
| Phase 10-users-roles-server-authorization P10 | 5min | 3 tasks | 16 files |
| Phase 11 P01 | 8 | 2 tasks | 8 files |
| Phase 11 P02 | 8 | 2 tasks | 4 files |
| Phase 11 P04 | 4 | 2 tasks | 6 files |
| Phase 11-project-master-pm-assignment-stakeholders P03 | 4 | 2 tasks | 14 files |
| Phase 11-project-master-pm-assignment-stakeholders P05 | 8 | 2 tasks | 2 files |
| Phase 12-milestone-raid-master-registers P01 | 8 | 2 tasks | 14 files |
| Phase 12-milestone-raid-master-registers P02 | 8min | 3 tasks | 18 files |
| Phase 12-milestone-raid-master-registers P03 | 4min | 3 tasks | 11 files |
| Phase 13-weekly-periods-pm-submit P01 | 25 | 2 tasks | 18 files |
| Phase 13-weekly-periods-pm-submit P02 | 25min | 2 tasks | 12 files |
| Phase 13-weekly-periods-pm-submit P03 | 25 | 2 tasks | 9 files |

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
- [Phase 10]: Named expense mutators createExpense/deleteExpense per D-24 same bar as budget-item CRUD
- [Phase 10]: D-23 carve-out unchanged — no role asserts on operations/** or /api/admin/companies
- [Phase 10]: AI report POST write gates at route boundary; portfolio list helpers use company_id only until 10-09 repo cleanup
- [Phase 10]: assertCompanyWrite is actor-only; tenant assert must scope resource company first (D-16)
- [Phase 10]: Repo list helpers dropped isAdmin param; company_id-only SQL (D-13)
- [Phase 10]: Sidebar Admin Panel shown for cpmo role without break-glass; platform tabs stay is_admin-only
- [Phase 10]: Admin Users form uses roles[] and email against 10-05 API; company_id from session not UI
- [Phase 10]: All portfolio/programs routes use toAccessActor(user) so roles reach write asserts (D-03, D-24)
- [Phase 11]: Tracer 11-01-01 implemented duplicate/foreign-program checks; task 11-01-02 required no additional production diff
- [Phase 11]: Extended governance prior with status_reason for merged Other validation on PATCH
- [Phase 11]: findProjectByCompanyCode clash filtered by excluding current project id in service
- [Phase 11]: Singleton stakeholder roles enforced in service via hasActiveStakeholderForRole repo query
- [Phase 11]: PATCH /stakeholders ends role by body.id with optional effective_to
- [Phase 11]: Kept assertPmWriteAccess name; all PM access via hasActivePmAssignment after D-14 backfill
- [Phase 12]: Three raid_masters settings flags run ddl then backfill then indexes
- [Phase 12]: raid-masters.service owns company-scoped upcoming/overdue date window computation
- [Phase 12]: Auto-code R-/I- prefix zero-padded 3 digits; risk_id/issue_id populated from code
- [Phase 12]: RAID retire via deactivate status string, not physical DELETE
- [Phase 12]: Due-date history loads prior row only when due_date is in the update payload
- [Phase 12]: listHighOpenRaid count equals UNION ALL record length, never distinct project_id
- [Phase 13]: Transaction uses PoolClient for period+shell inserts on one connection
- [Phase 13]: Submit route uses rawBody:true for body-less POST
- [Phase 13]: Snapshot stores draft_raid_json on shell only until 13-03 submit RAID writes
- [Phase 13]: SubmitValidationError fields[] separate from ValidationError.field for multi-field 400 mapping
- [Phase 13]: Submit copies progress_pct read-only; updateProject rag-only when this_week_rag differs

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

Last session: 2026-08-25T23:50:25.732Z
Stopped at: Phase 13 complete, ready to plan Phase 14
Resume file: None
