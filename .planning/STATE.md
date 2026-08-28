---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Hardening & Deferred Debt
current_phase: 20
current_phase_name: API Contract & Leftover Routes
status: executing
stopped_at: Completed 20-03-PLAN.md
last_updated: "2026-08-28T07:24:54.192Z"
last_activity: 2026-08-28
last_activity_desc: Phase 20 execution started
state_head: 9182e4df36a417395260995eab1e387aff737760
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 11
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-28)

**Core value:** One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.
**Current focus:** Phase 20 — API Contract & Leftover Routes

## Current Position

Phase: 20 (API Contract & Leftover Routes) — EXECUTING
Plan: 4 of 7
Status: Ready to execute
Last activity: 2026-08-28 — Phase 20 execution started

Progress: [██░░░░░░░░] 25%

## Performance Metrics

**Velocity:**

- Total plans completed: 75 (35 v1.0 + 40 v2.0)
- Average duration: - min
- Total execution time: - hours

**By Phase:** v1.0 Phases 1–8 complete (35 plans). v2.0 Phases 9–18 complete (40 plans). v2.1 Phases 19–27 not started.

**Recent Trend:**

- Last 5 plans: v2.0 Phase 18 closeout
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
| Phase 10-users-roles-server-authorization P06 | 4min | 3 tasks | 8 files |
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
| Phase 14-cpmo-tracking-consolidated-export P01 | 12min | 2 tasks | 10 files |
| Phase 14 P02 | 8min | 2 tasks | 5 files |
| Phase 14-cpmo-tracking-consolidated-export P03 | 3min | 2 tasks | 9 files |
| Phase 15-budget-value-roi-dependencies P01 | 25min | 2 tasks | 15 files |
| Phase 15-budget-value-roi-dependencies P02 | 25 | 3 tasks | 15 files |
| Phase 15-budget-value-roi-dependencies P03 | 25 | 3 tasks | 7 files |
| Phase 16 P01 | 25 | 3 tasks | 14 files |
| Phase 16 P02 | 15min | 2 tasks | 15 files |
| Phase 16-portfolio-pm-dashboards P03 | 5 | 2 tasks | 8 files |
| Phase 17-document-templates-confluence-checklist P01 | 25 | 3 tasks | 13 files |
| Phase 17-document-templates-confluence-checklist P02 | 25min | 3 tasks | 15 files |
| Phase 17-document-templates-confluence-checklist P03 | 15 | 3 tasks | 11 files |
| Phase 18-append-only-audit-log P01 | 12 | 3 tasks | 7 files |
| Phase 18 P02 | 3min | 2 tasks | 4 files |
| Phase 18 P03 | 12min | 3 tasks | 6 files |
| Phase 19 P01 | 5 | 3 tasks | 11 files |
| Phase 19-data-layer-cutover P02 | 10min | 3 tasks | 6 files |
| Phase 19 P03 | 5 | 3 tasks | 13 files |
| Phase 19-data-layer-cutover P04 | 8min | 3 tasks | 12 files |
| Phase 20-api-contract-leftover-routes P01 | 2min | 3 tasks | 2 files |
| Phase 20-api-contract-leftover-routes P02 | 5 min | 2 tasks | 3 files |
| Phase 20-api-contract-leftover-routes P03 | 5min | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.1 numbering continues from Phase 18; starts at Phase 19 (do not reset to Phase 1)
- DATA-01..03 live in one phase (19); replay origin `gsd/quick-260826-ded-data-layer-migrations` as a pattern; regenerate `migrations/0001` from current v2.0 schema; never merge that branch as-is
- MOD-01 is repo-wide; v2 UI (21–23) lands in `modules/<feature>/ui/` first; Phase 24 completes remaining feature areas + MOD-02 thin `app/` re-exports
- NYQ-01 maps to Phase 27 closeout only; earlier v2.1 phases may still write VALIDATION.md as hygiene
- HYG-02 is operator confirm in Phase 27, not a rewrite
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
- [Phase 14]: Tracking orchestration in weekly-tracking.service.ts; counts before filters; company-scoped listPeriodShellsRepo
- [Phase 14]: Export preview eligibility uses SubmitValidationError with stringified project_ids in fields
- [Phase 14]: assembleSnapshotSections exported for 14-03 with full raid arrays and snapshot-only tech issues
- [Phase 14]: Generators accept ConsolidatedWeeklyPayload only — no live RAID reads (D-01, D-07)
- [Phase 14]: Generate Buffer before insertWeeklyExportLog so pack failures leave no log row (D-09)
- [Phase 15]: Import guard targets line-item budget.repo only
- [Phase 15]: budget-adjustments.repo included in task 1 for GET overview sum
- [Phase 15]: Nonfinancial benefits and PATCH shipped in task-1 GREEN commit e6f7f55 for cohesive benefits.service
- [Phase 15]: Overlap duplicate uses date-window intersection with open-ended effective_to
- [Phase 16]: Tracer shipped full portfolio dashboard spine; tasks 02-03 were test-only expansions
- [Phase 16]: Filter upsert replaces whole blob; export Buffer before auditLog
- [Phase 16]: PM dashboard uses listProjects pmUserId; weekly via listPeriodShellsRepo not getPeriodTracking
- [Phase 16]: PM filter routes use withAuth and surface pm (not withCpmo)
- [Phase 17]: apply_to_in_flight shipped in tracer task 1; task 2 tests validate behavior
- [Phase 17]: URL-only templates via template_url; effective list DISTINCT ON catalog_id
- [Phase 17]: Stage guard checks current-stage mandatory items only; ALL-stage catalog excluded
- [Phase 17]: Structured 409 mandatory_incomplete distinct from ConflictError error shape
- [Phase 18]: Route tests mock repo listAuditLogs so real assertCompanyWrite runs for null-company CPMO 403
- [Phase 18]: Skipped D-10 settings-flag migrate — company_id column already exists
- [Phase 18]: entity_type remains risk and issue separately — no unified raid string (D-02 discretion locked)
- [Phase 18]: due_date-only updates emit due_date_change only; non-due_date keys emit action update
- [Phase 18]: General project updates use action update with full snapshots; code_change and stage_change_ack remain separate
- [Phase 18]: Checklist uses action status_change when status or confluence_url differs; otherwise action update
- [Phase 19]: Ported origin migrate runner/ledger pattern verbatim; probe SQL for Postgres test; no origin 0001 SQL (D-02)
- [Phase 19]: Regenerated 0001 from lib/db.ts + exports; origin v1.0 SQL not copied (D-02)
- [Phase 19]: MAPPING_TENANT_DDL excludes CROSS JOIN backfill — operator scripts in 19-03
- [Phase 19]: Export backfillRaidMasters for operator script reuse without DDL/index side effects
- [Phase 19]: v2 backfills delegate to existing lib/db-*.ts helpers with settings flags
- [Phase 19]: Removed boot schema functions from lib/db.ts; external migrate is sole DDL writer
- [Phase 19]: Runner copies node_modules from deps so nextjs user runs npx tsx migrate before server
- [Phase 20]: D-01: proxy API detection uses pathname /api/ prefix not Accept header
- [Phase 20]: D-02: proxy unauthenticated API returns { error: Unauthorized } matching withAuth
- [Phase 20]: jql optional in jiraSearchSchema so empty body hits handler freeze message under Zod 4
- [Phase 20]: Path gate uses literal /projects/[id]/ segments; allowlist JSON for D-23; lint scoped to app/api/**/route.ts

### Pending Todos

None yet.

### Blockers/Concerns

- HYG-02 Anthropic 502 vs old 500 still needs operator confirm — scheduled Phase 27 (not a rewrite unless rejected)
- Leftover v1.0 ops-route thinning and proxy JSON 401 — scheduled Phase 20
- DATA-01..03 brownfield ledger stamp (Railway, K8s, local) and Docker/tsx migrate wiring — plan during Phase 19; do not merge origin DATA branch as-is

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| Data Layer | DATA-01, DATA-02, DATA-03 | scheduled — v2.1 Phase 19 | 2026-08-07 | v1.0 → v2.1 |
| Enforcement | ENF-01 | scheduled — v2.1 Phase 20 | 2026-08-07 | v1.0 → v2.1 |
| Enforcement | ENF-02 | scheduled — v2.1 Phase 25 | 2026-08-07 | v1.0 → v2.1 |
| Performance | PERF-01 | scheduled — v2.1 Phase 22 | 2026-08-07 | v1.0 → v2.1 |
| Performance | PERF-02, PERF-03 | scheduled — v2.1 Phase 26 | 2026-08-07 | v1.0 → v2.1 |

## Session Continuity

Last session: 2026-08-28T07:24:54.067Z
Stopped at: Completed 20-03-PLAN.md
Resume file: None

## Operator Next Steps

- Review `.planning/ROADMAP.md` and approve, then `/gsd-plan-phase 19`
