import { getDb } from '@/lib/db';

export type NonfinancialBenefitRow = {
  id: number;
  project_id: number;
  group_name: string;
  measure: string;
  target: string;
  actual_text: string | null;
  created_at: string;
};

export async function listNonfinancialBenefits(projectId: number | string) {
  const db = await getDb();
  return db.all<NonfinancialBenefitRow>(
    `SELECT * FROM nonfinancial_benefits
     WHERE project_id = ?
     ORDER BY created_at DESC, id DESC`,
    Number(projectId),
  );
}

export async function getNonfinancialBenefitInProject(projectId: number | string, id: number | string) {
  const db = await getDb();
  return db.get<NonfinancialBenefitRow>(
    'SELECT * FROM nonfinancial_benefits WHERE id = ? AND project_id = ?',
    id,
    Number(projectId),
  );
}

export async function insertNonfinancialBenefit(
  projectId: number | string,
  body: {
    group_name: string;
    measure: string;
    target: string;
    actual_text?: string | null;
  },
) {
  const db = await getDb();
  const hasActualText = 'actual_text' in body;
  const actualText = hasActualText ? body.actual_text : null;
  const result = await db.run(
    `INSERT INTO nonfinancial_benefits
       (project_id, group_name, measure, target, actual_text)
     VALUES (?, ?, ?, ?, ?)`,
    Number(projectId),
    body.group_name,
    body.measure,
    body.target,
    actualText,
  );
  return db.get<NonfinancialBenefitRow>(
    'SELECT * FROM nonfinancial_benefits WHERE id = ?',
    result.lastInsertRowid,
  );
}

export async function updateNonfinancialBenefit(
  projectId: number | string,
  id: number | string,
  patch: { actual_text?: string | null },
) {
  const db = await getDb();
  if (!('actual_text' in patch)) {
    return getNonfinancialBenefitInProject(projectId, id);
  }
  return db.get<NonfinancialBenefitRow>(
    `UPDATE nonfinancial_benefits SET actual_text = ?
     WHERE id = ? AND project_id = ?
     RETURNING *`,
    patch.actual_text,
    id,
    Number(projectId),
  );
}
