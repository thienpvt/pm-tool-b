import {
  findFiscalBudgetByKey,
  getFiscalBudgetInProject,
  insertFiscalBudget,
  listFiscalBudgets,
  updateFiscalBudgetActual,
} from '@/lib/repositories/fiscal-budget.repo';
import {
  insertBudgetAdjustment,
  listBudgetAdjustments,
  sumAdjustmentsVnd,
} from '@/lib/repositories/budget-adjustments.repo';
import { computeFiscalBudgetMetrics } from '@/lib/fiscal/budget-metrics';
import {
  parseCostType,
  parseFiscalYear,
  parseNonNegativeVnd,
  parseSignedNonZeroVnd,
} from '@/lib/fiscal/vnd';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { ConflictError, NotFoundError, ValidationError } from './errors';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: string }).code === '23505'
  );
}

function coerceVnd(value: string | number): number {
  return Number(value);
}

function fiscalBudgetSnapshot(row: {
  id: number;
  fiscal_year: number;
  cost_type: string;
  approved_amount_vnd: string | number;
  actual_amount_vnd: string | number;
} | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    fiscal_year: row.fiscal_year,
    cost_type: row.cost_type,
    approved_amount_vnd: coerceVnd(row.approved_amount_vnd),
    actual_amount_vnd: coerceVnd(row.actual_amount_vnd),
  };
}

export async function createFiscalBudget(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const fiscalYear = parseFiscalYear(body.fiscal_year);
  const costType = parseCostType(body.cost_type);
  const approvedAmountVnd = parseNonNegativeVnd(body.approved_amount_vnd, 'approved_amount_vnd');
  const actualAmountVnd =
    body.actual_amount_vnd === undefined
      ? 0
      : parseNonNegativeVnd(body.actual_amount_vnd, 'actual_amount_vnd');

  const existing = await findFiscalBudgetByKey(projectId, fiscalYear, costType);
  if (existing) throw new ConflictError('Fiscal budget already exists for this year and cost type');

  try {
    const row = await insertFiscalBudget(projectId, {
      fiscal_year: fiscalYear,
      cost_type: costType,
      approved_amount_vnd: approvedAmountVnd,
      actual_amount_vnd: actualAmountVnd,
    });
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'fiscal_budget',
      entity_id: String(row!.id),
      action: 'create',
      before: null,
      after: fiscalBudgetSnapshot(row),
    });
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Fiscal budget already exists for this year and cost type');
    }
    throw err;
  }
}

export async function getFiscalBudgetOverview(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const rows = await listFiscalBudgets(projectId);
  return Promise.all(
    rows.map(async (row) => {
      const adjustments = await listBudgetAdjustments(row.id);
      const adjustmentSum = await sumAdjustmentsVnd(row.id);
      const approvedBaseline = coerceVnd(row.approved_amount_vnd);
      const actual = coerceVnd(row.actual_amount_vnd);
      const metrics = computeFiscalBudgetMetrics(approvedBaseline, adjustmentSum, actual);
      return { ...row, adjustments, metrics };
    }),
  );
}

export async function patchFiscalBudgetActual(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const budgetId = body.id;
  if (budgetId === undefined || budgetId === null || budgetId === '') {
    throw new ValidationError('id is required', 'id');
  }
  const actualAmountVnd = parseNonNegativeVnd(body.actual_amount_vnd, 'actual_amount_vnd');
  const prior = await getFiscalBudgetInProject(projectId, budgetId);
  if (!prior) throw new NotFoundError('Not found', 'fiscal_budget');
  const updated = await updateFiscalBudgetActual(projectId, budgetId, actualAmountVnd);
  if (!updated) throw new NotFoundError('Not found', 'fiscal_budget');
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'fiscal_budget',
    entity_id: String(budgetId),
    action: 'update',
    before: { actual_amount_vnd: coerceVnd(prior.actual_amount_vnd) },
    after: { actual_amount_vnd: coerceVnd(updated.actual_amount_vnd) },
  });
  return updated;
}

function adjustmentSnapshot(row: {
  id: number;
  fiscal_budget_id: number;
  amount_vnd: string | number;
  effective_date: string;
  reason: string;
} | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    fiscal_budget_id: row.fiscal_budget_id,
    amount_vnd: coerceVnd(row.amount_vnd),
    effective_date: row.effective_date,
    reason: row.reason,
  };
}

export async function addBudgetAdjustment(
  projectId: number | string,
  budgetId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const budget = await getFiscalBudgetInProject(projectId, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'fiscal_budget');

  const amountVnd = parseSignedNonZeroVnd(body.amount_vnd, 'amount_vnd');
  const effectiveDate = typeof body.effective_date === 'string' ? body.effective_date.trim() : '';
  if (!effectiveDate) {
    throw new ValidationError('effective_date is required', 'effective_date');
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    throw new ValidationError('reason is required', 'reason');
  }

  const row = await insertBudgetAdjustment(budgetId, {
    amount_vnd: amountVnd,
    effective_date: effectiveDate,
    reason,
    created_by: actor.user_id,
  });
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'budget_adjustment',
    entity_id: String(row!.id),
    action: 'create',
    before: null,
    after: adjustmentSnapshot(row),
  });
  return row;
}
