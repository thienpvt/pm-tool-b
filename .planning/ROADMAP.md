# Roadmap: PM Tool B — Portfolio One View

## Overview

v1.0 shipped the layer reorg (route → service → repository), tenant wrappers, integration clients, and god-page splits. v2.0 brings that stack into compliance with the GuiIT Portfolio One View spec: CPMO / PM / Viewer authorization, L0–L5 project master, RAID and milestones as masters with immutable weekly snapshots, CPMO period cadence, portfolio/PM dashboards, and Confluence document checklists — without replacing Jira import, AI reports, or Excel/PPT/Word export.

Phase numbering continues from v1.0 (Phases 1–8). v2.0 is Phases 9–18. Granularity is `standard`; ten phases are kept (not compressed) because TENANT-01, role authorization, project master, RAID/milestone registers, the weekly-report pipeline, dashboards, documents, and audit are distinct verifiable delivery boundaries.

## Milestones

- ✅ **v1.0 Layer Reorg & Hardening** — Phases 1–8 (shipped 2026-08-25)
- 🚧 **v2.0 Portfolio One View** — Phases 9–18 (in progress)

## Phases

<details>
<summary>✅ v1.0 Layer Reorg & Hardening (Phases 1–8) — SHIPPED 2026-08-25</summary>

- [x] Phase 1: Test Harness (1/1 plans) — completed 2026-08-07
- [x] Phase 2: Repository Layer (3/3 plans) — completed 2026-08-10
- [x] Phase 3: Integration Clients (4/4 plans) — completed 2026-08-10
- [x] Phase 4: Service Layer (7/7 plans) — completed 2026-08-11
- [x] Phase 5: Route Thinning & Validation (3/3 plans) — completed 2026-08-11
- [x] Phase 6: Access Enforcement Rollout (7/7 plans) — completed 2026-08-25
- [x] Phase 7: UI Decomposition (9/9 plans) — completed 2026-08-25
- [x] Phase 8: INTG-08 Credential Cutover (1/1 plans) — completed 2026-08-25

Full phase detail: [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
Requirements archive: [.planning/milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)
Audit: [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) (`tech_debt`, 54/54 requirements)

</details>

- [x] **Phase 9: Mapping Table Tenant Isolation** - Company-scope the four leftover mapping tables (completed 2026-08-26)
- [x] **Phase 10: Users, Roles & Server Authorization** - Admin user lifecycle plus CPMO / PM / Viewer enforcement (completed 2026-08-26)
- [ ] **Phase 11: Project Master, PM Assignment & Stakeholders** - L0–L5 master data, assignment windows, stakeholder records
- [ ] **Phase 12: Milestone & RAID Master Registers** - Upcoming/overdue masters with soft-delete and Viewer read-only
- [ ] **Phase 13: Weekly Periods & PM Submit** - CPMO periods, versioned submit, RAID/milestone snapshots
- [ ] **Phase 14: CPMO Tracking & Consolidated Export** - Submission grid, lateness, snapshot-based pack export
- [ ] **Phase 15: Budget, Value, ROI & Dependencies** - Fiscal budget ledger, honest ROI, cross-project links
- [ ] **Phase 16: Portfolio & PM Dashboards** - Spec KPIs, drill-down filters, PM action queues
- [ ] **Phase 17: Document Templates & Confluence Checklist** - Catalog, templates, Confluence links — no binary upload
- [ ] **Phase 18: Append-Only Audit Log** - Immutable actor/time/before-after trail on governed mutations

## Phase Details

### Phase 9: Mapping Table Tenant Isolation

**Goal**: Import mappings and Jira presets are isolated by company; another tenant cannot read or change them
**Depends on**: Phase 8 (v1.0 shipped)
**Requirements**: TENANT-01
**Success Criteria** (what must be TRUE):

  1. A user in company A cannot read or mutate another company's timeline import mappings, bug import mappings, Jira JQL presets, or Jira sync mappings (cross-company 403)
  2. Every mapping/preset/sync row belongs to a company; listings and unique names are scoped to that company
  3. Existing mapping data remains usable after backfill — no orphaned rows and no collapse of all tenants into one company

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — Tracer: timeline mapping tenant isolation (schema, service assert, 403)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Bug import mapping tenant isolation and company-scoped cap eviction

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03-PLAN.md — Jira JQL presets and sync mapping tenant isolation

### Phase 10: Users, Roles & Server Authorization

**Goal**: Admins manage users and roles; CPMO, PM, and Viewer sessions are enforced on every API and screen
**Depends on**: Phase 9
**Requirements**: USER-01, USER-02, USER-03, USER-04, USER-05, USER-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

  1. Admin can list, search, and filter users by status, role, and unit; create or update a user with unique username and unique email; assign one or more roles whose permissions union; and set Active, Inactive, or Locked — a locked account's username/email cannot be reused
  2. An Active user can log in with username and password, keep a session that expires per policy and can be extended without losing in-progress draft input, and log out to end the session; Inactive or Locked users are rejected and cannot obtain a session
  3. CPMO can view the full company portfolio; PM can view and update only assigned projects; Viewer can read but cannot mutate; every API and screen enforces this on the server — hiding a UI control is not treated as access control
  4. A user who has generated business data cannot be physically deleted; history still shows their display name; lock, unlock, and other user-record changes record who changed the record and when

**Plans:** 11/11 plans complete

Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Tracer: Inactive/Locked login reject, SessionUser.roles, Viewer createRisk 403, withAuth actor tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-02-PLAN.md — Session extend, mid-session revoke, logout, GET /api/auth/me
- [x] 10-03-PLAN.md — Company-scoped CPMO, interim PM assignment, D-14 nested GET, list/create
- [x] 10-05-PLAN.md — CPMO user admin API, audit on create/update, lock/deactivate

**Wave 3** *(blocked on Wave 2 plan 10-03 or 10-05 as listed)*

- [x] 10-04-PLAN.md — Nested mutators A: risks, issues, milestones (linkEpic/unlinkEpic), activities (importActivities)
- [x] 10-06-PLAN.md — Nested mutators B: meetings, team, bugs (replaceSnapshot), escalations
- [x] 10-07-PLAN.md — Holidays, documents (upsertDocument), budget, budget-items, createExpense/deleteExpense
- [x] 10-08-PLAN.md — AI POSTs: project/portfolio report, generate-email, send-email
- [x] 10-09-PLAN.md — Company-scoped programs/portfolio/roadmap lists + writes; allocations POST; resource-audit; listResourceMembers
- [x] 10-11-PLAN.md — /admin Users UI and Sidebar CPMO nav

**Wave 4** *(blocked on Wave 3 plans 10-04 and 10-09)*

- [x] 10-10-PLAN.md — toAccessActor on leftover portfolio/programs/milestones/report GET/epics actors + role-matrix

**UI hint**: yes

### Phase 11: Project Master, PM Assignment & Stakeholders

**Goal**: CPMO and PMs maintain spec-compliant project identity, L0–L5 governance, assignment windows, and stakeholder records as one source of truth
**Depends on**: Phase 10
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05, PROJ-06, PROJ-07, PROJ-08, PMAS-01, PMAS-02, PMAS-03, PMAS-04, STKH-01, STKH-02, STKH-03
**Success Criteria** (what must be TRUE):

  1. CPMO can create a project with portfolio year, name, unique project code, and program; only CPMO can set or change the code; changing the code does not drop or recreate linked records
  2. A user with write access can maintain classification, governance, stage (L0–L5), status, RAG, progress (0–100%), timeline dates, and the weekly-report flag; status Other requires a reason; weekly-report Yes requires a start period; L5 defaults status Completed, RAG Not applicable, and progress 100% with a warning on override; L5 or terminal status defaults RAG to Not applicable with a warning if the user chooses otherwise; live progress edits do not overwrite progress stored on previously submitted weekly reports; turning weekly-report off (or L5/terminal status) stops future obligations without deleting history
  3. CPMO can assign exactly one active primary PM per project or leave none; collaborating PMs only when a primary is active; a user cannot be both primary and collaborator on the same project; change/revoke keeps assignment history by period; a PM's write access starts and ends with the effective assignment window
  4. A user with write access can record sponsor, PSC chair, PSC members, project director, and key stakeholders (existing users or external parties) with effective date ranges, end a role without deleting history, and see the same stakeholder data on project info, dashboards, and reports

**Plans:** 2/5 plans executed

Plans:
**Wave 1**

- [x] 11-01-PLAN.md — Tracer: schema, unique project_code, CPMO create with year/program

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02-PLAN.md — L0–L5 governance, warnings JSON, CPMO in-place code change
- [ ] 11-04-PLAN.md — Stakeholder history nested API and listProjectStakeholders

**Wave 3** *(blocked on Wave 2 plan 11-02)*

- [ ] 11-03-PLAN.md — PM assignment windows, D-14 backfill, rewire all three PM lookup sites

**Wave 4** *(blocked on 11-02, 11-03, 11-04)*

- [ ] 11-05-PLAN.md — Existing create/detail fields so CPMO can operate (no UI-SPEC)

**UI hint**: yes

### Phase 12: Milestone & RAID Master Registers

**Goal**: Milestones and RAID are the project masters — upcoming/overdue rules, soft-delete, Viewer cannot mutate
**Depends on**: Phase 11
**Requirements**: MS-01, MS-02, MS-03, MS-05, RAID-01, RAID-04, RAID-05, RAID-06
**Success Criteria** (what must be TRUE):

  1. Assigned PM and CPMO can create, update, and cancel milestones on projects in their scope; Viewer cannot mutate; a milestone that appeared in a submitted weekly report cannot be physically deleted
  2. The dashboard shows upcoming milestones (7 days before plan or adjusted end, excluding Completed/Cancelled); a milestone is overdue when today is after plan or adjusted end and status is not Completed/Cancelled, and it appears on the dashboard action list
  3. Assigned PM and CPMO can create, update, and deactivate risks and issues with a unique code per project; Viewer cannot mutate; the register defaults to Open / In progress, ordered High then Medium then Low, with overdue first within a severity
  4. Overdue open RAID items are flagged and shown on dashboards; changing a due date keeps prior due-date history; portfolio High RAID counts are open/in-progress records (not projects); technology-council issues are listable when that flag is set

**Plans**: TBD
**UI hint**: yes

### Phase 13: Weekly Periods & PM Submit

**Goal**: CPMO configures weekly periods; PMs draft and submit versioned reports that snapshot RAID and milestones from the masters
**Depends on**: Phase 12
**Requirements**: PERD-01, PERD-02, PERD-03, WKRP-01, WKRP-02, WKRP-03, WKRP-04, WKRP-05, WKRP-06, MS-04, RAID-02, RAID-03
**Success Criteria** (what must be TRUE):

  1. CPMO can configure weekly periods with display name `YYYY-Wnn | start – end`, due datetime, and auto-create of at most one report shell per obligated project; each created period stores a snapshot of the config used so later config changes do not alter already-created periods or reports; a report is overdue when now is after due datetime and status is Not submitted or Draft, and the PM can still submit late
  2. PM can save a draft and submit a structured weekly report (highlights, completed work, next-week goals, nearest milestone, RAID/dependency, leadership support); previous-week RAG is prefilled read-only; this-week RAG is chosen by the PM and syncs to master on submit when it differs; submit records submitter, first-submit timestamp, and on-time vs late — later corrections do not change first-submit lateness
  3. A submitted report is an immutable snapshot; a later correction creates a new version and keeps prior versions; history shows one row per period (latest submitted version), newest period first, with period, status, RAG, submit time, submitter, and on-time/late
  4. The RAID register remains the master: draft weekly-report RAID edits stay on the draft until submit; submit validates, writes the master, stores a version, locks the snapshot, and refreshes dashboards — or rejects the submit with the fields to fix; later RAID edits do not change old reports
  5. Submitted weekly reports store a milestone snapshot; later milestone edits do not change old reports

**Plans**: TBD
**UI hint**: yes

### Phase 14: CPMO Tracking & Consolidated Export

**Goal**: CPMO sees period submission status and exports a consolidated pack from submitted snapshots, not live RAID
**Depends on**: Phase 13
**Requirements**: CPMO-01, CPMO-02, CPMO-03, CPMO-04
**Success Criteria** (what must be TRUE):

  1. CPMO can see obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late for a period
  2. CPMO can filter the tracking grid by period, status, lateness, PM, stage, RAG, and technology-council issues, then open a report
  3. CPMO can tick-select projects, preview consolidation, reorder projects, and export an editable consolidated pack (Excel/Word/PPT as already supported)
  4. Export records period, data version, and who exported; project sections include identity, PM, stage, prior/current RAG, progress, highlights, next-week goals, nearest milestone, RAID, and technology issues

**Plans**: TBD
**UI hint**: yes

### Phase 15: Budget, Value, ROI & Dependencies

**Goal**: Users record fiscal budget and benefits with honest ROI, and valid bidirectional cross-project dependencies
**Depends on**: Phase 14
**Requirements**: BUDG-01, BUDG-02, BUDG-03, BUDG-04, BUDG-05, BUDG-06, DEP-01, DEP-02, DEP-03
**Success Criteria** (what must be TRUE):

  1. A user with write access can record approved budget and actual spend by fiscal year and cost type in VND (non-negative integer amounts); remaining and utilization are computed from approved vs actual; remaining < 0 is flagged as over budget; remaining = 0 shows fully used
  2. Budget increases or decreases are append-only adjustment records (amount, effective date, reason); prior approvals are never overwritten
  3. A user can record financial benefits by year and type (expected vs actual; actual blank means no data, distinct from 0) and non-financial benefits with group, measure, and target; expected and actual ROI display as a computed percent only when inputs are complete — otherwise the UI shows insufficient data, never a fake 0%
  4. A user with write access can create a dependency between two different projects with required fields and a valid need-by / effective date window; the system rejects self-links, duplicate equivalent active relations, and invalid date ranges; a saved dependency appears on both projects with the correct direction; PMs of both projects can view it; the action is audit-logged

**Plans**: TBD
**UI hint**: yes

### Phase 16: Portfolio & PM Dashboards

**Goal**: CPMO sees spec portfolio KPIs with session filters and drill-down; PMs see only assigned projects and the actions they must take
**Depends on**: Phase 15
**Requirements**: PDSH-01, PDSH-02, PDSH-03, PDSH-04, PDSH-05, PDSH-06, MDSH-01, MDSH-02, MDSH-03, MDSH-04, MDSH-05
**Success Criteria** (what must be TRUE):

  1. CPMO/leadership dashboard shows active project count (status Active and stage L0–L4), on-track (Active + Green), and watch/act (Active + Amber/Red); charts projects by L0–L5 and by RAG; Green + Amber + Red equals the active count
  2. Dashboard shows overdue-milestone project count, High open RAID record count, and technology-council issue count, each with a drill-down list matching the tile
  3. Project list and AND-combined filters (year, program, unit, PM, stage, status, RAG, type, weekly-report flag) apply to the whole dashboard, persist in the session, and are inherited on drill-down; the user can clear filters, restore defaults, and export the dashboard to Excel and PDF
  4. PM sees only assigned projects, with the same list fields as the portfolio list for those rows, plus weekly-report actions for obligated Not submitted/Draft reports, milestone actions for upcoming or overdue assigned-project milestones, and High open/in-progress RAID actions that are also upcoming or overdue (with a technology-council flag when set)
  5. Each PM action deep-links to the screen that resolves it; completing the action refreshes the dashboard in the same session

**Plans**: TBD
**UI hint**: yes

### Phase 17: Document Templates & Confluence Checklist

**Goal**: CPMO maintains a document catalog and templates; PMs complete a stage checklist with Confluence links and cannot upload project file binaries
**Depends on**: Phase 16
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):

  1. CPMO can maintain a document catalog (name, purpose, stage, mandatory flag, active status) and decide whether catalog changes apply to in-flight projects; creating a project or changing stage generates the applicable checklist; prior-stage items remain for history
  2. CPMO can upload, replace, and retire templates (name, document type, version, effective date, guidance); only the effective version is shown to PMs by default; old versions stay for history
  3. PM can view/download templates and update checklist metadata, Confluence HTTPS link, and status (None / Drafting / Pending approval / Approved / Not applicable) — and cannot upload project file binaries; Approved requires approval date and approver; Not applicable requires a reason; Approved mandatory items count as compliant
  4. CPMO can see portfolio compliance (compliant / not compliant / not applicable) with filters, and is warned when a stage change leaves mandatory items incomplete

**Plans**: TBD
**UI hint**: yes

### Phase 18: Append-Only Audit Log

**Goal**: Mutations to governed entities leave an actor/time/before-after trail that cannot be edited in place
**Depends on**: Phase 17
**Requirements**: AUDIT-01
**Success Criteria** (what must be TRUE):

  1. Mutations to users, assignments, project master, RAID, milestones, budget adjustments, weekly submissions, and document checklist status append an audit record with actor, time, entity, and before/after
  2. An audit record cannot be edited in place; after a later business edit, the original actor, time, and payload are still visible
  3. Audit history is company-scoped — a user from another company cannot read another tenant's audit records

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Test Harness | v1.0 | 1/1 | Complete | 2026-08-07 |
| 2. Repository Layer | v1.0 | 3/3 | Complete | 2026-08-10 |
| 3. Integration Clients | v1.0 | 4/4 | Complete | 2026-08-10 |
| 4. Service Layer | v1.0 | 7/7 | Complete | 2026-08-11 |
| 5. Route Thinning & Validation | v1.0 | 3/3 | Complete | 2026-08-11 |
| 6. Access Enforcement Rollout | v1.0 | 7/7 | Complete | 2026-08-25 |
| 7. UI Decomposition | v1.0 | 9/9 | Complete | 2026-08-25 |
| 8. INTG-08 Credential Cutover | v1.0 | 1/1 | Complete | 2026-08-25 |
| 9. Mapping Table Tenant Isolation | v2.0 | 3/3 | Complete    | 2026-08-26 |
| 10. Users, Roles & Server Authorization | v2.0 | 11/11 | Complete    | 2026-08-26 |
| 11. Project Master, PM Assignment & Stakeholders | v2.0 | 2/5 | In Progress|  |
| 12. Milestone & RAID Master Registers | v2.0 | 0/? | Not started | - |
| 13. Weekly Periods & PM Submit | v2.0 | 0/? | Not started | - |
| 14. CPMO Tracking & Consolidated Export | v2.0 | 0/? | Not started | - |
| 15. Budget, Value, ROI & Dependencies | v2.0 | 0/? | Not started | - |
| 16. Portfolio & PM Dashboards | v2.0 | 0/? | Not started | - |
| 17. Document Templates & Confluence Checklist | v2.0 | 0/? | Not started | - |
| 18. Append-Only Audit Log | v2.0 | 0/? | Not started | - |

## Coverage

79/79 v2.0 v1-requirements mapped. Snapshot halves of PR-07/PR-09 (MS-04, RAID-02, RAID-03) sit in Phase 13 with weekly submit; master halves stay in Phase 12. No orphans.

Phases likely needing deeper planning research: 11 (L0–L5/RAG matrix vs Word spec), 13 (submit transaction and draft RAID buffer), 17 (legacy documents module vs Confluence checklist).
