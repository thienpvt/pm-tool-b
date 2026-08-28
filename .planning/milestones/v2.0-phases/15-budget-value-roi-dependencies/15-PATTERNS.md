# Phase 15: Budget, Value, ROI & Dependencies - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 28 new/modified files
**Analogs found:** 26 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/db-fiscal-budget.ts` | migration | batch | `lib/db-weekly-reports.ts` | exact |
| `lib/db-fiscal-budget.ddl.unit.test.ts` | test | transform | `lib/db-weekly-reports.ddl.unit.test.ts` | exact |
| `lib/db.ts` | config | batch | `lib/db.ts` (migrateWeeklyReports wire) | exact (extend) |
| `lib/repositories/fiscal-budget.repo.ts` | repository | CRUD (no approval overwrite) | `lib/repositories/budget.repo.ts` (`createBudgetItem`, `listBudgetItems`) | partial |
| `lib/repositories/budget-adjustments.repo.ts` | repository | append-only | `lib/repositories/weekly-reports.repo.ts` (`insertWeeklyReportVersion`) | exact |
| `lib/repositories/financial-benefits.repo.ts` | repository | CRUD | `lib/repositories/stakeholders.repo.ts` | role-match |
| `lib/repositories/nonfinancial-benefits.repo.ts` | repository | CRUD | `lib/repositories/stakeholders.repo.ts` | role-match |
| `lib/repositories/project-dependencies.repo.ts` | repository | CRUD + soft-end | `lib/repositories/pm-assignments.repo.ts` | exact |
| `lib/fiscal-budget/compute.ts` | utility | transform | `lib/services/weekly-reports.service.ts` (`isWeeklyReportOverdue`) | exact |
| `lib/services/fiscal-budget.service.ts` | service | request-response + transform | `lib/services/budget.service.ts` + `lib/services/stakeholders.service.ts` | role-match |
| `lib/services/benefits.service.ts` | service | request-response | `lib/services/stakeholders.service.ts` | exact |
| `lib/services/roi.service.ts` | service | transform | `lib/services/fiscal-budget.service.ts` (compose + pure compute) | role-match |
| `lib/services/project-dependencies.service.ts` | service | request-response + cross-project auth | `lib/services/stakeholders.service.ts` + `lib/services/pm-assignments.service.ts` | role-match |
| `app/api/projects/[id]/fiscal-budget/route.ts` | route | request-response | `app/api/projects/[id]/budget/route.ts` | role-match |
| `app/api/projects/[id]/fiscal-budget/adjustments/route.ts` | route | request-response | `app/api/projects/[id]/stakeholders/route.ts` (POST append) | role-match |
| `app/api/projects/[id]/benefits/route.ts` | route | request-response | `app/api/projects/[id]/stakeholders/route.ts` | exact |
| `app/api/projects/[id]/roi/route.ts` | route | request-response | `app/api/projects/[id]/budget/route.ts` (GET only) | role-match |
| `app/api/projects/[id]/dependencies/route.ts` | route | request-response | `app/api/projects/[id]/stakeholders/route.ts` (GET/POST/PATCH soft-end) | exact |
| `lib/fiscal-budget/compute.unit.test.ts` | test | transform | `lib/services/weekly-reports.service.unit.test.ts` (`isWeeklyReportOverdue` block) | exact |
| `lib/services/fiscal-budget.service.unit.test.ts` | test | — | `lib/services/stakeholders.service.unit.test.ts` | exact |
| `lib/services/benefits.service.unit.test.ts` | test | — | `lib/services/stakeholders.service.unit.test.ts` | exact |
| `lib/services/project-dependencies.service.unit.test.ts` | test | — | `lib/services/pm-assignments.service.unit.test.ts` | role-match |
| `lib/repositories/fiscal-budget.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | exact |
| `lib/repositories/budget-adjustments.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | exact |
| `lib/repositories/project-dependencies.repo.test.ts` | test | transform | `lib/repositories/weekly-periods.repo.test.ts` | exact |
| `app/api/projects/[id]/fiscal-budget/route.test.ts` | test | — | `app/api/projects/[id]/stakeholders/route.test.ts` | exact |
| `app/api/projects/[id]/benefits/route.test.ts` | test | — | `app/api/projects/[id]/stakeholders/route.test.ts` | exact |
| `app/api/projects/[id]/dependencies/route.test.ts` | test | — | `app/api/projects/[id]/stakeholders/route.test.ts` | exact |
| `test/repo-db.ts` | test harness | batch | `test/repo-db.ts` (extend DDL block) | exact (extend) |

## Pattern Assignments

### `lib/db-fiscal-budget.ts` (migration, batch)

**Analog:** `lib/db-weekly-reports.ts` (settings-flag DDL + index flags)

**Flag + DDL export** (db-weekly-reports.ts lines 1-4, 76-119):

```typescript
import type { Pool } from 'pg';

export const FISCAL_BUDGET_DDL_FLAG = 'fiscal_budget_ddl_v1';

export const FISCAL_BUDGET_DDL = [
  `
    CREATE TABLE IF NOT EXISTS project_fiscal_budgets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      fiscal_year INTEGER NOT NULL,
      cost_type TEXT NOT NULL,
      approved_amount_vnd BIGINT NOT NULL,
      actual_amount_vnd BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (project_id, fiscal_year, cost_type)
    )
  `,
  // budget_adjustments, financial_benefits, nonfinancial_benefits, project_dependencies
];
```

**Settings-flag idempotency** — copy `settingsFlagExists` / `writeSettingsFlag` / try-catch retry from `lib/db-weekly-reports.ts` lines 94-149:

```typescript
export async function migrateFiscalBudget(pool: Pool): Promise<void> {
  try {
    await migrateFiscalBudgetDdl(pool);
    await migrateFiscalBudgetIndexes(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
```

**Never:** physical DELETE helpers on fiscal/benefit/dependency/adjustment tables (D-12).

---

### `lib/db.ts` (config, batch)

**Analog:** `lib/db.ts` lines 631-632

```typescript
const { migrateWeeklyReports } = await import('./db-weekly-reports');
await migrateWeeklyReports(pool);
// Phase 15: parallel fiscal budget / benefits / dependencies tables
const { migrateFiscalBudget } = await import('./db-fiscal-budget');
await migrateFiscalBudget(pool);
await backfillWeightedCompletion(pool);
```

---

### `lib/repositories/fiscal-budget.repo.ts` (repository, CRUD without approval overwrite)

**Analog:** `lib/repositories/budget.repo.ts` `listBudgetItems` + `createBudgetItem` only (lines 19-52) — **NOT** `updateBudgetItem` / `deleteBudgetItem`

**List + scoped get**:

```typescript
export async function listFiscalBudgets(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM project_fiscal_budgets WHERE project_id = ? ORDER BY fiscal_year DESC, cost_type`,
    Number(projectId),
  );
}

export async function getFiscalBudgetInProject(
  projectId: number | string,
  budgetId: number | string,
) {
  const db = await getDb();
  return db.get(
    'SELECT * FROM project_fiscal_budgets WHERE id = ? AND project_id = ?',
    budgetId,
    Number(projectId),
  );
}
```

**Initial create (approved baseline set once)** — mirror `createBudgetItem` INSERT + RETURNING (budget.repo.ts lines 24-52) but BIGINT VND integers:

```typescript
export async function insertFiscalBudget(
  projectId: number | string,
  input: { fiscal_year: number; cost_type: string; approved_amount_vnd: number; actual_amount_vnd?: number },
) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO project_fiscal_budgets
       (project_id, fiscal_year, cost_type, approved_amount_vnd, actual_amount_vnd)
     VALUES (?, ?, ?, ?, ?)`,
    Number(projectId),
    input.fiscal_year,
    input.cost_type,
    input.approved_amount_vnd,
    input.actual_amount_vnd ?? 0,
  );
  return db.get('SELECT * FROM project_fiscal_budgets WHERE id = ?', r.lastInsertRowid);
}
```

**Actual spend PATCH only** — mirror `updateWeeklyReportDraft` allowlisted columns (weekly-reports.repo.ts lines 199-233), **never** touch `approved_amount_vnd`:

```typescript
export async function updateFiscalBudgetActual(
  projectId: number,
  budgetId: number,
  actualAmountVnd: number,
) {
  const db = await getDb();
  return db.get(
    `UPDATE project_fiscal_budgets SET actual_amount_vnd = ?
     WHERE id = ? AND project_id = ?
     RETURNING *`,
    actualAmountVnd,
    budgetId,
    projectId,
  );
}
```

**Sum adjustments for compute** — aggregate query alongside list:

```typescript
export async function sumAdjustmentsVnd(fiscalBudgetId: number): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ total: string }>(
    'SELECT COALESCE(SUM(amount_vnd), 0) AS total FROM budget_adjustments WHERE fiscal_budget_id = ?',
    fiscalBudgetId,
  );
  return Number(row?.total ?? 0);
}
```

---

### `lib/repositories/budget-adjustments.repo.ts` (repository, append-only)

**Analog:** `lib/repositories/weekly-reports.repo.ts` `insertWeeklyReportVersion` (lines 236-261)

**INSERT only — no UPDATE/DELETE**:

```typescript
export async function insertBudgetAdjustment(input: {
  fiscalBudgetId: number;
  amountVnd: number;
  effectiveDate: string;
  reason: string;
  createdBy: number;
}) {
  const db = await getDb();
  const row = await db.get(
    `INSERT INTO budget_adjustments
       (fiscal_budget_id, amount_vnd, effective_date, reason, created_by)
     VALUES (?, ?, ?, ?, ?)
     RETURNING *`,
    input.fiscalBudgetId,
    input.amountVnd,
    input.effectiveDate,
    input.reason,
    input.createdBy,
  );
  if (!row) throw new Error('insertBudgetAdjustment failed');
  return row;
}

export async function listBudgetAdjustments(fiscalBudgetId: number) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM budget_adjustments WHERE fiscal_budget_id = ? ORDER BY effective_date, id`,
    fiscalBudgetId,
  );
}
```

---

### `lib/repositories/financial-benefits.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/stakeholders.repo.ts` (list + insert + scoped get, lines 10-67)

**Nullable `actual_vnd` means no data** — use SQL `NULL`, never coerce to 0 on read:

```typescript
export async function upsertFinancialBenefit(
  projectId: number,
  input: { fiscal_year: number; benefit_type: string; expected_vnd: number; actual_vnd?: number | null },
) {
  const db = await getDb();
  // INSERT ... ON CONFLICT (project_id, fiscal_year, benefit_type) DO UPDATE
  // only actual_vnd when explicitly provided; expected_vnd required on create
}
```

Unique `(project_id, fiscal_year, benefit_type)` per D-06.

---

### `lib/repositories/nonfinancial-benefits.repo.ts` (repository, CRUD)

**Analog:** `lib/repositories/stakeholders.repo.ts` `insertStakeholder` (lines 51-67)

Text fields only — no numeric coercion of `actual_text` to 0.

---

### `lib/repositories/project-dependencies.repo.ts` (repository, soft-end + overlap)

**Analog:** `lib/repositories/pm-assignments.repo.ts` (ACTIVE_WINDOW, insert, softEnd — lines 15-147)

**Active window predicate** (adapt for dependencies):

```typescript
const ACTIVE_DEP = `
  effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
`;
```

**Bidirectional list** (D-11):

```typescript
export async function listProjectDependencies(projectId: number) {
  const db = await getDb();
  return db.all(
    `SELECT *, CASE WHEN from_project_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM project_dependencies
     WHERE from_project_id = ? OR to_project_id = ?
     ORDER BY need_by, id`,
    projectId,
    projectId,
    projectId,
  );
}
```

**Soft-end** — copy `softEndPmAssignment` shape (pm-assignments.repo.ts lines 124-147):

```typescript
export async function softEndDependency(
  dependencyId: number,
  effectiveTo?: string,
) {
  const db = await getDb();
  if (effectiveTo === undefined) {
    return db.get(
      `UPDATE project_dependencies SET effective_to = CURRENT_DATE
       WHERE id = ? AND effective_to IS NULL
       RETURNING *`,
      dependencyId,
    );
  }
  return db.get(
    `UPDATE project_dependencies SET effective_to = ?
     WHERE id = ? AND effective_to IS NULL
     RETURNING *`,
    effectiveTo,
    dependencyId,
  );
}
```

**Overlap duplicate check** — mirror `hasOverlappingPmAssignment` (lines 69-85) with from/to/type/window overlap.

---

### `lib/fiscal-budget/compute.ts` (utility, transform — pure functions)

**Analog:** `lib/services/weekly-reports.service.ts` `isWeeklyReportOverdue` (lines 242-250)

**Remaining + utilization + status flags** (D-03 — computed, never stored):

```typescript
export type BudgetComputeInput = {
  approvedAmountVnd: number;
  adjustmentSumVnd: number;
  actualAmountVnd: number;
};

export type BudgetComputeResult =
  | { status: 'insufficient' }
  | {
      status: 'ok';
      approvedNetVnd: number;
      remainingVnd: number;
      utilizationPct: number | null;
      overBudget: boolean;
      fullyUsed: boolean;
    };

export function computeFiscalBudgetMetrics(input: BudgetComputeInput): BudgetComputeResult {
  const approvedNet = input.approvedAmountVnd + input.adjustmentSumVnd;
  if (approvedNet <= 0) return { status: 'insufficient' };
  const remaining = approvedNet - input.actualAmountVnd;
  const utilizationPct = (input.actualAmountVnd / approvedNet) * 100;
  return {
    status: 'ok',
    approvedNetVnd: approvedNet,
    remainingVnd: remaining,
    utilizationPct,
    overBudget: remaining < 0,
    fullyUsed: remaining === 0,
  };
}
```

**ROI helpers** (D-08 — never fake 0%):

```typescript
export type RoiResult =
  | { status: 'insufficient' }
  | { status: 'ok'; roiPct: number };

export function computeExpectedRoi(
  sumExpectedBenefitsVnd: number,
  approvedNetVnd: number,
  hasExpectedRow: boolean,
): RoiResult {
  if (!hasExpectedRow || approvedNetVnd <= 0) return { status: 'insufficient' };
  return {
    status: 'ok',
    roiPct: ((sumExpectedBenefitsVnd - approvedNetVnd) / approvedNetVnd) * 100,
  };
}

export function computeActualRoi(
  sumActualBenefitsVnd: number,
  actualSpendVnd: number,
  allActualsPresent: boolean,
): RoiResult {
  if (!allActualsPresent || actualSpendVnd <= 0) return { status: 'insufficient' };
  return {
    status: 'ok',
    roiPct: ((sumActualBenefitsVnd - actualSpendVnd) / actualSpendVnd) * 100,
  };
}
```

Export helpers for Phase 16 (`remaining`, `over_budget`, open deps list).

---

### `lib/services/fiscal-budget.service.ts` (service, request-response + transform)

**Analog:** `lib/services/budget.service.ts` (lines 14-69) for auth + validation; **NOT** `budget-items.service.ts` `updateBudgetItem`

**GET with computed fields**:

```typescript
export async function getFiscalBudgetOverview(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const rows = await listFiscalBudgets(projectId);
  const enriched = await Promise.all(
    rows.map(async (row) => {
      const adjSum = await sumAdjustmentsVnd(row.id);
      const metrics = computeFiscalBudgetMetrics({
        approvedAmountVnd: Number(row.approved_amount_vnd),
        adjustmentSumVnd: adjSum,
        actualAmountVnd: Number(row.actual_amount_vnd),
      });
      const adjustments = await listBudgetAdjustments(row.id);
      return { ...row, adjustments, metrics };
    }),
  );
  return enriched;
}
```

**Create baseline** — mirror `createBudgetItem` (budget.service.ts lines 40-69):

```typescript
export async function createFiscalBudget(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const fiscalYear = parseFiscalYear(body.fiscal_year);
  const costType = parseCostType(body.cost_type);
  const approved = parseNonNegativeIntVnd(body.approved_amount_vnd, 'approved_amount_vnd');
  // ConflictError on unique (project, year, cost_type) violation
  const created = await insertFiscalBudget(projectId, { fiscal_year: fiscalYear, cost_type: costType, approved_amount_vnd: approved });
  await auditLog({ entity_type: 'fiscal_budget', action: 'create', ... });
  return created;
}
```

**Patch actual spend only** — `assertProjectWriteAccess` + `updateFiscalBudgetActual`; never mutate `approved_amount_vnd` (D-04).

**Add adjustment** — separate service fn calling `insertBudgetAdjustment` only; `amount_vnd !== 0`, signed integer, required reason.

---

### `lib/services/benefits.service.ts` (service, request-response)

**Analog:** `lib/services/stakeholders.service.ts` (lines 69-184)

**Read**:

```typescript
export async function listProjectBenefits(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const [financial, nonfinancial] = await Promise.all([
    listFinancialBenefits(projectId),
    listNonfinancialBenefits(projectId),
  ]);
  return { financial, nonfinancial };
}
```

**Write** — `assertProjectWriteAccess`; `ValidationError` for missing required fields; `auditLog` on create/update with `auditSnapshot` helper (stakeholders.service.ts lines 25-37).

**Financial actual** — distinguish omitted vs explicit `null` vs `0` in PATCH body parsing.

---

### `lib/services/roi.service.ts` (service, transform)

**Analog:** compose repos + `lib/fiscal-budget/compute.ts` pure functions

```typescript
export async function getProjectRoi(
  projectId: number | string,
  actor: AccessActor,
  fiscalYear: number,
) {
  await assertProjectAccess(projectId, actor);
  const benefits = await listFinancialBenefitsForYear(projectId, fiscalYear);
  const approvedNet = await sumApprovedNetForYear(projectId, fiscalYear);
  const actualSpend = await sumActualSpendForYear(projectId, fiscalYear);
  const expected = computeExpectedRoi(
    sumExpected(benefits),
    approvedNet,
    benefits.some((b) => b.expected_vnd != null),
  );
  const actual = computeActualRoi(
    sumActual(benefits),
    actualSpend,
    benefits.length > 0 && benefits.every((b) => b.actual_vnd !== null),
  );
  return { fiscal_year: fiscalYear, expected, actual };
}
```

Never return `0` when inputs incomplete (BUDG-06).

---

### `lib/services/project-dependencies.service.ts` (service, cross-project auth)

**Analog:** `lib/services/stakeholders.service.ts` `endProjectStakeholder` (lines 151-184) + `pm-assignments.service.ts` validation

**Create** (D-10):

```typescript
export async function createProjectDependency(
  fromProjectId: number,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(fromProjectId, actor);
  const toProjectId = parseProjectId(body.to_project_id);
  if (fromProjectId === toProjectId) throw new ValidationError('Cannot link project to itself', 'to_project_id');
  await assertProjectAccess(toProjectId, actor); // PM on either side may view; create needs write on from
  // reject overlapping duplicate active (from, to, type)
  const created = await insertDependency({ ... });
  await auditLog({ entity_type: 'project_dependency', action: 'create', ... });
  return created;
}
```

**List** — `assertProjectAccess(projectId)`; PM on either endpoint can GET (D-10).

**End** — PATCH `effective_to`; `auditLog` action `'end'` with before/after snapshots.

---

### `app/api/projects/[id]/fiscal-budget/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/budget/route.ts` (lines 1-14) + stakeholders PATCH for nested actuals if split

```typescript
import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createFiscalBudget, getFiscalBudgetOverview, patchFiscalBudgetActual } from '@/lib/services/fiscal-budget.service';
import { fiscalBudgetCreateSchema, fiscalBudgetActualSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getFiscalBudgetOverview(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createFiscalBudget(params.id, actor, body as Record<string, unknown>), { status: 201 }),
  { schema: fiscalBudgetCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await patchFiscalBudgetActual(params.id, actor, body as Record<string, unknown>)),
  { schema: fiscalBudgetActualSchema },
);
```

**Do not** mount under `/api/projects/[id]/budget` (D-13).

---

### `app/api/projects/[id]/fiscal-budget/adjustments/route.ts` (route, append-only POST)

**Analog:** stakeholders POST (append history row) — `app/api/projects/[id]/stakeholders/route.ts` lines 14-21

POST only (no PATCH/DELETE on adjustment rows). Zod: signed non-zero `amount_vnd`, `effective_date`, required `reason`, `fiscal_budget_id`.

---

### `app/api/projects/[id]/benefits/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/stakeholders/route.ts` (lines 1-35)

GET list; POST create financial or non-financial (discriminated schema or separate endpoints per planner); PATCH for updates/end where applicable. Viewer 403 on mutators via service `assertProjectWriteAccess`.

---

### `app/api/projects/[id]/roi/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/budget/route.ts` GET only

```typescript
export const GET = withProjectAccess(async (req, { params, actor }) => {
  const fiscalYear = Number(new URL(req.url).searchParams.get('fiscal_year'));
  return NextResponse.json(await getProjectRoi(params.id, actor, fiscalYear));
});
```

---

### `app/api/projects/[id]/dependencies/route.ts` (route, request-response)

**Analog:** `app/api/projects/[id]/stakeholders/route.ts` (GET/POST/PATCH soft-end, lines 1-35)

```typescript
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectDependencies(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createProjectDependency(Number(params.id), actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: dependencyCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const payload = body as Record<string, unknown>;
    const dependencyId = payload.id;
    if (dependencyId === undefined || dependencyId === null || dependencyId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await endProjectDependency(params.id, actor, dependencyId, payload),
    );
  },
  { schema: dependencyEndSchema },
);
```

Assert route module does not export DELETE (D-09).

---

### Test files

#### `lib/fiscal-budget/compute.unit.test.ts`

**Analog:** `lib/services/weekly-reports.service.unit.test.ts` `isWeeklyReportOverdue` tests

Pure — no mocks. Cases:
- remaining < 0 → `overBudget: true`
- remaining === 0 → `fullyUsed: true`
- denominator 0 → `{ status: 'insufficient' }`
- ROI incomplete actuals → `{ status: 'insufficient' }`, never `{ roiPct: 0 }` as missing-data stand-in
- explicit actual 0 with complete inputs → valid ROI

#### `lib/services/fiscal-budget.service.unit.test.ts`

**Analog:** `lib/services/stakeholders.service.unit.test.ts` lines 1-80

```typescript
vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: vi.fn() }));
vi.mock('@/lib/repositories/fiscal-budget.repo', () => ({ ... }));
vi.mock('@/lib/repositories/budget-adjustments.repo', () => ({ ... }));
vi.mock('@/lib/fiscal-budget/compute', () => ({ computeFiscalBudgetMetrics: vi.fn() }));
```

Tests: viewer blocked on create; adjustment never updates approved baseline; auditLog on create/adjustment/actual patch.

#### `lib/services/benefits.service.unit.test.ts`

**Analog:** stakeholders.service.unit.test.ts — null vs 0 for `actual_vnd`.

#### `lib/services/project-dependencies.service.unit.test.ts`

**Analog:** pm-assignments.service.unit.test.ts — self-link ValidationError; duplicate ConflictError; end sets `effective_to`.

#### `lib/repositories/*.repo.test.ts`

**Analog:** `lib/repositories/weekly-periods.repo.test.ts` lines 1-28

```typescript
import { hasTestDb, testPool } from '@/test/db';
import { seedProject, setupRepoTables, testDb } from '@/test/repo-db';
import { migrateFiscalBudget } from '@/lib/db-fiscal-budget';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

describe.skipIf(!hasTestDb)('fiscal-budget.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    await migrateFiscalBudget(testPool());
  });
});
```

Extend `test/repo-db.ts` DDL with Phase 15 tables OR call `migrateFiscalBudget` in `beforeAll` (prefer migrate for FK parity).

#### `app/api/projects/[id]/*/route.test.ts`

**Analog:** `app/api/projects/[id]/stakeholders/route.test.ts` lines 1-50

```typescript
vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));

// 401 no session; 403 viewer on POST/PATCH; 200/201 pm/cpmo on GET/POST
// assert DELETE undefined on dependencies route
```

Reuse `ownerSession`, `viewerSession` fixtures from stakeholders route.test.ts.

#### `lib/db-fiscal-budget.ddl.unit.test.ts`

**Analog:** `lib/db-weekly-reports.ddl.unit.test.ts` lines 12-43

Assert CREATE TABLE for all five tables, UNIQUE constraints, FK to `projects`, BIGINT VND columns, no DELETE helpers exported.

---

## Shared Patterns

### assertProjectAccess / assertProjectWriteAccess

**Source:** `lib/services/access.ts` lines 79-138
**Apply to:** all Phase 15 services — reads vs mutators (D-05)

```typescript
export async function assertProjectWriteAccess(projectId, actor) {
  await assertProjectAccess(projectId, actor);
  assertCanMutate(actor);
  await assertPmWriteAccess(projectId, actor);
}
```

Viewer-only → 403 on POST/PATCH. PM write requires active assignment window.

---

### withProjectAccess routes

**Source:** `lib/http/with-project-access.ts` lines 30-56
**Apply to:** all `/api/projects/[id]/fiscal-budget`, `/benefits`, `/roi`, `/dependencies`

```typescript
export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listFn(params.id, actor)),
);
```

ForbiddenError/NotFoundError map via `withAuth` catch → `serviceErrorResponse`.

---

### serviceErrorResponse (HTTP mapping)

**Source:** `lib/api-errors.ts` lines 42-62
**Apply to:** all routes

```typescript
if (e instanceof ValidationError) {
  return NextResponse.json({ error: e.message, field: e.field }, { status: 400 });
}
if (e instanceof ConflictError) {
  return NextResponse.json({ error: e.message }, { status: 409 });
}
```

Use `ConflictError` for duplicate fiscal budget row or duplicate active dependency.

---

### auditLog on mutations

**Source:** `lib/services/stakeholders.service.ts` lines 138-146, 173-181
**Apply to:** fiscal budget create, adjustment insert, dependency create/end

```typescript
await auditLog({
  actor_id: actor.user_id,
  company_id: actor.company_id,
  entity_type: 'fiscal_budget',
  entity_id: String(created.id),
  action: 'create',
  before: null,
  after: auditSnapshot(created),
});
```

---

### Soft-end via effective_to (no physical DELETE)

**Source:** `lib/repositories/pm-assignments.repo.ts` `softEndPmAssignment` (lines 124-147)
**Apply to:** `project_dependencies` end; **never** on fiscal rows (D-09, D-12)

---

### describe.skipIf(!hasTestDb) repo integration

**Source:** `test/db.ts` line 6; `lib/repositories/weekly-periods.repo.test.ts` line 20
**Apply to:** all `lib/repositories/*fiscal*.test.ts`, `budget-adjustments.repo.test.ts`, `project-dependencies.repo.test.ts`

```typescript
export const hasTestDb = Boolean(TEST_DATABASE_URL);
describe.skipIf(!hasTestDb)('fiscal-budget.repo', () => { ... });
```

`TEST_DATABASE_URL` must end in `_test` per TESTING.md.

---

## Anti-Patterns / Landmines (do NOT analogize)

| Surface | Why forbidden | Verified location |
|---------|---------------|-------------------|
| `budget.repo.ts` `updateBudgetItem` | Overwrites `approved_amount` in place — violates append-only approvals (D-04) | `lib/repositories/budget.repo.ts` lines 54-83 |
| `budget.repo.ts` `deleteBudgetItem` / `deleteExpense` | Physical DELETE; spec forbids fiscal row DELETE | lines 85-167 |
| `budget-items.service.ts` `updateBudgetItem` | Service wraps forbidden overwrite pattern | lines 32-44 |
| `/api/projects/[id]/budget` routes | v1 line-item store; Phase 15 is parallel surface (D-01, D-13) | `app/api/projects/[id]/budget/route.ts` |
| Default USD unit on v1 items | Spec is integer VND only | `budget.repo.ts` line 48 |
| Fake ROI 0% for missing data | Explicit BUDG-06 failure | — |
| Storing `over_budget` / utilization status columns | Must be computed (D-03) | — |
| CASL / new auth framework | D-15 | — |

Phase 15 must **not** import v1 budget overwrite/delete paths for spec fiscal data.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/fiscal-budget/compute.ts` (ROI insufficient-data contract) | utility | transform | No existing ROI/benefit compute — borrow pure-function shape from `isWeeklyReportOverdue` only; business rules are new (D-08) |
| Cross-project dependency create auth (write on from + access on to) | service | request-response | No existing cross-project edge with dual-project assert — compose from `assertProjectWriteAccess` + `assertProjectAccess` |

---

## Metadata

**Analog search scope:** `lib/db-weekly-reports.ts`, `lib/db.ts`, `lib/repositories/budget.repo.ts`, `lib/repositories/weekly-reports.repo.ts`, `lib/repositories/pm-assignments.repo.ts`, `lib/repositories/stakeholders.repo.ts`, `lib/repositories/audit.repo.ts`, `lib/services/budget.service.ts`, `lib/services/stakeholders.service.ts`, `lib/services/pm-assignments.service.ts`, `lib/services/weekly-reports.service.ts`, `lib/services/access.ts`, `lib/services/audit.service.ts`, `lib/services/errors.ts`, `lib/fiscal-budget/compute.ts`, `lib/http/with-project-access.ts`, `lib/api-errors.ts`, `app/api/projects/[id]/budget/route.ts`, `app/api/projects/[id]/stakeholders/route.ts`, `app/api/projects/[id]/pm-assignments/route.ts`, `app/api/projects/[id]/stakeholders/route.test.ts`, `app/api/projects/[id]/pm-assignments/route.test.ts`, `lib/services/stakeholders.service.unit.test.ts`, `lib/repositories/weekly-periods.repo.test.ts`, `lib/db-weekly-reports.ddl.unit.test.ts`, `test/repo-db.ts`, `test/db.ts`
**Files scanned:** 32
**Pattern extraction date:** 2026-08-26

## PATTERNS COMPLETE
