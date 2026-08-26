# Phase 15: Budget, Value, ROI & Dependencies - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all grey areas accepted at the recommended answer

<domain>
## Phase Boundary

Deliver spec fiscal budget (VND, fiscal year, cost type), append-only adjustments, financial/non-financial benefits, honest ROI, and bidirectional cross-project dependencies. This is a **parallel product surface** — do not overwrite v1 `budget_items` / `budget_expenses` / portfolio budget pages as the spec store.

**Requirements:** BUDG-01, BUDG-02, BUDG-03, BUDG-04, BUDG-05, BUDG-06, DEP-01, DEP-02, DEP-03

**In:** write-access users record approved budget and actual spend by fiscal year and cost type in VND (non-negative integers); remaining and utilization computed; remaining < 0 over-budget, remaining = 0 fully used; budget +/− as append-only adjustment rows (amount, effective date, reason) that never overwrite prior approvals; financial benefits by year and type (expected vs actual; actual blank = no data, distinct from 0); non-financial benefits with group, measure, target; expected/actual ROI as a computed percent only when inputs are complete — otherwise insufficient-data, never fake 0%; create a dependency between two different projects with required fields and a valid need-by / effective window; reject self-links, duplicate equivalent active relations, invalid date ranges; saved dependency appears on both projects with correct direction; PMs of both projects can view; audit-logged.

**Out:** Dashboard tiles (Phase 16); document templates (Phase 17); full audit coverage (Phase 18 — incremental `auditLog` on budget/dep mutations is OK); redesign of v1 project budget items/expenses or `/portfolio/budget`; physical DELETE of fiscal rows.

</domain>

<decisions>
## Implementation Decisions

Decision IDs D-01..D-16.

### Parallel surface (not v1 line-item budget)

- **D-01:** New tables and routes. Do **not** store Phase 15 fiscal rows in `budget_items` / `budget_expenses` and do **not** overwrite `approved_amount` in place on those items. Keep v1 CAPEX/OPEX expense pages working. — **Reversibility:** costly — mixing stores would force a later data split (same pattern as Phase 13 D-01).

### Fiscal budget (BUDG-01, BUDG-02, BUDG-03)

- **D-02:** Table `project_fiscal_budgets`: `project_id`, `fiscal_year` (integer, e.g. 2026), `cost_type` (text, e.g. CAPEX/OPEX or spec cost types), `approved_amount_vnd` (BIGINT, non-negative), `actual_amount_vnd` (BIGINT, non-negative), unique `(project_id, fiscal_year, cost_type)`. Amounts are **integer VND**; reject negatives and non-integers. Currency is always VND — no unit column on this table.
- **D-03:** Remaining = `approved + sum(adjustments signed) - actual`. Utilization = actual / (approved + net adjustments) when denominator > 0, else insufficient. `remaining < 0` → `over_budget`; `remaining === 0` and denominator > 0 → `fully_used`. These flags are **computed**, never stored status columns.
- **D-04:** Table `budget_adjustments`: `fiscal_budget_id`, `amount_vnd` (signed integer, ≠ 0), `effective_date` (date), `reason` (required text), `created_by`, `created_at`. INSERT only. Never UPDATE/DELETE adjustment rows or overwrite `project_fiscal_budgets.approved_amount_vnd` after create. Changing the approved baseline is a new adjustment. Actual spend is updated via PATCH of `actual_amount_vnd` (or a dedicated actuals write) — that is spend reporting, not an approval overwrite (BUDG-03 applies to **approvals**).
- **D-05:** Writes: `assertProjectWriteAccess`. Reads: `assertProjectAccess`. Viewer 403 on mutators.

### Benefits & ROI (BUDG-04, BUDG-05, BUDG-06)

- **D-06:** Table `financial_benefits`: `project_id`, `fiscal_year`, `benefit_type` (text), `expected_vnd` (BIGINT, non-negative, required), `actual_vnd` (BIGINT nullable — **null means no data**, distinct from 0). Unique `(project_id, fiscal_year, benefit_type)` or allow multiple types per year without uniqueness if planner prefers; recommended unique pair.
- **D-07:** Table `nonfinancial_benefits`: `project_id`, `group_name`, `measure`, `target` (text), optional `actual_text`. No numeric coercion to 0.
- **D-08:** ROI helpers (pure functions, tested):
  - Expected ROI% = `(sum expected financial benefits − approved_net) / approved_net * 100` when `approved_net > 0` AND at least one expected benefit exists.
  - Actual ROI% = `(sum actual financial benefits − actual spend) / actual spend * 100` when actual spend > 0 AND **every** financial-benefit row for the project/year has non-null `actual_vnd` (complete). If any `actual_vnd` is null, return `{ status: 'insufficient' }`, never `0`.
  - Never return `0` as a stand-in for missing data.

### Dependencies (DEP-01, DEP-02, DEP-03)

- **D-09:** Table `project_dependencies`: `from_project_id`, `to_project_id`, `dependency_type` (required text), `need_by` (date, required), `effective_from` (date, required), `effective_to` (date nullable), `notes`, `created_by`, `created_at`. No physical DELETE — end by setting `effective_to` (same pattern as PM assignments).
- **D-10:** Reject: `from_project_id === to_project_id`; `effective_to < effective_from` when `effective_to` set; `need_by` empty; duplicate **equivalent active** relation (same from/to/type overlapping open window). Cross-company: both projects must be in the actor's company (CPMO) or the actor must have write on **from** and at least access on **to** (PM). PMs of **either** project may GET the edge. Creating requires write on `from_project_id` (`assertProjectWriteAccess`).
- **D-11:** List for a project returns edges where `from_project_id = id OR to_project_id = id`, each with `direction: 'outgoing' | 'incoming'`. `auditLog` on create and on end (`effective_to` set).

### Schema, authz, UI, testing

- **D-12:** Schema helper `lib/db-fiscal-budget.ts` (or `lib/db-budget-value.ts`) invoked from `getDb()` **after** `migrateWeeklyReports`. Settings-flag DDL. No Prisma. Never physical DELETE fiscal/benefit/dependency/adjustment rows.
- **D-13:** Routes: `/api/projects/[id]/fiscal-budget` (+ adjustments), `/api/projects/[id]/benefits` (financial + non-financial), `/api/projects/[id]/roi`, `/api/projects/[id]/dependencies`. Do not reuse `/api/projects/[id]/budget` item/expense routes.
- **D-14:** `workflow.ui_phase` is false. Server tests are the gate. Thin pages optional.
- **D-15:** Do not invent CASL. Do not re-gate D-23 leftover ops/admin routes.
- **D-16:** Phase 16 dashboards may read remaining/over_budget and open dependencies via exported list helpers. Do not build dashboard tiles here.

### the agent's Discretion

- Exact cost_type enum, benefit_type enum, dependency_type enum, and whether fiscal budget create sets approved once vs always-adjust — planner locks names. Prefer: first POST creates the unique (project, year, cost_type) row with initial approved; later approved changes are adjustments only. Actual spend PATCH is allowed (BUDG-01).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria 1–4, UI hint yes (ignored: `workflow.ui_phase` false)
- `.planning/REQUIREMENTS.md` — BUDG-01..06, DEP-01..03
- `.planning/PROJECT.md` — PR-06, PR-08
- `.planning/STATE.md` — current position Phase 15

### Locked prior decisions
- `.planning/phases/10-users-roles-server-authorization/10-CONTEXT.md` — `assertProjectWriteAccess`, D-23 leftover carve-out
- `.planning/phases/11-project-master-pm-assignment-stakeholders/11-CONTEXT.md` — assignment windows; company-scoped projects
- `.planning/phases/13-weekly-periods-pm-submit/13-CONTEXT.md` — parallel-surface pattern; never physical DELETE; incremental auditLog

### Code maps
- `.planning/codebase/ARCHITECTURE.md` — route → service → repo
- `.planning/codebase/CONVENTIONS.md` — Vitest 4, settings-flag DDL
- `.planning/codebase/TESTING.md` — `TEST_DATABASE_URL` must end in `_test`

### Landmines
- `lib/repositories/budget.repo.ts` `updateBudgetItem` overwrites `approved_amount`; `deleteBudgetItem` / `deleteExpense` exist — do not fold spec fiscal data into those tables
- Default unit on v1 items is USD — spec is VND integers
- Fake ROI 0% is an explicit requirement failure (BUDG-06)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assertProjectWriteAccess` / `assertProjectAccess`
- `auditLog`
- `lib/db-weekly-reports.ts` settings-flag DDL analog
- `project_pm_assignments` window pattern for ending dependencies
- v1 `budget.repo.ts` stays untouched as a landmine

### Established Patterns
- Tenant then role. Viewer 403 on mutators.
- Append-only history rather than UPDATE of approvals.
- Vitest 4 TDD; do not put `-x` in automated commands.
- Do not invent CASL.

### Integration Points
- New `/api/projects/[id]/fiscal-budget`, `/benefits`, `/roi`, `/dependencies`
- Leave `/api/projects/[id]/budget` and `/api/portfolio/budget*` unchanged
- Phase 16 may call remaining/over_budget helpers

</code_context>

<specifics>
## Specific Ideas

- [auto] Surface — Q: "Extend v1 budget_items?" → Selected: "Parallel fiscal tables/routes; leave v1 line items unchanged"
- [auto] Approvals — Q: "How do amounts change?" → Selected: "Append-only adjustments; never overwrite approved_amount_vnd after create"
- [auto] Actual blank — Q: "0 vs missing?" → Selected: "NULL actual_vnd means no data; 0 is a recorded zero"
- [auto] ROI — Q: "Incomplete inputs?" → Selected: "`insufficient`, never fake 0%"
- [auto] Dependencies — Q: "Delete?" → Selected: "Soft-end via effective_to; appear on both ends with direction"
- `workflow.ui_phase=false`

</specifics>

<deferred>
## Deferred Ideas

- Portfolio / PM dashboards consuming over-budget / open deps — Phase 16
- Document templates — Phase 17
- Full append-only audit coverage — Phase 18
- Migrating historical v1 budget_items into fiscal-year rows

</deferred>

---

*Phase: 15-Budget, Value, ROI & Dependencies*
*Context gathered: 2026-08-26*
