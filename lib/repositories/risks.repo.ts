import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `risks`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const RISK_COLUMNS = [
  'risk_id', 'description', 'category', 'owner', 'trigger', 'mitigation', 'due_date',
  'status', 'priority', 'impact', 'affected_activity_id',
] as const;

export async function listRisks(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM risks WHERE project_id = ? ORDER BY id', projectId);
}

export async function countRisks(projectId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM risks WHERE project_id = ?', projectId);
  return Number(row?.c ?? 0);
}

export async function createRisk(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  // Display id derives from COUNT(*), matching current behavior. Not a sequence —
  // switching would change assigned ids.
  const riskId = b.risk_id || `R${(await countRisks(projectId)) + 1}`;
  const r = await db.run(
    'INSERT INTO risks (project_id, risk_id, description, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    projectId, riskId, b.description ?? '', b.category ?? '', b.owner ?? '', b.trigger ?? '',
    b.mitigation ?? '', b.due_date ?? '', b.status ?? 'Open', b.priority ?? 'Medium',
    b.impact ?? 'Major', b.affected_activity_id ?? null);
  return db.get('SELECT * FROM risks WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside RISK_COLUMNS. */
export async function updateRisk(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('risks', RISK_COLUMNS, fields);
  const db = await getDb();
  return db.get(
    `UPDATE risks SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deleteRisk(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM risks WHERE id = ? AND project_id = ?', rowId, projectId);
}

/** Open risks for the weekly report: status Open or In Progress, ordered by priority text. */
export async function listOpenRisks(projectId: number | string) {
  const db = await getDb();
  return db.all(
    "SELECT * FROM risks WHERE project_id = ? AND (status='Open' OR status='In Progress') ORDER BY priority",
    projectId,
  );
}

/**
 * Everything not Closed, ordered by priority severity rather than alphabetically.
 * The CASE ordering is the project-report page's existing behavior — preserved verbatim.
 */
export async function listNotClosedByPriority(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM risks WHERE project_id = ? AND status != 'Closed'
     ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id`,
    projectId,
  );
}
