# Requirements: PM Tool B — Portfolio One View (v2.0)

**Defined:** 2026-08-25
**Core Value:** One source of truth for projects, milestones, RAID, and weekly reports — role- and project-scoped — so CPMO and PMs act on highlights, nearest milestones, open risks/issues, and items that need leadership support.

**Spec reference (not in git):** `docs/GuiIT_2008_Portfolio One View_Yeu cau nghiep vu (1).docx` (Draft 1.0, 20/08/2026)

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases. Jira import, AI reports, and Excel/PPT/Word export stay as shipped capabilities — they are not restated here unless a spec path reuses them.

### Users and Roles

- [x] **USER-01**: Admin can list, search, and filter users by status, role, and unit
- [x] **USER-02**: Admin can create or update a user with unique username and unique email; a locked account's username/email cannot be reused on another account
- [x] **USER-03**: Admin can assign one or more roles to a user; effective permissions are the union of assigned roles
- [x] **USER-04**: Admin can set account status to Active, Inactive, or Locked; only Active users can log in
- [x] **USER-05**: Admin can lock or unlock an account; the system records who changed the record and when
- [x] **USER-06**: A user who has generated business data cannot be physically deleted; history still shows their display name

### Login and Authorization

- [x] **AUTH-01**: User can log in with username and password
- [x] **AUTH-02**: User session expires per policy; a valid session can be extended without losing in-progress draft input
- [x] **AUTH-03**: User can log out and end the session
- [x] **AUTH-04**: CPMO can view the full company portfolio; PM can view and update only assigned projects; Viewer can read but cannot mutate
- [x] **AUTH-05**: Every API and screen enforces authorization on the server; hiding a UI control is not treated as access control
- [x] **AUTH-06**: Inactive or Locked users receive a login rejection and cannot obtain a session

### Project Master Data

- [x] **PROJ-01**: CPMO can create a project with required identity fields: portfolio year, name, unique project code, and program; only CPMO can set or change project code
- [x] **PROJ-02**: Changing a project code does not drop or recreate linked records
- [x] **PROJ-03**: User with write access can maintain classification, governance, stage (L0–L5), status, RAG, progress (0–100%), and timeline dates (start, plan end, adjusted end, actual end)
- [x] **PROJ-04**: Status "Other" requires a reason; weekly-report flag "Yes" requires a start period
- [x] **PROJ-05**: Stage L5 defaults status to Completed, RAG to Not applicable, and progress to 100%, with a warning if the user overrides or if progress was below 100%
- [x] **PROJ-06**: Stage L5 or status Completed/Paused/Cancelled/Other defaults RAG to Not applicable, with a warning if the user chooses otherwise
- [x] **PROJ-07**: Progress updates do not overwrite progress stored in previously submitted weekly reports
- [x] **PROJ-08**: Only projects with weekly-report = Yes generate weekly obligations from the chosen start period forward; turning the flag off stops future periods without deleting history; L5 or terminal status also stops future obligations

### PM Assignment

- [x] **PMAS-01**: CPMO can assign exactly one active primary PM per project, or leave a project with no PM
- [x] **PMAS-02**: CPMO can assign collaborating PMs only when a primary PM is active; a user cannot be both primary and collaborator on the same project at once
- [x] **PMAS-03**: CPMO can change or revoke assignments; the system keeps assignment history by period
- [x] **PMAS-04**: A PM's write access to a project starts and ends with the effective assignment window

### Stakeholders

- [x] **STKH-01**: User with write access can record sponsor, PSC chair, PSC members, project director, and key stakeholders, choosing existing users or external parties without accounts
- [x] **STKH-02**: User can set effective date ranges and end a stakeholder role without deleting history
- [x] **STKH-03**: Stakeholder data is the same source used on project info, dashboards, and reports

### Cross-Project Dependencies

- [ ] **DEP-01**: User with write access can create a dependency between two different projects with required fields and a valid need-by / effective date window
- [ ] **DEP-02**: System rejects self-links, duplicate equivalent active relations, and invalid date ranges
- [ ] **DEP-03**: A saved dependency appears on both projects with the correct direction; PMs of both projects can view it; the action is audit-logged

### Milestones

- [x] **MS-01**: PM (assigned) and CPMO can create, update, and cancel milestones on projects in their scope; Viewer cannot mutate
- [x] **MS-02**: Dashboard shows upcoming milestones (7 days before plan or adjusted end) excluding Completed/Cancelled
- [x] **MS-03**: A milestone is overdue when today is after plan or adjusted end and status is not Completed/Cancelled; it appears on the dashboard action list
- [x] **MS-04**: Submitted weekly reports store a milestone snapshot; later milestone edits do not change old reports
- [x] **MS-05**: A milestone that appeared in a submitted weekly report cannot be physically deleted

### Budget and Value

- [ ] **BUDG-01**: User with write access can record approved budget and actual spend by fiscal year and cost type in VND (non-negative integer amounts)
- [ ] **BUDG-02**: Budget remaining and utilization are computed from approved vs actual; remaining < 0 is flagged as over budget; remaining = 0 shows fully used
- [ ] **BUDG-03**: Budget increases or decreases are append-only adjustment records (amount, effective date, reason); prior approvals are never overwritten
- [ ] **BUDG-04**: User can record financial benefits by year and type (expected vs actual; actual blank means no data, distinct from 0)
- [ ] **BUDG-05**: User can record non-financial benefits with group, measure, and target
- [ ] **BUDG-06**: Expected and actual ROI display as a computed percent only when inputs are complete; otherwise the UI shows insufficient data, never a fake 0%

### Risk and Issue Register

- [x] **RAID-01**: PM (assigned) and CPMO can create, update, and deactivate risks and issues with a unique code per project; Viewer cannot mutate
- [x] **RAID-02**: The register is the master; weekly reports reference master records and store snapshots — they are not a second independent RAID store
- [x] **RAID-03**: Draft weekly-report RAID edits stay on the draft until submit; submit validates, writes the master, stores a version, locks the snapshot, and refreshes dashboards — or rejects the submit with the fields to fix
- [x] **RAID-04**: Overdue open RAID items are flagged and shown on dashboards; changing a due date keeps prior due-date history
- [x] **RAID-05**: Project register defaults to Open / In progress, ordered High then Medium then Low, with overdue first within a severity
- [x] **RAID-06**: Portfolio dashboard counts High open/in-progress RAID records (not projects) and lists technology-council issues when that flag is set

### Weekly Report Periods

- [x] **PERD-01**: CPMO can configure weekly periods with display name `YYYY-Wnn | start – end`, due datetime, and auto-create of report shells for obligated projects
- [x] **PERD-02**: Each created period stores a snapshot of the config used; later config changes do not alter already-created periods or reports
- [x] **PERD-03**: A report is overdue when now is after due datetime and status is Not submitted or Draft; PM can still submit late

### Weekly Report Submit

- [x] **WKRP-01**: System creates at most one report obligation per project per period, and only when the project is obligated
- [x] **WKRP-02**: PM can save a draft and submit a structured weekly report (highlights, completed work, next-week goals, nearest milestone, RAID/dependency, leadership support)
- [x] **WKRP-03**: Previous-week RAG is prefilled read-only; this-week RAG is chosen by the PM and syncs to master on submit when it differs
- [x] **WKRP-04**: Submit records submitter, first-submit timestamp, and on-time vs late; later corrections do not change first-submit lateness
- [x] **WKRP-05**: A submitted report is an immutable snapshot; a later correction creates a new version and keeps prior versions
- [x] **WKRP-06**: History shows one row per period (latest submitted version), newest period first, with period, status, RAG, submit time, submitter, and on-time/late

### CPMO Weekly Tracking and Export

- [x] **CPMO-01**: CPMO can see obligated-project counts and Not submitted / Draft / Submitted / Overdue / Late for a period
- [x] **CPMO-02**: CPMO can filter the tracking grid by period, status, lateness, PM, stage, RAG, and technology-council issues, then open a report
- [x] **CPMO-03**: CPMO can tick-select projects, preview consolidation, reorder projects, and export an editable consolidated pack (Excel/Word/PPT as already supported)
- [ ] **CPMO-04**: Export records period, data version, and who exported; project sections include identity, PM, stage, prior/current RAG, progress, highlights, next-week goals, nearest milestone, RAID, and technology issues

### Portfolio Dashboard

- [ ] **PDSH-01**: CPMO/leadership dashboard shows active project count (status Active and stage L0–L4), on-track (Active + Green), and watch/act (Active + Amber/Red)
- [ ] **PDSH-02**: Dashboard charts projects by L0–L5 and by RAG; Green + Amber + Red equals the active count
- [ ] **PDSH-03**: Dashboard shows overdue-milestone project count and High open RAID record count, with drill-down lists matching the tiles
- [ ] **PDSH-04**: Dashboard shows technology-council issue count with a drill-down list of open/in-progress flagged issues
- [ ] **PDSH-05**: Project list and AND-combined filters (year, program, unit, PM, stage, status, RAG, type, weekly-report flag) apply to the whole dashboard, persist in the session, and are inherited on drill-down
- [ ] **PDSH-06**: User can clear filters, restore defaults, and export the dashboard to Excel and PDF

### PM Dashboard

- [ ] **MDSH-01**: PM sees only assigned projects, with the same list fields as the portfolio list for those rows
- [ ] **MDSH-02**: PM sees weekly-report actions for obligated Not submitted/Draft reports, with period, due, status, and a submit control
- [ ] **MDSH-03**: PM sees milestone actions for upcoming or overdue assigned-project milestones, with dates and an update control
- [ ] **MDSH-04**: PM sees High open/in-progress RAID actions that are also upcoming or overdue, with a technology-council flag when set
- [ ] **MDSH-05**: Each action deep-links to the screen that resolves it; completing the action refreshes the dashboard in the same session

### Project Documents

- [ ] **DOC-01**: CPMO can maintain a document catalog (name, purpose, stage, mandatory flag, active status) and decide whether catalog changes apply to in-flight projects
- [ ] **DOC-02**: Creating a project or changing stage generates the applicable checklist; prior-stage items remain for history
- [ ] **DOC-03**: CPMO can upload, replace, and retire templates (name, document type, version, effective date, guidance); only the effective version is shown to PMs by default; old versions stay for history
- [ ] **DOC-04**: PM can view/download templates and update checklist metadata, Confluence HTTPS link, and status (None / Drafting / Pending approval / Approved / Not applicable) — and cannot upload project file binaries
- [ ] **DOC-05**: Approved requires approval date and approver; Not applicable requires a reason; Approved mandatory items count as compliant
- [ ] **DOC-06**: CPMO can see portfolio compliance (compliant / not compliant / not applicable) with filters, and is warned when a stage change leaves mandatory items incomplete

### Tenant Isolation Follow-up

- [x] **TENANT-01**: `timeline_import_mappings`, `bug_import_mappings`, `jira_jql_presets`, and `jira_sync_mappings` are scoped by `company_id` with backfill, non-null company, unique keys including company, and cross-company 403 tests

### Audit

- [ ] **AUDIT-01**: Mutations to users, assignments, project master, RAID, milestones, budget adjustments, weekly submissions, and document checklist status append an audit record (actor, time, entity, before/after) that cannot be edited in place

## Future Requirements

Deferred. Tracked but not in this milestone's roadmap.

### Data Layer

- **DATA-01**: Schema init and the migration loop move out of `getDb()` into an external migrate job so app start only connects
- **DATA-02**: Migrations become versioned files rather than an in-code loop
- **DATA-03**: Data-fix `UPDATE`s currently running as migrations move to one-off scripts

### Enforcement

- **ENF-01**: An ESLint rule or CI check fails the build when a project-scoped `route.ts` exports a handler not wrapped by the sanctioned helper
- **ENF-02**: Repositories adopt Kysely over the existing `pg.Pool` so column allowlists are enforced at compile time

### Performance

- **PERF-01**: Large grids are virtualized
- **PERF-02**: Static page chrome moves to server components
- **PERF-03**: Cold-start time is measured and budgeted

### Leftover v1.0 debt

- Ops/admin/config/import-mapping service thinning (SVC-01 / ROUTE-05 remainder)
- Operator confirm of Anthropic 502 vs old 500 (HYG-02)
- JSON 401 from `proxy.ts` for API callers
- Jira search debug `console.log` / unguarded `req.json()`

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replacing Jira import, AI reports, or Excel/PPT/Word export | Keep as shipped differentiators beside One View |
| In-app upload of project document binaries | Spec stores Confluence links only |
| Second independent RAID store inside weekly reports | Register is master; reports snapshot on submit |
| In-place edit of a submitted weekly report | Corrections create a new version |
| Backfilling weekly obligations for periods before the start period | Spec forbids retroactive create |
| CASL / casbin / full policy engine | Three fixed roles; extend existing wrappers |
| ORM / Kysely / replacing `pg` | DATA/ENF deferred; v1.0 repositories stay |
| Committing the GuiIT Word spec | Local reference only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| USER-01 | Phase 10 | Complete |
| USER-02 | Phase 10 | Complete |
| USER-03 | Phase 10 | Complete |
| USER-04 | Phase 10 | Complete |
| USER-05 | Phase 10 | Complete |
| USER-06 | Phase 10 | Complete |
| AUTH-01 | Phase 10 | Complete |
| AUTH-02 | Phase 10 | Complete |
| AUTH-03 | Phase 10 | Complete |
| AUTH-04 | Phase 10 | Complete |
| AUTH-05 | Phase 10 | Complete |
| AUTH-06 | Phase 10 | Complete |
| PROJ-01 | Phase 11 | Complete |
| PROJ-02 | Phase 11 | Complete |
| PROJ-03 | Phase 11 | Complete |
| PROJ-04 | Phase 11 | Complete |
| PROJ-05 | Phase 11 | Complete |
| PROJ-06 | Phase 11 | Complete |
| PROJ-07 | Phase 11 | Complete |
| PROJ-08 | Phase 11 | Complete |
| PMAS-01 | Phase 11 | Complete |
| PMAS-02 | Phase 11 | Complete |
| PMAS-03 | Phase 11 | Complete |
| PMAS-04 | Phase 11 | Complete |
| STKH-01 | Phase 11 | Complete |
| STKH-02 | Phase 11 | Complete |
| STKH-03 | Phase 11 | Complete |
| DEP-01 | Phase 15 | Pending |
| DEP-02 | Phase 15 | Pending |
| DEP-03 | Phase 15 | Pending |
| MS-01 | Phase 12 | Complete |
| MS-02 | Phase 12 | Complete |
| MS-03 | Phase 12 | Complete |
| MS-04 | Phase 13 | Complete |
| MS-05 | Phase 12 | Complete |
| BUDG-01 | Phase 15 | Pending |
| BUDG-02 | Phase 15 | Pending |
| BUDG-03 | Phase 15 | Pending |
| BUDG-04 | Phase 15 | Pending |
| BUDG-05 | Phase 15 | Pending |
| BUDG-06 | Phase 15 | Pending |
| RAID-01 | Phase 12 | Complete |
| RAID-02 | Phase 13 | Complete |
| RAID-03 | Phase 13 | Complete |
| RAID-04 | Phase 12 | Complete |
| RAID-05 | Phase 12 | Complete |
| RAID-06 | Phase 12 | Complete |
| PERD-01 | Phase 13 | Complete |
| PERD-02 | Phase 13 | Complete |
| PERD-03 | Phase 13 | Complete |
| WKRP-01 | Phase 13 | Complete |
| WKRP-02 | Phase 13 | Complete |
| WKRP-03 | Phase 13 | Complete |
| WKRP-04 | Phase 13 | Complete |
| WKRP-05 | Phase 13 | Complete |
| WKRP-06 | Phase 13 | Complete |
| CPMO-01 | Phase 14 | Complete |
| CPMO-02 | Phase 14 | Complete |
| CPMO-03 | Phase 14 | Complete |
| CPMO-04 | Phase 14 | Pending |
| PDSH-01 | Phase 16 | Pending |
| PDSH-02 | Phase 16 | Pending |
| PDSH-03 | Phase 16 | Pending |
| PDSH-04 | Phase 16 | Pending |
| PDSH-05 | Phase 16 | Pending |
| PDSH-06 | Phase 16 | Pending |
| MDSH-01 | Phase 16 | Pending |
| MDSH-02 | Phase 16 | Pending |
| MDSH-03 | Phase 16 | Pending |
| MDSH-04 | Phase 16 | Pending |
| MDSH-05 | Phase 16 | Pending |
| DOC-01 | Phase 17 | Pending |
| DOC-02 | Phase 17 | Pending |
| DOC-03 | Phase 17 | Pending |
| DOC-04 | Phase 17 | Pending |
| DOC-05 | Phase 17 | Pending |
| DOC-06 | Phase 17 | Pending |
| TENANT-01 | Phase 9 | Complete |
| AUDIT-01 | Phase 18 | Pending |

**Coverage:**

- v1 requirements: 79 total
- Mapped to phases: 79
- Unmapped: 0 ✓

Phase 9: TENANT-01 (1)
Phase 10: USER-01..06, AUTH-01..06 (12)
Phase 11: PROJ-01..08, PMAS-01..04, STKH-01..03 (15)
Phase 12: MS-01, MS-02, MS-03, MS-05, RAID-01, RAID-04, RAID-05, RAID-06 (8)
Phase 13: PERD-01..03, WKRP-01..06, MS-04, RAID-02, RAID-03 (12)
Phase 14: CPMO-01..04 (4)
Phase 15: BUDG-01..06, DEP-01..03 (9)
Phase 16: PDSH-01..06, MDSH-01..05 (11)
Phase 17: DOC-01..06 (6)
Phase 18: AUDIT-01 (1)

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 after roadmap (Phases 9–18)*
