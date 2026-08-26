import { getDb } from '@/lib/db';

export type FinancialBenefitRow = {
  id: number;
  project_id: number;
  fiscal_year: number;
  benefit_type: string;
  expected_vnd: string | number;
  actual_vnd: string | number | null;
};

export type BenefitType = 'COST_SAVING' | 'REVENUE' | 'PRODUCTIVITY';

function normalizeRow(row: FinancialBenefitRow): FinancialBenefitRow {
  return {
    ...row,
    expected_vnd: Number(row.expected_vnd),
    actual_vnd: row.actual_vnd === null ? null : Number(row.actual_vnd),
  };
}

export async function listFinancialBenefits(projectId: number | string) {
  const db = await getDb();
  const rows = await db.all<FinancialBenefitRow>(
    `SELECT * FROM financial_benefits
     WHERE project_id = ?
     ORDER BY fiscal_year DESC, benefit_type`,
    Number(projectId),
  );
  return rows.map(normalizeRow);
}

export async function listFinancialBenefitsForYear(projectId: number | string, fiscalYear: number) {
  const db = await getDb();
  const rows = await db.all<FinancialBenefitRow>(
    `SELECT * FROM financial_benefits
     WHERE project_id = ? AND fiscal_year = ?
     ORDER BY benefit_type`,
    Number(projectId),
    fiscalYear,
  );
  return rows.map(normalizeRow);
}

export async function getFinancialBenefitInProject(projectId: number | string, id: number | string) {
  const db = await getDb();
  const row = await db.get<FinancialBenefitRow>(
    'SELECT * FROM financial_benefits WHERE id = ? AND project_id = ?',
    id,
    Number(projectId),
  );
  return row ? normalizeRow(row) : undefined;
}

export async function insertFinancialBenefit(
  projectId: number | string,
  body: {
    fiscal_year: number;
    benefit_type: string;
    expected_vnd: number;
    actual_vnd?: number | null;
  },
) {
  const db = await getDb();
  const hasActual = 'actual_vnd' in body;
  const actualParam = hasActual ? body.actual_vnd : null;
  const result = await db.run(
    `INSERT INTO financial_benefits
       (project_id, fiscal_year, benefit_type, expected_vnd, actual_vnd)
     VALUES (?, ?, ?, ?, ?)`,
    Number(projectId),
    body.fiscal_year,
    body.benefit_type,
    body.expected_vnd,
    actualParam,
  );
  const row = await db.get<FinancialBenefitRow>(
    'SELECT * FROM financial_benefits WHERE id = ?',
    result.lastInsertRowid,
  );
  return normalizeRow(row!);
}

export async function updateFinancialBenefit(
  projectId: number | string,
  id: number | string,
  patch: { expected_vnd?: number; actual_vnd?: number | null },
) {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.expected_vnd !== undefined) {
    sets.push('expected_vnd = ?');
    params.push(patch.expected_vnd);
  }
  if ('actual_vnd' in patch) {
    sets.push('actual_vnd = ?');
    params.push(patch.actual_vnd);
  }
  if (sets.length === 0) {
    return getFinancialBenefitInProject(projectId, id);
  }
  params.push(id, Number(projectId));
  const row = await db.get<FinancialBenefitRow>(
    `UPDATE financial_benefits SET ${sets.join(', ')}
     WHERE id = ? AND project_id = ?
     RETURNING *`,
    ...params,
  );
  return row ? normalizeRow(row) : undefined;
}
