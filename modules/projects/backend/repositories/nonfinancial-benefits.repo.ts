import { getKysely } from '@/lib/db/kysely';

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
  const db = await getKysely();
  return db
    .selectFrom('nonfinancial_benefits')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .execute();
}

export async function getNonfinancialBenefitInProject(projectId: number | string, id: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('nonfinancial_benefits')
    .selectAll()
    .where('id', '=', Number(id))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
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
  const db = await getKysely();
  const hasActualText = 'actual_text' in body;
  const actualText = hasActualText ? body.actual_text : null;
  return db
    .insertInto('nonfinancial_benefits')
    .values({
      project_id: Number(projectId),
      group_name: body.group_name,
      measure: body.measure,
      target: body.target,
      actual_text: actualText,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateNonfinancialBenefit(
  projectId: number | string,
  id: number | string,
  patch: { actual_text?: string | null },
) {
  const db = await getKysely();
  if (!('actual_text' in patch)) {
    return getNonfinancialBenefitInProject(projectId, id);
  }
  return db
    .updateTable('nonfinancial_benefits')
    .set({ actual_text: patch.actual_text ?? null })
    .where('id', '=', Number(id))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}
