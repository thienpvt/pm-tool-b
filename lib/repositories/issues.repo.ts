import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `issues`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const ISSUE_COLUMNS = [
  'issue_id', 'description', 'root_cause', 'category', 'owner', 'trigger', 'mitigation',
  'due_date', 'status', 'priority', 'impact', 'affected_activity_id',
] as const;

export async function listIssues(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM issues WHERE project_id = ? ORDER BY id', projectId);
}

export async function countIssues(projectId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM issues WHERE project_id = ?', projectId);
  return Number(row?.c ?? 0);
}

export async function createIssue(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  // Display id derives from COUNT(*), matching current behavior.
  const issueId = b.issue_id || `I${(await countIssues(projectId)) + 1}`;
  const r = await db.run(
    'INSERT INTO issues (project_id, issue_id, description, root_cause, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    projectId, issueId, b.description ?? '', b.root_cause ?? '', b.category ?? '', b.owner ?? '',
    b.trigger ?? '', b.mitigation ?? '', b.due_date ?? '', b.status ?? 'Open',
    b.priority ?? 'Medium', b.impact ?? 'Major', b.affected_activity_id ?? null);
  return db.get('SELECT * FROM issues WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside ISSUE_COLUMNS. */
export async function updateIssue(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('issues', ISSUE_COLUMNS, fields);
  const db = await getDb();
  return db.get(
    `UPDATE issues SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deleteIssue(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM issues WHERE id = ? AND project_id = ?', rowId, projectId);
}

/** Open issues for the weekly report: status Open or In Progress, ordered by priority text. */
export async function listOpenIssues(projectId: number | string) {
  const db = await getDb();
  return db.all(
    "SELECT * FROM issues WHERE project_id = ? AND (status='Open' OR status='In Progress') ORDER BY priority",
    projectId,
  );
}

/** Everything not Closed, ordered by priority severity — matches the project-report page. */
export async function listNotClosedByPriority(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM issues WHERE project_id = ? AND status != 'Closed'
     ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id`,
    projectId,
  );
}
