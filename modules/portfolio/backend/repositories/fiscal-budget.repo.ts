import { getKysely } from '@/lib/db/kysely';

export type FiscalBudgetRow = {
  id: number;
  project_id: number;
  fiscal_year: number;
  cost_type: string;
  approved_amount_vnd: string | number;
  actual_amount_vnd: string | number;
  created_at: string;
};

type FiscalBudgetDbRow = {
  id: number;
  project_id: number;
  fiscal_year: number;
  cost_type: string;
  approved_amount_vnd: number;
  actual_amount_vnd: number;
  created_at: Date | string;
};

function mapFiscalBudgetRow(row: FiscalBudgetDbRow): FiscalBudgetRow {
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function listFiscalBudgets(projectId: number | string) {
  const db = await getKysely();
  const rows = await db
    .selectFrom('project_fiscal_budgets')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('fiscal_year', 'desc')
    .orderBy('cost_type')
    .execute();
  return rows.map(mapFiscalBudgetRow);
}

export async function getFiscalBudgetInProject(projectId: number | string, budgetId: number | string) {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_fiscal_budgets')
    .selectAll()
    .where('id', '=', Number(budgetId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
  return row ? mapFiscalBudgetRow(row) : undefined;
}

export async function findFiscalBudgetByKey(
  projectId: number | string,
  fiscalYear: number,
  costType: string,
) {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_fiscal_budgets')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('fiscal_year', '=', fiscalYear)
    .where('cost_type', '=', costType)
    .executeTakeFirst();
  return row ? mapFiscalBudgetRow(row) : undefined;
}

export async function insertFiscalBudget(
  projectId: number | string,
  body: {
    fiscal_year: number;
    cost_type: string;
    approved_amount_vnd: number;
    actual_amount_vnd?: number;
  },
) {
  const db = await getKysely();
  const row = await db
    .insertInto('project_fiscal_budgets')
    .values({
      project_id: Number(projectId),
      fiscal_year: body.fiscal_year,
      cost_type: body.cost_type,
      approved_amount_vnd: body.approved_amount_vnd,
      actual_amount_vnd: body.actual_amount_vnd ?? 0,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return mapFiscalBudgetRow(row);
}

/** Spend reporting only — approved baseline is never updated here (D-04). */
export async function updateFiscalBudgetActual(
  projectId: number | string,
  budgetId: number | string,
  actualAmountVnd: number,
) {
  const db = await getKysely();
  const row = await db
    .updateTable('project_fiscal_budgets')
    .set({ actual_amount_vnd: actualAmountVnd })
    .where('id', '=', Number(budgetId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
  return row ? mapFiscalBudgetRow(row) : undefined;
}
