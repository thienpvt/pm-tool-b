# Phase 15: Budget, Value, ROI & Dependencies - Research

**Researched:** 2026-08-26
**Domain:** Parallel fiscal budget ledger (VND integers, append-only adjustments), financial/non-financial benefits, honest computed ROI, and bidirectional cross-project dependencies — separate from v1 line-item budget
**Confidence:** HIGH

## Summary

Phase 15 adds a **parallel product surface** for spec fiscal budgeting, benefits, ROI, and cross-project dependencies. v1 `budget_items` / `budget_expenses` and `/api/projects/[id]/budget` remain unchanged — they use in-place `UPDATE` of `approved_amount`, physical `DELETE`, default `unit` `'USD'`, and `NUMERIC(15,2)` amounts [VERIFIED: lib/repositories/budget.repo.ts:48-48, 54-88]. Spec fiscal data lives in new tables (`project_fiscal_budgets`, `budget_adjustments`, `financial_benefits`, `nonfinancial_benefits`, `project_dependencies`) with new routes under `/fiscal-budget`, `/benefits`, `/roi`, `/dependencies` [D-13].

Remaining, utilization, over-budget, fully-used, and ROI percent are **pure computed values** returned by service/helpers — no stored status columns [D-03, D-08]. Approval changes are append-only adjustment rows; `approved_amount_vnd` is set once at create and never overwritten [D-04]. Dependencies soft-end via `effective_to` using the same active-window predicate as `project_pm_assignments` [VERIFIED: lib/repositories/pm-assignments.repo.ts:15-18] [D-09, D-11]. Auth follows established project gates: `assertProjectWriteAccess` on mutators, `assertProjectAccess` on reads, `withProjectAccess` route wrapper [VERIFIED: lib/services/access.ts:131-138, lib/http/with-project-access.ts:30-55]. Incremental `auditLog` on fiscal create, adjustment insert, benefit write, dependency create/end mirrors `pm-assignments.service.ts` [VERIFIED: lib/services/pm-assignments.service.ts:113-121, 163-171]. Schema DDL uses settings-flag idempotent migration in a new `lib/db-fiscal-budget.ts` invoked from `getDb()` **after** `migrateWeeklyReports` [VERIFIED: lib/db.ts:631-632, lib/db-weekly-reports.ts:94-149].

**No `project_dependencies` table exists today** — confirmed absent from `initPostgresSchema` / migrations in `lib/db.ts` and zero repo references outside `.planning/` planning docs.

**Primary recommendation:** Add `lib/db-fiscal-budget.ts` + repos/services for fiscal budget, benefits, ROI helpers, and dependencies; wire four new route groups with Zod + service validation for integer VND; export `computeFiscalBudgetStatus` and `listProjectDependencies` for Phase 16; gate with Vitest 4 unit + route tests (`workflow.ui_phase: false`).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Claude's Discretion

- Exact cost_type enum, benefit_type enum, dependency_type enum, and whether fiscal budget create sets approved once vs always-adjust — planner locks names. Prefer: first POST creates the unique (project, year, cost_type) row with initial approved; later approved changes are adjustments only. Actual spend PATCH is allowed (BUDG-01).

### Deferred Ideas (OUT OF SCOPE)

- Portfolio / PM dashboards consuming over-budget / open deps — Phase 16
- Document templates — Phase 17
- Full append-only audit coverage — Phase 18
- Migrating historical v1 budget_items into fiscal-year rows
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BUDG-01 | Record approved budget and actual spend by fiscal year and cost type in VND (non-negative integers) | `project_fiscal_budgets` DDL with BIGINT columns + unique `(project_id, fiscal_year, cost_type)` [D-02]; POST create + PATCH actual via `assertProjectWriteAccess` [D-05]; integer VND validators |
| BUDG-02 | Remaining and utilization computed; over budget when remaining < 0; fully used when remaining = 0 | Pure `computeFiscalBudgetMetrics` helper [D-03]; no stored flag columns; returned on GET fiscal-budget |
| BUDG-03 | Budget +/- as append-only adjustments; prior approvals never overwritten | `budget_adjustments` INSERT-only repo; repo must not UPDATE `approved_amount_vnd` after create [D-04]; v1 `updateBudgetItem` landmine avoided [VERIFIED: lib/repositories/budget.repo.ts:69-71] |
| BUDG-04 | Financial benefits by year/type; expected vs actual; null actual = no data | `financial_benefits.actual_vnd` nullable BIGINT [D-06]; service rejects coercing null to 0 |
| BUDG-05 | Non-financial benefits with group, measure, target | `nonfinancial_benefits` table [D-07]; text fields only |
| BUDG-06 | ROI computed percent only when complete; insufficient otherwise, never fake 0% | Pure `computeRoi` helpers [D-08]; unit tests for partial actuals → insufficient |
| DEP-01 | Create dependency between two projects with required fields and valid date window | `project_dependencies` DDL [D-09]; POST with write on `from_project_id` [D-10] |
| DEP-02 | Reject self-links, duplicate active relations, invalid date ranges | Service guards before INSERT; overlap query mirroring PM assignment window [D-10] |
| DEP-03 | Dependency on both projects with direction; PMs of both can view; audit-logged | List query `from OR to` + `direction` [D-11]; `assertProjectAccess` on both endpoints for read; `auditLog` create/end |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fiscal budget CRUD + adjustments | API / Backend (fiscal-budget service) | Database (`project_fiscal_budgets`, `budget_adjustments`) | Project-scoped writes via `assertProjectWriteAccess` [D-05] |
| Remaining / utilization / over-budget flags | API / Backend (pure compute helpers) | — | Computed at read time, never persisted [D-03] |
| Financial / non-financial benefits | API / Backend (benefits service) | Database (benefit tables) | Separate from v1 budget items [D-01] |
| ROI percent | API / Backend (pure `computeRoi` functions) | Database (read aggregates only) | Honest insufficient state [D-08]; no stored ROI column |
| Cross-project dependencies | API / Backend (dependencies service) | Database (`project_dependencies`) | Bidirectional list; soft-end not DELETE [D-09] |
| Authz | API / Backend (`assertProjectAccess`, `assertProjectWriteAccess`) | — | Same gates as budget-items and PM assignments [VERIFIED: lib/services/access.ts:79-138] |
| Audit trail | API / Backend (`auditLog`) | Database (`audit_logs`) | Incremental append-only INSERT [VERIFIED: lib/services/audit.service.ts:5-8] |
| Schema DDL | Database (migrate on boot) | — | Settings-flag after `migrateWeeklyReports` [VERIFIED: lib/db.ts:631-632] |
| Phase 16 dashboard inputs | API / Backend (exported helpers) | — | Export metrics/list helpers only [D-16] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | ^8.20.0 [VERIFIED: package.json:26] | PostgreSQL pool | Existing `getDb()` client |
| `zod` | ^4.4.3 [VERIFIED: package.json:35] | Route body/query validation | Matches existing API schema pattern |
| `vitest` | 4.1.10 [VERIFIED: package.json:49] | Service + route tests | Phase gate (D-14); TDD enabled |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `withProjectAccess` | — | Project route wrapper | All `/api/projects/[id]/*` routes [VERIFIED: lib/http/with-project-access.ts:30-55] |
| Existing `assertProjectWriteAccess` | — | PM/CPMO write gate | All mutators [VERIFIED: lib/services/access.ts:131-138] |
| Existing `auditLog` | — | Incremental mutation audit | Fiscal create, adjustment, benefit write, dep create/end |
| Existing error types | — | 400/403/404/409 | `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError` [VERIFIED: lib/services/errors.ts:11-44] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New fiscal tables | Extend `budget_items` | **Rejected** — in-place `approved_amount` UPDATE and physical DELETE [VERIFIED: lib/repositories/budget.repo.ts:54-88]; USD default [VERIFIED: lib/repositories/budget.repo.ts:48-48] |
| Stored over_budget / ROI columns | Computed helpers | **Rejected** — D-03/D-08 require computed-only; avoids stale flags |
| Physical DELETE dependencies | Soft-end `effective_to` | **Rejected** — D-09; mirrors PM assignments [VERIFIED: lib/repositories/pm-assignments.repo.ts:124-146] |
| Prisma migration | Settings-flag DDL helper | **Rejected** — project convention [D-12] |
| Reuse `/api/projects/[id]/budget` | New `/fiscal-budget` routes | **Rejected** — D-13; v1 overview stays [VERIFIED: app/api/projects/[id]/budget/route.ts:6-14] |

**Installation:** No new packages. Use existing dependencies only.

**Version verification:** All libraries already in `package.json`; no new installs.

## Package Legitimacy Audit

> Phase 15 installs **no new external packages**.

| Package | Registry | Verdict | Disposition |
|---------|----------|---------|-------------|
| — | — | — | N/A — no new installs |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart TD
  Client[Client / optional thin UI] -->|GET/POST/PATCH| FB[/api/projects/id/fiscal-budget]
  Client -->|GET/POST/PATCH| BN[/api/projects/id/benefits]
  Client -->|GET| ROI[/api/projects/id/roi]
  Client -->|GET/POST/PATCH| DEP[/api/projects/id/dependencies]

  FB --> WPA[withProjectAccess]
  BN --> WPA
  ROI --> WPA
  DEP --> WPA

  WPA --> SFB[fiscal-budget.service]
  WPA --> SBN[benefits.service]
  WPA --> SROI[roi.service / computeRoi]
  WPA --> SDEP[dependencies.service]

  SFB --> ARW[assertProjectWriteAccess on mutators]
  SFB --> ARA[assertProjectAccess on reads]
  SBN --> ARW
  SDEP --> ARW
  SDEP --> ARA

  SFB --> REPO_FB[fiscal-budget.repo]
  SFB --> COMP[computeFiscalBudgetMetrics pure fn]
  SBN --> REPO_BN[benefits.repo]
  SROI --> COMP
  SROI --> REPO_BN
  SROI --> REPO_FB
  SDEP --> REPO_DEP[project-dependencies.repo]

  REPO_FB --> DB[(project_fiscal_budgets + budget_adjustments)]
  REPO_BN --> DB2[(financial_benefits + nonfinancial_benefits)]
  REPO_DEP --> DB3[(project_dependencies)]

  SFB --> AUD[auditLog]
  SBN --> AUD
  SDEP --> AUD

  P16[Phase 16 dashboards] -.->|import helpers| COMP
  P16 -.->|import helpers| SDEP

  V1[/api/projects/id/budget v1] -.->|unchanged| V1DB[(budget_items + budget_expenses)]
```

### Recommended Project Structure

```
lib/
├── db-fiscal-budget.ts              # settings-flag DDL (D-12)
├── db-fiscal-budget.ddl.unit.test.ts
├── fiscal/
│   ├── vnd.ts                       # parseNonNegativeVnd, parseSignedVnd
│   ├── budget-metrics.ts            # computeFiscalBudgetMetrics (D-03)
│   └── roi.ts                       # computeExpectedRoi, computeActualRoi (D-08)
├── repositories/
│   ├── fiscal-budget.repo.ts
│   ├── benefits.repo.ts
│   └── project-dependencies.repo.ts
├── services/
│   ├── fiscal-budget.service.ts
│   ├── benefits.service.ts
│   └── project-dependencies.service.ts
app/api/projects/[id]/
├── fiscal-budget/
│   ├── route.ts
│   ├── schema.ts
│   ├── route.test.ts
│   └── [budgetId]/adjustments/route.ts
├── benefits/
│   ├── route.ts
│   ├── schema.ts
│   └── route.test.ts
├── roi/
│   ├── route.ts
│   └── route.test.ts
└── dependencies/
    ├── route.ts
    ├── schema.ts
    └── route.test.ts
```

### Pattern 1: Parallel surface (do not extend v1 budget)

**What:** New tables and routes; leave v1 `budget_items` / `/api/projects/[id]/budget` untouched.  
**When to use:** All Phase 15 fiscal/benefit/dependency data.  
**Landmine:** v1 repo overwrites approvals and deletes rows:

```typescript
// [VERIFIED: lib/repositories/budget.repo.ts:69-71]
`UPDATE budget_items SET type=?, group_name=?, name=?, planned_amount=?, approved_amount=?, actual_amount=?, unit=?, notes=?
 WHERE id=? AND project_id=? RETURNING *`,
```

Default unit on create is `'USD'` [VERIFIED: lib/repositories/budget.repo.ts:48-48]: `body.unit?.trim() || 'USD'`.

### Pattern 2: Settings-flag DDL after weekly migrate

**What:** Idempotent DDL via `settings` key flags — same as weekly reports.  
**When to use:** All new Phase 15 tables and indexes.  
**Example:**

```typescript
// Analog [VERIFIED: lib/db-weekly-reports.ts:94-118, 141-149]
export const FISCAL_BUDGET_DDL_FLAG = 'fiscal_budget_ddl_v1';
async function migrateFiscalBudgetDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, FISCAL_BUDGET_DDL_FLAG)) return;
  for (const sql of FISCAL_BUDGET_DDL) await pool.query(sql);
  await writeSettingsFlag(pool, FISCAL_BUDGET_DDL_FLAG);
}
// In getDb() after migrateWeeklyReports [VERIFIED: lib/db.ts:631-632]
```

Hermetic DDL assertions in `lib/db-fiscal-budget.ddl.unit.test.ts` mirror `lib/db-weekly-reports.ddl.unit.test.ts`.

### Pattern 3: Computed budget metrics (no stored flags)

**What:** Pure function aggregates approved baseline + adjustments − actual at read time.  
**When to use:** Every fiscal-budget GET and Phase 16 over-budget helper export.

```typescript
// D-03 — computed only, never persisted
type FiscalBudgetMetrics = {
  approved_net_vnd: number;
  actual_amount_vnd: number;
  remaining_vnd: number;
  utilization: number | null; // null when approved_net <= 0 → insufficient
  status: 'ok' | 'over_budget' | 'fully_used' | 'insufficient';
};

function computeFiscalBudgetMetrics(
  approvedBaseline: number,
  adjustmentSum: number,
  actual: number,
): FiscalBudgetMetrics {
  const approved_net_vnd = approvedBaseline + adjustmentSum;
  const remaining_vnd = approved_net_vnd - actual;
  if (approved_net_vnd <= 0) {
    return { approved_net_vnd, actual_amount_vnd: actual, remaining_vnd, utilization: null, status: 'insufficient' };
  }
  const utilization = actual / approved_net_vnd;
  let status: FiscalBudgetMetrics['status'] = 'ok';
  if (remaining_vnd < 0) status = 'over_budget';
  else if (remaining_vnd === 0) status = 'fully_used';
  return { approved_net_vnd, actual_amount_vnd: actual, remaining_vnd, utilization, status };
}
```

### Pattern 4: Honest ROI (never fake 0%)

**What:** Return `{ status: 'insufficient' }` when inputs incomplete; numeric percent only when formulas satisfied.  
**When to use:** `GET /roi` and any Phase 16 tile that shows ROI.

```typescript
// D-08
type RoiResult =
  | { status: 'insufficient' }
  | { status: 'ok'; percent: number };

function computeActualRoi(
  actualBenefits: Array<{ actual_vnd: number | null }>,
  sumActualBenefits: number,
  actualSpend: number,
): RoiResult {
  if (actualSpend <= 0) return { status: 'insufficient' };
  if (actualBenefits.some((b) => b.actual_vnd === null)) return { status: 'insufficient' };
  const percent = ((sumActualBenefits - actualSpend) / actualSpend) * 100;
  // Note: percent may legitimately be 0 when inputs are complete — distinct from insufficient
  return { status: 'ok', percent };
}
```

### Pattern 5: Dependency soft-end and active window

**What:** Reuse PM assignment window predicate for "active" dependency edges.  
**When to use:** Duplicate detection, list open deps, soft-end PATCH.

```typescript
// [VERIFIED: lib/repositories/pm-assignments.repo.ts:15-18]
const ACTIVE_WINDOW = `
  effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
`;
// End: UPDATE effective_to WHERE effective_to IS NULL — no DELETE [D-09]
// List: WHERE (from_project_id = ? OR to_project_id = ?) AND ${ACTIVE_WINDOW} for "open" filter
// direction: from_project_id = id ? 'outgoing' : 'incoming'
```

### Pattern 6: Integer VND validation (Zod + service)

**What:** Two-layer validation — Zod at route boundary, strict parse in service for BIGINT safety.  
**When to use:** All VND amount fields.

```typescript
// Route schema — reject floats via refine
const vndAmountSchema = z.union([z.string(), z.number()]).superRefine((val, ctx) => {
  const n = typeof val === 'string' ? Number(val.trim()) : val;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    ctx.addIssue({ code: 'custom', message: 'Must be a non-negative integer VND amount' });
  }
});

// Service helper — mirrors projects.service integer check [VERIFIED: lib/services/projects.service.ts:57-63]
function parseNonNegativeVnd(value: unknown, field: string): number {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new ValidationError(`${field} must be a non-negative integer VND amount`, field);
  }
  return n;
}

function parseSignedNonZeroVnd(value: unknown, field: string): number {
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) {
    throw new ValidationError(`${field} must be a non-zero integer VND amount`, field);
  }
  return n;
}
```

Store as PostgreSQL `BIGINT` (not `NUMERIC`) to match integer VND spec [D-02].

### Pattern 7: auditLog on governed mutations

**What:** Append-only audit rows with before/after JSON snapshots.  
**When to use:** Fiscal budget create, adjustment insert, benefit upsert, dependency create/end.

```typescript
// [VERIFIED: lib/services/pm-assignments.service.ts:113-121]
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'fiscal_budget', // or budget_adjustment, financial_benefit, project_dependency
  entity_id: String(created.id),
  action: 'create',
  before: null,
  after: auditSnapshot(created),
});
```

### Anti-Patterns to Avoid

- **Extending v1 `budget.repo.ts`:** Overwrites `approved_amount` in place and supports physical DELETE — spec violation for BUDG-03.
- **Storing `over_budget` / `roi_percent` columns:** D-03/D-08 require computed-only outputs.
- **Coercing null `actual_vnd` to 0:** BUDG-04/BUDG-06 explicit failure mode.
- **Returning ROI `0` when inputs missing:** Use `{ status: 'insufficient' }` even if math would yield 0 with partial data.
- **Physical DELETE on adjustments or dependencies:** Append-only / soft-end only.
- **Inventing CASL or re-gating ops/admin routes:** D-15.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Project write authorization | Custom role checks in routes | `assertProjectWriteAccess` + `withProjectAccess` | Established tenant + PM window gates [VERIFIED: lib/services/access.ts:131-138] |
| Audit persistence | Custom log table | `auditLog` → `audit_logs` | Append-only INSERT already wired [VERIFIED: lib/services/audit.service.ts:5-8] |
| Schema migrations | Prisma / one-off SQL scripts | Settings-flag DDL in `lib/db-fiscal-budget.ts` | Matches Phase 11–14 convention |
| Active window date logic | Ad-hoc date string compares | `ACTIVE_WINDOW` SQL fragment from PM assignments | Proven predicate [VERIFIED: lib/repositories/pm-assignments.repo.ts:15-18] |
| Float-safe VND parsing | `Number(x) \|\| 0` (v1 budget pattern) | `parseNonNegativeVnd` with `Number.isInteger` | v1 coerces invalid to 0 [VERIFIED: lib/repositories/budget.repo.ts:45-47] — spec rejects |
| ROI when data incomplete | Default percent = 0 | `{ status: 'insufficient' }` | BUDG-06 explicit requirement failure |

**Key insight:** v1 budget uses loose numeric coercion (`Number(body.planned_amount) || 0`) and USD defaults — the opposite of spec integer VND. Phase 15 validators must be strict, not copied from v1 repo.

## Common Pitfalls

### Pitfall 1: Folding fiscal rows into v1 `budget_items`

**What goes wrong:** Spec fiscal data shares table with line items; approvals get overwritten via `updateBudgetItem`.  
**Why it happens:** Existing `/budget` UI and repo look convenient.  
**How to avoid:** New tables + routes only [D-01, D-13]; negative test that fiscal service does not import `budget.repo.ts`.  
**Warning signs:** Any INSERT into `budget_items` from fiscal-budget service.

### Pitfall 2: Fake ROI 0%

**What goes wrong:** API returns `{ actual_roi_percent: 0 }` when `actual_vnd` is null on any benefit row.  
**Why it happens:** Default numeric initialization or `(a/b)*100` with missing operands treated as 0.  
**How to avoid:** Check completeness before division [D-08]; unit test partial actuals → insufficient.  
**Warning signs:** ROI endpoint returns a number when no financial benefit rows exist.

### Pitfall 3: Storing computed status columns

**What goes wrong:** `over_budget BOOLEAN` on `project_fiscal_budgets` drifts when adjustments added.  
**Why it happens:** Premature optimization for Phase 16 dashboards.  
**How to avoid:** Export `computeFiscalBudgetMetrics` for dashboards [D-16]; compute at query time.  
**Warning signs:** DDL includes `over_budget`, `fully_used`, or `roi_percent` columns.

### Pitfall 4: UPDATE on `budget_adjustments` or `approved_amount_vnd`

**What goes wrong:** Approval history lost; BUDG-03 violated.  
**Why it happens:** CRUD habit from v1 budget item updates.  
**How to avoid:** Repo exposes `insertBudgetAdjustment` only; no UPDATE method for adjustments; fiscal budget PATCH limited to `actual_amount_vnd` only [D-04].  
**Warning signs:** SQL `UPDATE budget_adjustments` or `UPDATE project_fiscal_budgets SET approved_amount_vnd`.

### Pitfall 5: Dependency duplicate active edges

**What goes wrong:** Two open edges with same from/to/type.  
**Why it happens:** Missing overlap query before INSERT.  
**How to avoid:** `hasActiveEquivalentDependency(from, to, type)` using `ACTIVE_WINDOW` + match on type [D-10]; optional partial unique index planner discretion.  
**Warning signs:** List returns duplicate outgoing edges of same type to same target.

### Pitfall 6: Cross-company dependency without auth check

**What goes wrong:** PM creates edge to foreign-company project they cannot see.  
**Why it happens:** Only checking write on `from` without validating `to` project tenancy.  
**How to avoid:** `assertProjectAccess(to, actor)` on create; CPMO company match for both projects [D-10].  
**Warning signs:** Create succeeds when `to` project belongs to another company and actor is PM-only.

### Pitfall 7: Viewer mutating via POST

**What goes wrong:** Viewer creates fiscal budget row.  
**Why it happens:** Route uses `withProjectAccess` but service skips write gate.  
**How to avoid:** Every mutator calls `assertProjectWriteAccess` first [D-05]; route test with viewer session → 403.  
**Warning signs:** Service calls only `assertProjectAccess` on POST.

## Code Examples

### Fiscal budget GET with computed metrics

```typescript
// Service read path — D-03
export async function getFiscalBudgetOverview(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const rows = await listFiscalBudgetsWithAdjustments(projectId);
  return rows.map((row) => ({
    ...row,
    metrics: computeFiscalBudgetMetrics(
      row.approved_amount_vnd,
      row.adjustment_sum_vnd,
      row.actual_amount_vnd,
    ),
  }));
}
```

### Append-only adjustment insert

```typescript
// D-04 — INSERT only; auditLog after
export async function addBudgetAdjustment(
  projectId: number | string,
  budgetId: number,
  actor: AccessActor,
  body: { amount_vnd: unknown; effective_date: string; reason: string },
) {
  await assertProjectWriteAccess(projectId, actor);
  const amount = parseSignedNonZeroVnd(body.amount_vnd, 'amount_vnd');
  if (!body.reason?.trim()) throw new ValidationError('reason is required', 'reason');
  const budget = await getFiscalBudgetInProject(projectId, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'fiscal_budget');
  const created = await insertBudgetAdjustment({ fiscal_budget_id: budgetId, amount_vnd: amount, ... });
  await auditLog({ entity_type: 'budget_adjustment', action: 'create', ... });
  return { ...created, metrics: computeFiscalBudgetMetrics(budget.approved_amount_vnd, await sumAdjustments(budgetId), budget.actual_amount_vnd) };
}
```

### Dependency list with direction

```typescript
// D-11
function mapDependencyRow(projectId: number, row: DependencyRow) {
  return {
    ...row,
    direction: row.from_project_id === Number(projectId) ? 'outgoing' as const : 'incoming' as const,
    peer_project_id: row.from_project_id === Number(projectId) ? row.to_project_id : row.from_project_id,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 line-item budget (USD NUMERIC, in-place UPDATE) | Parallel fiscal ledger (VND BIGINT, append-only adjustments) | Phase 15 (new) | v1 pages unchanged |
| No cross-project dependency model | `project_dependencies` with soft-end windows | Phase 15 (new) | Phase 16 can list open deps |
| ROI implicit / absent | Explicit insufficient vs computed percent | Phase 15 (new) | BUDG-06 honesty contract |

**Deprecated/outdated for this phase:**

- Extending `lib/repositories/budget.repo.ts` or `/api/projects/[id]/budget` for spec fiscal data — landmine per D-01/D-13.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `cost_type` / `benefit_type` / `dependency_type` enums locked by planner as text CHECK or service allowlist | Claude's Discretion | Invalid type values if allowlist too loose |
| A2 | ROI aggregates sum **all** fiscal cost types for `approved_net` and `actual spend` unless planner scopes to one cost_type | ROI Pattern | Wrong denominator if multi cost-type projects need per-type ROI |
| A3 | `GET /roi?fiscal_year=2026` query param shape — planner locks exact API | Routes | Minor route churn |
| A4 | Partial unique index on open dependency `(from, to, type) WHERE effective_to IS NULL` — planner discretion vs runtime overlap query only | Dependencies | Race duplicate without index |

## Open Questions (for planner)

1. **ROI aggregation scope** — sum approved/actual across all cost types for a fiscal year, or per cost_type ROI endpoint?
   - What we know: D-08 formulas reference `approved_net` and `actual spend` without specifying aggregation.
   - Recommendation: Default to **year-level aggregate across all cost types** for portfolio ROI; document in PLAN if per-type needed.

2. **Benefits route shape** — single `/benefits` with `kind=financial|nonfinancial` vs nested paths?
   - Recommendation: Single route with discriminated body (matches D-13 "financial + non-financial").

3. **Fiscal budget PATCH fields** — only `actual_amount_vnd` vs also allow metadata notes?
   - Recommendation: PATCH limited to `actual_amount_vnd` only; notes on adjustments/benefits separate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest, Next | ✓ | (runtime) | — |
| vitest | D-14 test gate | ✓ | 4.1.10 [VERIFIED: package.json:49] | — |
| PostgreSQL (`TEST_DATABASE_URL`) | Repo integration tests | optional | — | `describe.skipIf(!hasTestDb)` [ASSUMED: Phase 13–14 test harness pattern] |
| zod / pg | Validation + DB | ✓ | see package.json | — |

**Missing dependencies with no fallback:** none for unit-test gate.

**Missing dependencies with fallback:** Live Postgres optional for repo tests (skip pattern).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: package.json:49] |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run lib/fiscal/budget-metrics.unit.test.ts lib/fiscal/roi.unit.test.ts` |
| Full suite command | `npm test` |

Note: Vitest 4 ignores `-x`; do not put it in plan `<automated>` commands.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUDG-01 | POST fiscal budget with integer VND; reject float/negative | unit + route | `npx vitest run lib/services/fiscal-budget.service.unit.test.ts` | ❌ Wave 0 |
| BUDG-01 | PATCH actual_amount_vnd only; viewer 403 | route | `npx vitest run app/api/projects/[id]/fiscal-budget/route.test.ts` | ❌ Wave 0 |
| BUDG-02 | remaining/utilization/over_budget/fully_used computed | unit | `npx vitest run lib/fiscal/budget-metrics.unit.test.ts` | ❌ Wave 0 |
| BUDG-03 | Adjustments INSERT-only; approved_amount_vnd never UPDATEd | unit + repo | fiscal-budget.service + repo test | ❌ Wave 0 |
| BUDG-04 | null actual_vnd ≠ 0; expected required | unit | benefits.service.unit.test.ts | ❌ Wave 0 |
| BUDG-05 | nonfinancial text fields persist | unit | benefits.service.unit.test.ts | ❌ Wave 0 |
| BUDG-06 | incomplete inputs → insufficient; complete → percent (0 allowed) | unit | `npx vitest run lib/fiscal/roi.unit.test.ts` | ❌ Wave 0 |
| DEP-01 | Create dependency with required fields | unit + route | dependencies service + route test | ❌ Wave 0 |
| DEP-02 | Reject self-link, invalid dates, duplicate active | unit | dependencies.service.unit.test.ts | ❌ Wave 0 |
| DEP-03 | Both-end list with direction; auditLog create/end | unit | dependencies.service.unit.test.ts | ❌ Wave 0 |
| D-12 | DDL settings flag after migrateWeeklyReports | unit | `npx vitest run lib/db-fiscal-budget.ddl.unit.test.ts` | ❌ Wave 0 |
| D-01 | Fiscal service does not import v1 budget.repo | static | unit test import guard | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** focused vitest file from task verify block
- **Per wave merge:** `npx vitest run lib/fiscal lib/services/fiscal-budget.service.unit.test.ts lib/services/benefits.service.unit.test.ts lib/services/project-dependencies.service.unit.test.ts lib/db-fiscal-budget.ddl.unit.test.ts app/api/projects/[id]/fiscal-budget app/api/projects/[id]/benefits app/api/projects/[id]/roi app/api/projects/[id]/dependencies`
- **Phase gate:** `npm test` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `lib/db-fiscal-budget.ts` + `.ddl.unit.test.ts`
- [ ] `lib/fiscal/vnd.ts`, `budget-metrics.ts`, `roi.ts` + unit tests
- [ ] `lib/repositories/fiscal-budget.repo.ts`, `benefits.repo.ts`, `project-dependencies.repo.ts` + tests
- [ ] `lib/services/fiscal-budget.service.ts`, `benefits.service.ts`, `project-dependencies.service.ts` + unit tests
- [ ] `app/api/projects/[id]/fiscal-budget/` (+ adjustments) routes + schemas + route tests
- [ ] `app/api/projects/[id]/benefits/` routes + schema + route tests
- [ ] `app/api/projects/[id]/roi/route.test.ts`
- [ ] `app/api/projects/[id]/dependencies/` routes + schema + route tests
- [ ] Extend `lib/db.ts` `getDb()` to call `migrateFiscalBudget` after `migrateWeeklyReports`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Session via `withAuth` upstream |
| V3 Session Management | no | Out of phase scope |
| V4 Access Control | yes | `assertProjectWriteAccess` / `assertProjectAccess`; cross-project dep tenancy checks [D-10] |
| V5 Input Validation | yes | Zod schemas + integer VND service parsers; date window validation |
| V6 Cryptography | no | No secrets in this phase |

### Known Threat Patterns for stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Viewer mutating fiscal budget | Elevation of privilege | `assertProjectWriteAccess` on all POST/PATCH mutators [D-05] |
| PM creating dependency to foreign project | Elevation of privilege | `assertProjectAccess` on both `from` and `to` [D-10] |
| IDOR via fiscal budget id on wrong project | Information disclosure | Repo scopes `WHERE project_id = ?` on all reads/writes |
| Integer overflow / float amounts | Tampering | BIGINT + `Number.isInteger` reject non-integers |
| Audit trail bypass | Repudiation | `auditLog` on create/end mutations [D-11] |

## Sources

### Primary (HIGH confidence)

- Codebase via codegraph + Read: `lib/repositories/budget.repo.ts`, `lib/services/budget-items.service.ts`, `lib/services/budget.service.ts`, `app/api/projects/[id]/budget/route.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/services/pm-assignments.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/db-weekly-reports.ts`, `lib/db.ts`, `lib/http/with-project-access.ts`, `lib/services/projects.service.ts`, `lib/services/errors.ts`
- `.planning/phases/15-budget-value-roi-dependencies/15-CONTEXT.md` — D-01..D-16 locked

### Secondary (MEDIUM confidence)

- `.planning/phases/13-weekly-periods-pm-submit/13-RESEARCH.md` — parallel surface pattern
- `.planning/phases/14-cpmo-tracking-consolidated-export/14-RESEARCH.md` — DDL + validation doc shape
- `.planning/codebase/TESTING.md` — Vitest 4, TEST_DATABASE_URL `_test` suffix

### Tertiary (LOW confidence)

- Exact enum values for cost_type / benefit_type / dependency_type — planner discretion only

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; auth/audit/DDL patterns verified in source
- Architecture: HIGH — v1 landmine traced; no existing `project_dependencies`; compute formulas locked in CONTEXT
- Pitfalls: HIGH — ROI insufficiency and v1 overwrite/delete confirmed with line citations

**Research date:** 2026-08-26  
**Valid until:** 2026-09-26 (stable stack; enum names may be locked during planning)
