import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `projects`.
 *
 * `company_id` and `customer_id` are deliberately absent: they decide which
 * tenant owns the row, and the PATCH handler used to let a caller set them.
 * `id` is the WHERE key and `created_at` is a DB default.
 * See ALLOWLIST-DIFF.md for the full derivation.
 */
export const PROJECT_COLUMNS = [
  'name',
  'client',
  'pm_name',
  'pm_email',
  'start_date',
  'end_date',
  'status',
  'current_phase',
  'description',
  'objective',
  'project_owner',
  'budget',
  'budget_currency',
  'headcount_quota',
  'budget_status',
] as const;

export type ProjectAccessRow = {
  company_id: number | null;
  customer_company_id: number | null;
};

/** Tenancy columns for an access check. Returns undefined when the project does not exist. */
export async function projectAccessRow(projectId: number | string) {
  const db = await getDb();
  return db.get<ProjectAccessRow>(
    `SELECT p.company_id, c.company_id AS customer_company_id
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    Number(projectId)
  );
}

export async function getProject(projectId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM projects WHERE id = ?', projectId);
}

/** Throws UnknownColumnError when `fields` carries a key outside PROJECT_COLUMNS. */
export async function updateProject(projectId: number | string, fields: Record<string, unknown>) {
  const { sql, values } = buildUpdate('projects', PROJECT_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE projects SET ${sql} WHERE id = ?`, ...values, projectId);
  return getProject(projectId);
}

export async function deleteProject(projectId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM projects WHERE id = ?', projectId);
}
