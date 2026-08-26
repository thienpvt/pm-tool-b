# Phase 15 coverage map

Maps ROADMAP requirements and CONTEXT locked decisions to executable plans. Server tests are the gate (`workflow.ui_phase: false`).

## Requirements

| ID | Description | Plan | Tasks |
|----|-------------|------|-------|
| BUDG-01 | Approved + actual spend by fiscal year and cost type, integer VND | 15-01 | 15-01-01 |
| BUDG-02 | Remaining / utilization / over_budget / fully_used computed | 15-01 | 15-01-01 |
| BUDG-03 | Append-only adjustments; approvals not overwritten | 15-01 | 15-01-02 |
| BUDG-04 | Financial benefits; null actual ≠ 0; unique year+type | 15-02 | 15-02-01 |
| BUDG-05 | Non-financial benefits group / measure / target | 15-02 | 15-02-02 |
| BUDG-06 | ROI percent only when complete; never fake 0% | 15-02 | 15-02-03 |
| DEP-01 | Create dependency with required fields and date window | 15-03 | 15-03-01 |
| DEP-02 | Reject self-link, duplicate overlapping equivalent, invalid dates | 15-03 | 15-03-02 |
| DEP-03 | Both-end list with direction; PMs of either can GET; auditLog | 15-03 | 15-03-01, 15-03-03 |

## Decisions (D-01..D-16)

| ID | Lock | Plan |
|----|------|------|
| D-01 | Parallel fiscal tables/routes; do not store spec rows in budget_items / budget_expenses | 15-01 (prohibitions + import guard) |
| D-02 | project_fiscal_budgets unique (project, year, cost_type); integer VND BIGINT | 15-01 |
| D-03 | Remaining/utilization/flags computed, not stored | 15-01 computeFiscalBudgetMetrics |
| D-04 | budget_adjustments INSERT-only; PATCH actual only | 15-01-02 |
| D-05 | Write assertProjectWriteAccess; read assertProjectAccess; Viewer 403 | 15-01, 15-02, 15-03 |
| D-06 | financial_benefits; null actual_vnd = no data; unique (project, year, benefit_type) | 15-02-01 |
| D-07 | nonfinancial_benefits text fields | 15-02-02 |
| D-08 | Honest ROI helpers; year-level across all cost types | 15-02-03 |
| D-09 | project_dependencies; soft-end via effective_to | 15-01 DDL + 15-03 |
| D-10 | Reject self/dup/invalid window; write on from + access on to | 15-03-01, 15-03-02 |
| D-11 | List from OR to with direction; auditLog create/end | 15-03-01, 15-03-03 |
| D-12 | lib/db-fiscal-budget.ts after migrateWeeklyReports; no physical DELETE helpers | 15-01 |
| D-13 | /fiscal-budget, /benefits, /roi, /dependencies; do not reuse /budget | 15-01, 15-02, 15-03 |
| D-14 | ui_phase false; server tests are the gate | all plans (prohibitions) |
| D-15 | No CASL; do not re-gate leftover ops/admin | all plans (prohibitions) |
| D-16 | Export computeFiscalBudgetMetrics and listOpenProjectDependencies; no dashboard tiles | 15-01 metrics export; 15-03 listOpen export |

## Planner-locked enums and fiscal rules

| Lock | Plan |
|------|------|
| cost_type CAPEX \| OPEX | 15-01 |
| benefit_type COST_SAVING \| REVENUE \| PRODUCTIVITY | 15-02 |
| dependency_type FINISH_TO_START \| START_TO_START \| FINISH_TO_FINISH \| START_TO_FINISH \| BLOCKS | 15-03 |
| First POST creates unique fiscal row; later approved changes are adjustments | 15-01 |
| ROI year-level across all cost types | 15-02-03 |

## Deferred (not planned)

- Portfolio / PM dashboards consuming over-budget / open deps — Phase 16
- Document templates — Phase 17
- Full append-only audit coverage — Phase 18
- Migrating historical budget_items into fiscal-year rows

## File-layout lock (RESEARCH over PATTERNS.md)

| Path | Plan |
|------|------|
| lib/db-fiscal-budget.ts | 15-01 |
| lib/fiscal/vnd.ts | 15-01 |
| lib/fiscal/budget-metrics.ts | 15-01 |
| lib/fiscal/roi.ts | 15-02 |
| fiscal-budget.repo.ts / budget-adjustments.repo.ts | 15-01 |
| financial-benefits.repo.ts / nonfinancial-benefits.repo.ts | 15-02 |
| project-dependencies.repo.ts | 15-03 |
| fiscal-budget.service.ts | 15-01 |
| benefits.service.ts / roi.service.ts | 15-02 |
| project-dependencies.service.ts | 15-03 |
