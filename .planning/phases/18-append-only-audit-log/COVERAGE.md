No external API integration: first-party audit_logs INSERT/SELECT and GET /api/audit only; no third-party SDK or vendor API.

# Phase 18 coverage map

Maps ROADMAP AUDIT-01 and CONTEXT D-01..D-10 to executable plans. Server tests are the gate (`workflow.ui_phase: false`, D-08).

## Requirements

| ID | Description | Plan | Tasks |
|----|-------------|------|-------|
| AUDIT-01 | Governed mutations append actor/time/entity/before-after that cannot be edited in place | 18-01 (immutability + D-07), 18-02 (RAID gaps), 18-03 (project/milestone/checklist gaps) | all |
| AUDIT-01 (read) | Company-scoped history; another company cannot read records | 18-01 | 18-01-01, 18-01-03 |
| AUDIT-01 (immutability) | After a later business edit, original actor/time/payload still visible | 18-01 | 18-01-01, 18-01-02 |

## Decisions (D-01..D-10)

| ID | Lock | Plan |
|----|------|------|
| D-01 | Keep existing `audit_logs` + `auditLog()` INSERT path; no second table | 18-01 (prohibitions) |
| D-02 | Inventory vs required entity types; fill gaps only (`user`/`pm_assignment`/`budget_adjustment`/`weekly_report` already covered) | 18-02, 18-03 |
| D-03 | Payload: actor id, timestamp, entity_type, entity_id, action, before and/or after JSON | 18-02, 18-03 |
| D-04 | Repo INSERT + SELECT only; source-scan forbids mutating SQL; GET-only HTTP | 18-01 |
| D-05 | `company_id` already on the table; GET `WHERE company_id = actor.company_id`; null-company 403 via `assertCompanyWrite` | 18-01 |
| D-06 | GET `/api/audit` `withCpmo` + filters + limit default 50 max 200 | 18-01 |
| D-07 | Two mutations on the same entity: both rows remain; first row unchanged | 18-01-02 |
| D-08 | `ui_phase` false; server tests are the gate | all |
| D-09 | No CASL; do not re-gate leftover ops/admin/config; do not require audit on leftovers | all (prohibitions) |
| D-10 | Settings-flag migrate only if a new column or index is needed — column exists, skip migrate | 18-01 prohibitions |

## Planner-locked contracts

| Lock | Plan |
|------|------|
| Table name `audit_logs`; `insertAuditLog` contract unchanged | 18-01 |
| Service list export is `listAuditLogs` (mirror `listUsers`); repo `listAuditLogs(companyId, filters)` | 18-01 |
| RAID entity_type stays `'risk'` / `'issue'` (D-02 raid = union of those filters) | 18-02 |
| No `company_id` backfill; NULL company rows excluded by `company_id = ?` | 18-01 |
| No new index / no `lib/db-audit.ts` | 18-01 |
| Isolation none | all |

## Already covered (regression only — do not re-implement)

| entity_type | Service | Mutations |
|-------------|---------|-----------|
| `user` | `users.service.ts` | create, update, lock, unlock, deactivate |
| `pm_assignment` | `pm-assignments.service.ts` | create, end |
| `budget_adjustment` | `fiscal-budget.service.ts` | create |
| `weekly_report` | `weekly-reports.service.ts` | weekly_submit, weekly_correct |
| `risk` / `issue` | risks/issues services | due_date_change, deactivate |
| `milestone` | `milestones.service.ts` | cancel |
| `project` | `projects.service.ts` | code_change, stage_change_ack |
| `document_checklist` | checklist service | status_change when status or confluence_url changes |

## Deferred (not planned)

- UI-SPEC / audit history page (D-08; ROADMAP UI hint is not a gate)
- Auditing leftover ops/admin/config (D-09)
- Unified `'raid'` entity_type (discretion: keep `'risk'`/`'issue'`)
- `openWeeklyReportCorrection` overlay-open event (submit path already audited)
- `company_id` backfill of legacy NULL rows
- `(company_id, created_at)` index (D-10 column already present)

## File-layout lock (RESEARCH + PATTERNS)

| Path | Plan |
|------|------|
| `lib/repositories/audit.repo.ts` + unit + repo tests | 18-01 |
| `lib/services/audit.service.ts` + unit test | 18-01 |
| `app/api/audit/route.ts` + `route.test.ts` | 18-01 |
| `risks.service.ts` / `issues.service.ts` + unit tests | 18-02 |
| `projects.service.ts` / `milestones.service.ts` / `project-document-checklist.service.ts` + unit tests | 18-03 |

## Source audit

| SOURCE | ID | Feature/Requirement | Plan | Status | Notes |
|--------|----|---------------------|------|--------|-------|
| GOAL | — | Mutations leave an uneditable actor/time/before-after trail | 01-03 | COVERED | ROADMAP Phase 18 goal |
| REQ | AUDIT-01 | Users, assignments, project master, RAID, milestones, budget, weekly, checklist append audit | 01-03 | COVERED | Existing callers + gap fills |
| REQ | AUDIT-01 | Cannot be edited in place; later edit leaves original visible | 01 | COVERED | D-04 scan + D-07 |
| REQ | AUDIT-01 | Company-scoped history | 01 | COVERED | D-05, D-06 |
| RESEARCH | — | GET `/api/audit` does not exist yet | 01 | COVERED | |
| RESEARCH | — | `listAuditLogs` SELECT; INSERT contract unchanged | 01 | COVERED | D-01, D-04 |
| RESEARCH | — | Project create/update/delete gaps | 03 | COVERED | D-02 |
| RESEARCH | — | Risk/issue create + general update gaps | 02 | COVERED | D-02 |
| RESEARCH | — | Milestone create/update gaps | 03 | COVERED | D-02 |
| RESEARCH | — | Checklist PATCH beyond status/url | 03 | COVERED | D-02 |
| RESEARCH | — | Keep `'risk'`/`'issue'` names | 02 | COVERED | Discretion |
| RESEARCH | — | No new npm packages | all | COVERED | D-09 |
| RESEARCH | — | Optional index skipped (column exists) | 01 | COVERED | D-10 |
| CONTEXT | D-01..D-10 | All locked decisions | 01-03 | COVERED | See table above |
