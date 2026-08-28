---
phase: 15-budget-value-roi-dependencies
verified: 2026-08-26T13:35:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 15: Budget, Value, ROI & Dependencies Verification Report

**Phase Goal:** Users record fiscal budget and benefits with honest ROI, and valid bidirectional cross-project dependencies  
**Verified:** 2026-08-26T13:35:00Z  
**Status:** passed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | ------- | ---------- | -------------- |
| 1 | Write user records approved budget and actual spend by fiscal year and cost type in non-negative integer VND; remaining and utilization computed; remaining < 0 flagged over_budget; remaining = 0 flagged fully_used | ✓ VERIFIED | `parseNonNegativeVnd` rejects non-integers/negatives (`lib/fiscal/vnd.ts:3-8`); `computeFiscalBudgetMetrics` computes remaining/utilization/status without stored columns (`lib/fiscal/budget-metrics.ts:10-34`); GET wires metrics via `getFiscalBudgetOverview` (`lib/services/fiscal-budget.service.ts:96-108`); POST/PATCH routes (`app/api/projects/[id]/fiscal-budget/route.ts:13-31`); repo updates actual only (`lib/repositories/fiscal-budget.repo.ts:70-84`); unit tests pass (`lib/fiscal/budget-metrics.unit.test.ts`, `lib/services/fiscal-budget.service.unit.test.ts`) |
| 2 | Budget increases/decreases are append-only adjustment records; prior approvals never overwritten | ✓ VERIFIED | `budget_adjustments` INSERT-only repo (`lib/repositories/budget-adjustments.repo.ts:13-34`); `addBudgetAdjustment` never touches `approved_amount_vnd` (`lib/services/fiscal-budget.service.ts:155-190`); nested POST route (`app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts:10-16`); DDL CHECK `amount_vnd <> 0` (`lib/db-fiscal-budget.ts:23-32`); repo/service tests pass |
| 3 | Financial/nonfinancial benefits recorded; null actual_vnd ≠ 0; ROI percent only when complete — otherwise `{ status: 'insufficient' }`, never fake 0% | ✓ VERIFIED | Financial insert stores SQL NULL when `actual_vnd` omitted/null (`lib/services/benefits.service.ts:94-101`, `lib/repositories/financial-benefits.repo.ts:65-76`); nonfinancial text fields (`lib/repositories/nonfinancial-benefits.repo.ts`); `computeExpectedRoi`/`computeActualRoi` return insufficient on incomplete inputs (`lib/fiscal/roi.ts:4-27`); GET `/roi` aggregates year-level (`lib/services/roi.service.ts:7-41`, `app/api/projects/[id]/roi/route.ts:8-22`); roi unit tests prove 0% only with `status: 'ok'` when inputs complete (`lib/fiscal/roi.unit.test.ts:17-19,39-40`) |
| 4 | Cross-project dependencies: create with required fields/valid window; reject self/duplicate/invalid dates; bidirectional list with direction; soft-end; audit-logged | ✓ VERIFIED | POST/PATCH/GET routes, no DELETE export (`app/api/projects/[id]/dependencies/route.ts:10-35`); self-link/overlap/date validation (`lib/services/project-dependencies.service.ts:69-106`); bidirectional list with direction + peer (`lib/repositories/project-dependencies.repo.ts:65-77`, `lib/services/project-dependencies.service.ts:50-59`); soft-end via `effective_to` (`lib/repositories/project-dependencies.repo.ts:133-155`); `auditLog` on create/end (`lib/services/project-dependencies.service.ts:124-166`); repo/service/route tests pass |

**Score:** 4/4 ROADMAP success criteria verified (16/16 plan truths verified; see Plan Truths below)

### Plan Truths (15-01 / 15-02 / 15-03)

| Plan | Truth | Status |
| --- | --- | --- |
| 15-01 | POST fiscal-budget 201 with unique (project, year, cost_type) | ✓ VERIFIED |
| 15-01 | GET returns computed metrics (not stored columns) | ✓ VERIFIED |
| 15-01 | PATCH actual only; duplicate POST 409; Viewer mutators 403 | ✓ VERIFIED |
| 15-01 | POST adjustments INSERT-only; auditLog on create/adjustment | ✓ VERIFIED |
| 15-01 | `migrateFiscalBudget` after `migrateWeeklyReports` in getDb | ✓ VERIFIED |
| 15-01 | `computeFiscalBudgetMetrics` exported for Phase 16 | ✓ VERIFIED |
| 15-02 | Financial benefits: null actual_vnd stores NULL; 0 stores 0; duplicate 409 | ✓ VERIFIED |
| 15-02 | Nonfinancial benefits: group/measure/target text, no numeric coercion | ✓ VERIFIED |
| 15-02 | GET /roi returns expected/actual insufficient or ok percent | ✓ VERIFIED |
| 15-02 | Incomplete ROI never serializes fake numeric 0 | ✓ VERIFIED |
| 15-02 | Viewer 403 on benefit mutators; auditLog on writes | ✓ VERIFIED |
| 15-03 | POST dependencies with write on from + access on to | ✓ VERIFIED |
| 15-03 | Rejects self-link, overlap duplicate, invalid date window | ✓ VERIFIED |
| 15-03 | GET bidirectional with direction outgoing/incoming | ✓ VERIFIED |
| 15-03 | PATCH soft-end; auditLog create/end; no DELETE | ✓ VERIFIED |
| 15-03 | `listOpenProjectDependencies` exported for Phase 16 | ✓ VERIFIED |

### D-01 Parallel Surface

| Check | Status | Evidence |
| --- | --- | --- |
| Fiscal data in new tables, not `budget_items` | ✓ VERIFIED | DDL `project_fiscal_budgets`, `budget_adjustments` (`lib/db-fiscal-budget.ts:8-32`) |
| New routes `/fiscal-budget`, `/benefits`, `/roi`, `/dependencies` | ✓ VERIFIED | Route files exist under `app/api/projects/[id]/` |
| Fiscal services do NOT import v1 `budget.repo.ts` | ✓ VERIFIED | Import guard test (`lib/services/fiscal-budget.service.unit.test.ts:81-84`); no `@/lib/repositories/budget.repo` in fiscal/benefits/roi/dependencies services |
| v1 `/api/projects/[id]/budget` untouched | ✓ VERIFIED | Not in phase `files_modified`; fiscal prohibition honored |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `lib/db-fiscal-budget.ts` | Settings-flag DDL, five tables | ✓ VERIFIED | `FISCAL_BUDGET_DDL_FLAG`, all five CREATE TABLE fragments |
| `lib/fiscal/vnd.ts` | VND parsers | ✓ VERIFIED | `parseNonNegativeVnd`, `parseSignedNonZeroVnd` |
| `lib/fiscal/budget-metrics.ts` | Computed metrics | ✓ VERIFIED | Exported `computeFiscalBudgetMetrics` |
| `lib/fiscal/roi.ts` | Honest ROI helpers | ✓ VERIFIED | `computeExpectedRoi`, `computeActualRoi` |
| `lib/repositories/fiscal-budget.repo.ts` | CRUD without approval overwrite | ✓ VERIFIED | `updateFiscalBudgetActual` only |
| `lib/repositories/budget-adjustments.repo.ts` | INSERT-only adjustments | ✓ VERIFIED | No UPDATE/DELETE helpers |
| `lib/repositories/financial-benefits.repo.ts` | Nullable actual_vnd | ✓ VERIFIED | INSERT/UPDATE preserve NULL |
| `lib/repositories/nonfinancial-benefits.repo.ts` | Text benefits | ✓ VERIFIED | group/measure/target columns |
| `lib/repositories/project-dependencies.repo.ts` | Bidirectional list, soft-end | ✓ VERIFIED | `listOpenProjectDependencies` exported |
| `lib/services/fiscal-budget.service.ts` | Fiscal orchestration | ✓ VERIFIED | Wired to repos + metrics |
| `lib/services/benefits.service.ts` | Benefits orchestration | ✓ VERIFIED | Financial + nonfinancial |
| `lib/services/roi.service.ts` | Year-level ROI | ✓ VERIFIED | Aggregates budgets + benefits |
| `lib/services/project-dependencies.service.ts` | Dependency orchestration | ✓ VERIFIED | Validation + auditLog |
| `app/api/projects/[id]/fiscal-budget/route.ts` | GET/POST/PATCH | ✓ VERIFIED | withProjectAccess |
| `app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts` | POST adjustments | ✓ VERIFIED | POST-only |
| `app/api/projects/[id]/benefits/route.ts` | GET/POST/PATCH benefits | ✓ VERIFIED | Discriminated kind |
| `app/api/projects/[id]/roi/route.ts` | GET roi | ✓ VERIFIED | fiscal_year query param |
| `app/api/projects/[id]/dependencies/route.ts` | GET/POST/PATCH | ✓ VERIFIED | No DELETE export |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `lib/db.ts` | `lib/db-fiscal-budget.ts` | getDb migrate chain | ✓ WIRED | Lines 631-634: migrateWeeklyReports then migrateFiscalBudget |
| `fiscal-budget/route.ts` | `fiscal-budget.service.ts` | GET/POST/PATCH handlers | ✓ WIRED | Imports create/get/patch functions |
| `fiscal-budget.service.ts` | `budget-metrics.ts` | GET overview | ✓ WIRED | `computeFiscalBudgetMetrics` in map |
| `adjustments/route.ts` | `fiscal-budget.service.ts` | POST addBudgetAdjustment | ✓ WIRED | Nested budgetId param |
| `benefits/route.ts` | `benefits.service.ts` | CRUD handlers | ✓ WIRED | list/create/patch |
| `roi/route.ts` | `roi.service.ts` | GET getProjectRoi | ✓ WIRED | fiscal_year parsed |
| `roi.service.ts` | `roi.ts` | computeExpectedRoi/ActualRoi | ✓ WIRED | After aggregating repo data |
| `dependencies/route.ts` | `project-dependencies.service.ts` | GET/POST/PATCH | ✓ WIRED | create/list/end |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| GET fiscal-budget | `metrics.remaining_vnd` | `project_fiscal_budgets` + `budget_adjustments` SUM | Yes | ✓ FLOWING |
| GET benefits | `financial[].actual_vnd` | `financial_benefits` SQL NULL preserved | Yes | ✓ FLOWING |
| GET roi | `expected.status` | Aggregated budgets + benefits → pure fn | Yes | ✓ FLOWING |
| GET dependencies | `direction`, `peer_project_id` | `project_dependencies` bidirectional query | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 15 unit/integration suite | `npx vitest run` (16 files, fiscal/benefits/roi/dependencies) | 16 files, 111 tests passed | ✓ PASS |
| D-01 import guard | `fiscal-budget.service.unit.test.ts` | does not import budget.repo | ✓ PASS |
| ROI insufficient vs ok | `lib/fiscal/roi.unit.test.ts` | 10 tests pass | ✓ PASS |
| Budget metrics matrix | `lib/fiscal/budget-metrics.unit.test.ts` | over_budget/fully_used/insufficient | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this API phase.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| BUDG-01 | Record approved/actual VND by year/cost type | ✓ SATISFIED | fiscal-budget POST/PATCH + parsers |
| BUDG-02 | Computed remaining/utilization; over_budget/fully_used flags | ✓ SATISFIED | budget-metrics + GET overview |
| BUDG-03 | Append-only adjustments; approvals never overwritten | ✓ SATISFIED | budget_adjustments INSERT-only |
| BUDG-04 | Financial benefits; null actual ≠ 0 | ✓ SATISFIED | financial-benefits repo/service |
| BUDG-05 | Non-financial benefits group/measure/target | ✓ SATISFIED | nonfinancial-benefits repo/service |
| BUDG-06 | ROI percent only when complete; insufficient otherwise | ✓ SATISFIED | roi.ts + GET /roi (`{ status: 'insufficient' }` satisfies UI contract per D-14/ui_phase false) |
| DEP-01 | Create dependency with required fields and valid window | ✓ SATISFIED | POST dependencies + validation |
| DEP-02 | Reject self/duplicate/invalid dates | ✓ SATISFIED | service overlap/self-link checks |
| DEP-03 | Bidirectional list; PMs view; audit-logged | ✓ SATISFIED | list with direction; auditLog create/end |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None | — | No TBD/FIXME/stub patterns in phase artifacts |

### Human Verification Required

None. `workflow.ui_phase` is false (D-14); server tests are the gate. API `{ status: 'insufficient' }` on GET `/roi` satisfies the BUDG-06 “insufficient data” contract without a UI page.

### Gaps Summary

No gaps. All four ROADMAP success criteria are true in the codebase with passing targeted tests (111/111). Parallel fiscal surface (D-01) confirmed — v1 budget routes and `budget.repo.ts` remain separate.

---

_Verified: 2026-08-26T13:35:00Z_  
_Verifier: Claude (gsd-verifier)_
