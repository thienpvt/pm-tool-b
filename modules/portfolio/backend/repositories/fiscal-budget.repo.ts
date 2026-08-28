import { getDb } from '@/lib/db';

export type FiscalBudgetRow = {
  id: number;
  project_id: number;
  fiscal_year: number;
  cost_type: string;
  approved_amount_vnd: string | number;
  actual_amount_vnd: string | number;
  created_at: string;
};

export async function listFiscalBudgets(projectId: number | string) {
  const db = await getDb();
  return db.all<FiscalBudgetRow>(
    `SELECT * FROM project_fiscal_budgets
     WHERE project_id = ?
     ORDER BY fiscal_year DESC, cost_type`,
    projectId,
  );
}

export async function getFiscalBudgetInProject(projectId: number | string, budgetId: number | string) {
  const db = await getDb();
  return db.get<FiscalBudgetRow>(
    'SELECT * FROM project_fiscal_budgets WHERE id = ? AND project_id = ?',
    budgetId,
    projectId,
  );
}

export async function findFiscalBudgetByKey(
  projectId: number | string,
  fiscalYear: number,
  costType: string,
) {
  const db = await getDb();
  return db.get<FiscalBudgetRow>(
    `SELECT * FROM project_fiscal_budgets
     WHERE project_id = ? AND fiscal_year = ? AND cost_type = ?`,
    projectId,
    fiscalYear,
    costType,
  );
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
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO project_fiscal_budgets
       (project_id, fiscal_year, cost_type, approved_amount_vnd, actual_amount_vnd)
     VALUES (?, ?, ?, ?, ?)`,
    projectId,
    body.fiscal_year,
    body.cost_type,
    body.approved_amount_vnd,
    body.actual_amount_vnd ?? 0,
  );
  return db.get<FiscalBudgetRow>('SELECT * FROM project_fiscal_budgets WHERE id = ?', result.lastInsertRowid);
}

/** Spend reporting only — approved baseline is never updated here (D-04). */
export async function updateFiscalBudgetActual(
  projectId: number | string,
  budgetId: number | string,
  actualAmountVnd: number,
) {
  const db = await getDb();
  return db.get<FiscalBudgetRow>(
    `UPDATE project_fiscal_budgets SET actual_amount_vnd = ?
     WHERE id = ? AND project_id = ?
     RETURNING *`,
    actualAmountVnd,
    budgetId,
    projectId,
  );
}
