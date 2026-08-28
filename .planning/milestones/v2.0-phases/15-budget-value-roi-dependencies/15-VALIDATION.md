---
phase: 15
slug: budget-value-roi-dependencies
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-26
---

# Phase 15 — Validation Strategy

> Nyquist-style must-haves mapped to BUDG-01..06 and DEP-01..03. Server tests are the phase gate (`workflow.ui_phase: false`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run lib/fiscal/budget-metrics.unit.test.ts lib/fiscal/roi.unit.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~90 seconds |

Do not use `-x` in automated plan commands (Vitest 4 ignores it).

---

## Requirement Must-Haves (BUDG-01..06, DEP-01..03)

| Req | Must-have behavior | Automated proof | Min test type |
|-----|-------------------|-----------------|---------------|
| **BUDG-01** | Write user can POST fiscal budget row: `fiscal_year`, `cost_type`, `approved_amount_vnd`, `actual_amount_vnd` as non-negative integers | Service unit: valid create; repo mock insert with BIGINT fields | unit |
| **BUDG-01** | Reject negative, float, and non-numeric VND amounts | Service unit: `parseNonNegativeVnd` throws `ValidationError` for `1.5`, `-1`, `''` | unit |
| **BUDG-01** | Unique `(project_id, fiscal_year, cost_type)` — duplicate POST → 409 | Service/repo unit: second create ConflictError | unit |
| **BUDG-01** | PATCH updates `actual_amount_vnd` only (spend reporting) | Service unit: PATCH body with actual; repo UPDATE limited column | unit |
| **BUDG-01** | Viewer receives 403 on fiscal-budget mutators | Route test with viewer session | route |
| **BUDG-02** | `remaining_vnd = approved_net - actual` where `approved_net = approved + sum(adjustments)` | `lib/fiscal/budget-metrics.unit.test.ts` fixture matrix | unit |
| **BUDG-02** | `utilization = actual / approved_net` when `approved_net > 0`; else insufficient | Same unit test file | unit |
| **BUDG-02** | `remaining < 0` → status `over_budget` (computed, not stored) | Unit: negative remaining; assert no UPDATE to DB status column | unit |
| **BUDG-02** | `remaining === 0` and `approved_net > 0` → status `fully_used` | Unit: exact zero remaining case | unit |
| **BUDG-03** | Adjustment INSERT only: `amount_vnd` signed non-zero, `effective_date`, `reason` | Service unit: insert path; repo has no UPDATE/DELETE for adjustments | unit/repo |
| **BUDG-03** | `approved_amount_vnd` never UPDATEd after initial create | Repo test: no SQL `UPDATE project_fiscal_budgets SET approved_amount_vnd`; baseline change = new adjustment | unit/repo |
| **BUDG-03** | `auditLog` on fiscal create and adjustment insert | Service unit: `auditLog` mock called with entity_type + action | unit |
| **BUDG-04** | Financial benefit: `expected_vnd` required non-negative integer | Service unit + route schema | unit |
| **BUDG-04** | `actual_vnd` nullable — null means no data; stored 0 is distinct from null | Service unit: null preserved; 0 accepted as recorded zero | unit |
| **BUDG-04** | Unique `(project_id, fiscal_year, benefit_type)` when planner adopts recommendation | Repo/service conflict test | unit |
| **BUDG-05** | Non-financial benefit: `group_name`, `measure`, `target` text; optional `actual_text` | Service unit: create + list shape | unit |
| **BUDG-05** | No numeric coercion of text fields to 0 | Unit: empty optional fields stay null/empty string | unit |
| **BUDG-06** | Expected ROI returns percent only when `approved_net > 0` AND ≥1 expected benefit | `lib/fiscal/roi.unit.test.ts` | unit |
| **BUDG-06** | Actual ROI returns percent only when `actual spend > 0` AND every benefit row has non-null `actual_vnd` | Same ROI unit tests | unit |
| **BUDG-06** | Any missing input → `{ status: 'insufficient' }`, never numeric 0 as placeholder | Unit: partial actuals, zero spend, no benefits → all insufficient | unit |
| **BUDG-06** | Legitimate 0% when inputs complete is allowed (distinct from insufficient) | Unit: benefits equal spend → `{ status: 'ok', percent: 0 }` | unit |
| **DEP-01** | POST dependency: `from_project_id`, `to_project_id`, `dependency_type`, `need_by`, `effective_from`, optional `effective_to`, `notes` | Service + route test with valid body | unit + route |
| **DEP-01** | Create requires `assertProjectWriteAccess` on `from_project_id` | Route test: PM without write on from → 403 | route |
| **DEP-02** | Reject `from_project_id === to_project_id` | Service unit: ValidationError | unit |
| **DEP-02** | Reject `effective_to < effective_from` when `effective_to` set | Service unit | unit |
| **DEP-02** | Reject empty `need_by` | Service unit + schema | unit |
| **DEP-02** | Reject duplicate equivalent active relation (same from/to/type, open window) | Service unit: overlap query returns existing → ConflictError | unit |
| **DEP-03** | List returns edges where project is `from` OR `to` with `direction: outgoing \| incoming` | Service unit: both directions mapped | unit |
| **DEP-03** | PM with access on either project can GET list | Route test: PM assigned to peer project reads edge | route |
| **DEP-03** | Soft-end sets `effective_to`; no physical DELETE | Repo test: UPDATE only; no DELETE SQL | unit/repo |
| **DEP-03** | `auditLog` on dependency create and end | Service unit: mock called on create + end | unit |

### Cross-cutting (locked D-01..D-16)

| Must-have | Automated proof |
|-----------|-----------------|
| Parallel surface — no import of v1 `budget.repo.ts` from fiscal services | Static unit: fiscal-budget.service does not import `@/lib/repositories/budget.repo` |
| New routes only — `/fiscal-budget`, `/benefits`, `/roi`, `/dependencies` | Route tests exist; v1 `/budget` tests unchanged |
| `assertProjectWriteAccess` on all mutators; `assertProjectAccess` on reads | Route tests: viewer 403 on POST/PATCH |
| DDL via settings flag after `migrateWeeklyReports` in `getDb()` | `lib/db-fiscal-budget.ddl.unit.test.ts` |
| No physical DELETE on fiscal/benefit/adjustment/dependency rows | Repo tests assert INSERT/UPDATE only |
| Cross-company dependency blocked for PM without access on both projects | Service unit with mismatched `company_id` |
| Phase 16 helpers exported (`computeFiscalBudgetMetrics`, list open deps) | Unit export smoke or service named export test |

---

## Sampling Rate

- **After every task commit:** run task `<verify><automated>` file(s)
- **After every plan wave:** `npx vitest run lib/fiscal lib/services/fiscal-budget.service.unit.test.ts lib/services/benefits.service.unit.test.ts lib/services/project-dependencies.service.unit.test.ts lib/db-fiscal-budget.ddl.unit.test.ts app/api/projects/[id]/fiscal-budget app/api/projects/[id]/benefits app/api/projects/[id]/roi app/api/projects/[id]/dependencies`
- **Before `$gsd-verify-work`:** full `npm test` green
- **Max feedback latency:** 90 seconds

---

## Wave 0 Files (all ❌ until created)

- [ ] `lib/db-fiscal-budget.ts` + `.ddl.unit.test.ts`
- [ ] `lib/fiscal/vnd.ts`, `budget-metrics.ts`, `roi.ts` + unit tests
- [ ] `lib/repositories/fiscal-budget.repo.ts` + `.repo.test.ts`
- [ ] `lib/repositories/benefits.repo.ts` + `.repo.test.ts`
- [ ] `lib/repositories/project-dependencies.repo.ts` + `.repo.test.ts`
- [ ] `lib/services/fiscal-budget.service.ts` + `.unit.test.ts`
- [ ] `lib/services/benefits.service.ts` + `.unit.test.ts`
- [ ] `lib/services/project-dependencies.service.ts` + `.unit.test.ts`
- [ ] `app/api/projects/[id]/fiscal-budget/route.ts` + `schema.ts` + `route.test.ts`
- [ ] `app/api/projects/[id]/fiscal-budget/[budgetId]/adjustments/route.ts` + tests
- [ ] `app/api/projects/[id]/benefits/route.ts` + `schema.ts` + `route.test.ts`
- [ ] `app/api/projects/[id]/roi/route.ts` + `route.test.ts`
- [ ] `app/api/projects/[id]/dependencies/route.ts` + `schema.ts` + `route.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why manual | Instructions |
|----------|-------------|------------|--------------|
| Thin fiscal/benefits/dependencies UI (if added) | D-14 | `ui_phase: false` | Optional smoke: write user opens project fiscal tab, records budget + benefit. Server tests remain gate. |

All BUDG-01..06 and DEP-01..03 behaviors above have intended automated coverage.

---

## Validation Sign-Off

- [ ] Every BUDG-01..06 and DEP-01..03 must-have row has a Wave 0 test target
- [ ] No three consecutive tasks without `<automated>` verify
- [ ] v1 `budget.repo.ts` landmine covered by negative import test
- [ ] ROI insufficient-vs-zero distinction covered in `lib/fiscal/roi.unit.test.ts`
- [ ] `nyquist_compliant: true` when Wave 0 complete

**Approval:** pending
