import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `issues`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const ISSUE_COLUMNS = [
  'issue_id', 'code', 'description', 'root_cause', 'category', 'owner', 'trigger', 'mitigation',
  'due_date', 'status', 'priority', 'impact', 'affected_activity_id', 'technology_council',
] as const;

function raidTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const RAID_IS_OVERDUE = `(due_date < ? AND status IN ('Open','In Progress')) AS is_overdue`;

const RAID_OPEN_ORDER = `
  CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
  CASE WHEN (due_date < ? AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END,
  due_date NULLS LAST,
  id`;

const RAID_ALL_ORDER = `
  CASE WHEN status IN ('Open','In Progress') THEN 0 ELSE 1 END,
  CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
  CASE WHEN (due_date < ? AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END,
  due_date NULLS LAST,
  id`;

export async function listIssues(projectId: number | string) {
  const db = await getDb();
  const today = raidTodayUtc();
  return db.all(
    `SELECT *, ${RAID_IS_OVERDUE} FROM issues WHERE project_id = ? ORDER BY ${RAID_ALL_ORDER}`,
    today,
    projectId,
    today,
  );
}

export async function countIssues(projectId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM issues WHERE project_id = ?', projectId);
  return Number(row?.c ?? 0);
}

export async function getIssue(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM issues WHERE id = ? AND project_id = ?', rowId, projectId);
}

export async function findIssueByCode(
  projectId: number | string,
  code: string,
  excludeId?: number | string,
) {
  const db = await getDb();
  return db.get<{ id: number }>(
    `SELECT id FROM issues
     WHERE project_id = ? AND LOWER(code) = LOWER(?)
       AND id != COALESCE(?, -1)
     LIMIT 1`,
    projectId,
    code,
    excludeId ?? null,
  );
}

async function nextAutoIssueCode(projectId: number | string): Promise<string> {
  const db = await getDb();
  const rows = await db.all<{ code: string }>(
    `SELECT code FROM issues WHERE project_id = ? AND code ~ '^I-[0-9]+$'`,
    projectId,
  );
  let max = 0;
  for (const row of rows) {
    const m = /^I-(\d+)$/.exec(row.code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max > 0 ? max + 1 : (await countIssues(projectId)) + 1;
  return `I-${String(next).padStart(3, '0')}`;
}

export async function createIssue(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  let code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) {
    do {
      code = await nextAutoIssueCode(projectId);
    } while (await findIssueByCode(projectId, code));
  }
  const issueId = b.issue_id || code;
  const r = await db.run(
    `INSERT INTO issues (project_id, issue_id, code, description, root_cause, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id, technology_council)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    projectId, issueId, code, b.description ?? '', b.root_cause ?? '', b.category ?? '', b.owner ?? '',
    b.trigger ?? '', b.mitigation ?? '', b.due_date ?? '', b.status ?? 'Open',
    b.priority ?? 'Medium', b.impact ?? 'Major', b.affected_activity_id ?? null,
    b.technology_council ?? false);
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

export async function deactivateIssue(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.get(
    `UPDATE issues SET status = 'deactivated', deactivated_at = now()
     WHERE id = ? AND project_id = ? RETURNING *`,
    rowId, projectId,
  );
}

/** Open issues for the weekly report: status Open or In Progress, ordered by priority severity with overdue first (D-07). */
export async function listOpenIssues(projectId: number | string) {
  const db = await getDb();
  const today = raidTodayUtc();
  return db.all(
    `SELECT *, ${RAID_IS_OVERDUE} FROM issues
     WHERE project_id = ? AND (status='Open' OR status='In Progress')
     ORDER BY ${RAID_OPEN_ORDER}`,
    today,
    projectId,
    today,
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
