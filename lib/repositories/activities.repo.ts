import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `activities`. Excludes `id` (the WHERE key) and `project_id`
 * (the scoping param, passed as an argument — REPO-02).
 *
 * `project_status` and `parent_id` are migration-added, not in the CREATE TABLE block,
 * but the current POST handler persists both — see ALLOWLIST-DIFF.md.
 */
export const ACTIVITY_COLUMNS = [
  'phase', 'no', 'activity', 'deliverable', 'sign_off_doc', 'accountable', 'responsible',
  'support', 'plan_start', 'plan_end', 'actual_start', 'actual_end', 'status',
  'completion_pct', 'notes', 'order_idx', 'delay_owner', 'delay_reason', 'jira_key',
  'sprint', 'priority', 'project_status', 'parent_id',
] as const;

export type ActivityInput = Record<string, unknown>;

export async function listActivities(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM activities WHERE project_id = ? ORDER BY order_idx, id', projectId);
}

/** MAX(order_idx) for a project, 0 when it has no activities. */
export async function maxOrderIdx(projectId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ m: number | null }>(
    'SELECT MAX(order_idx) as m FROM activities WHERE project_id = ?', projectId);
  return row?.m ?? 0;
}

/** The project's own status, used as the `project_status` fallback on create. */
export async function projectStatus(projectId: number | string): Promise<string> {
  const db = await getDb();
  const row = await db.get<{ status: string }>('SELECT status FROM projects WHERE id = ?', projectId);
  return row?.status ?? '';
}

export async function createActivity(projectId: number | string, body: ActivityInput) {
  const db = await getDb();
  const b = body as Record<string, never>;
  const orderIdx = (await maxOrderIdx(projectId)) + 1;
  const status = b.project_status ?? (await projectStatus(projectId));
  const r = await db.run(`
    INSERT INTO activities (project_id, phase, no, activity, deliverable, sign_off_doc, accountable, responsible, support, plan_start, plan_end, actual_start, actual_end, status, completion_pct, notes, order_idx, delay_owner, delay_reason, jira_key, sprint, project_status, parent_id, priority)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, projectId, b.phase ?? 'General', b.no ?? '', b.activity ?? '', b.deliverable ?? '',
    b.sign_off_doc ?? '', b.accountable ?? '', b.responsible ?? '', b.support ?? '',
    b.plan_start ?? '', b.plan_end ?? '', b.actual_start ?? '', b.actual_end ?? '',
    b.status ?? 'To-do', b.completion_pct ?? 0, b.notes ?? '', orderIdx,
    b.delay_owner ?? 'N/A', b.delay_reason ?? '', b.jira_key ?? '', b.sprint ?? '',
    status, b.parent_id ?? null, b.priority ?? 'Medium');
  return db.get('SELECT * FROM activities WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside ACTIVITY_COLUMNS. */
export async function updateActivity(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('activities', ACTIVITY_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE activities SET ${sql} WHERE id = ? AND project_id = ?`, ...values, rowId, projectId);
  return db.get('SELECT * FROM activities WHERE id = ?', rowId);
}

export async function deleteActivity(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM activities WHERE id = ? AND project_id = ?', rowId, projectId);
}
