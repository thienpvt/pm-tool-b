import { getKysely } from '@/lib/db/kysely';
import { coerceVndSafe } from '@/lib/fiscal/vnd';

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
    expected_vnd: coerceVndSafe(row.expected_vnd, 'expected_vnd'),
    actual_vnd: row.actual_vnd === null ? null : coerceVndSafe(row.actual_vnd, 'actual_vnd'),
  };
}

export async function listFinancialBenefits(projectId: number | string) {
  const db = await getKysely();
  const rows = await db
    .selectFrom('financial_benefits')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('fiscal_year', 'desc')
    .orderBy('benefit_type')
    .execute();
  return rows.map(normalizeRow);
}

export async function listFinancialBenefitsForYear(projectId: number | string, fiscalYear: number) {
  const db = await getKysely();
  const rows = await db
    .selectFrom('financial_benefits')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('fiscal_year', '=', fiscalYear)
    .orderBy('benefit_type')
    .execute();
  return rows.map(normalizeRow);
}

export async function getFinancialBenefitInProject(projectId: number | string, id: number | string) {
  const db = await getKysely();
  const row = await db
    .selectFrom('financial_benefits')
    .selectAll()
    .where('id', '=', Number(id))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
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
  const db = await getKysely();
  const hasActual = 'actual_vnd' in body;
  const actualParam = hasActual ? body.actual_vnd : null;
  const row = await db
    .insertInto('financial_benefits')
    .values({
      project_id: Number(projectId),
      fiscal_year: body.fiscal_year,
      benefit_type: body.benefit_type,
      expected_vnd: body.expected_vnd,
      actual_vnd: actualParam,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return normalizeRow(row);
}

export async function updateFinancialBenefit(
  projectId: number | string,
  id: number | string,
  patch: { expected_vnd?: number; actual_vnd?: number | null },
) {
  const db = await getKysely();
  const set: { expected_vnd?: number; actual_vnd?: number | null } = {};
  if (patch.expected_vnd !== undefined) {
    set.expected_vnd = patch.expected_vnd;
  }
  if ('actual_vnd' in patch) {
    set.actual_vnd = patch.actual_vnd;
  }
  if (Object.keys(set).length === 0) {
    return getFinancialBenefitInProject(projectId, id);
  }
  const row = await db
    .updateTable('financial_benefits')
    .set(set)
    .where('id', '=', Number(id))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
  return row ? normalizeRow(row) : undefined;
}
