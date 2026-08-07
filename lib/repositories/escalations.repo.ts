import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `escalation_levels`. No migration-added columns.
 *
 * The route exposes only GET and PUT — there is no create or delete handler today, so
 * this module intentionally has no `createEscalation` / `deleteEscalation`. Adding them
 * would be new API surface, not a SQL move.
 */
export const ESCALATION_COLUMNS = [
  'level', 'level_name', 'channel', 'participants', 'input', 'output',
] as const;

export async function listEscalations(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM escalation_levels WHERE project_id = ? ORDER BY level DESC', projectId);
}

/** @throws UnknownColumnError when `fields` names a column outside ESCALATION_COLUMNS. */
export async function updateEscalation(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('escalation_levels', ESCALATION_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE escalation_levels SET ${sql} WHERE id = ? AND project_id = ?`, ...values, rowId, projectId);
  return db.get('SELECT * FROM escalation_levels WHERE id = ?', rowId);
}
