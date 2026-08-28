import { getDb } from '@/lib/db';
import { buildUpdate } from '@/lib/repositories/_helpers';

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
  return db.get(
    `UPDATE activities SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deleteActivity(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM activities WHERE id = ? AND project_id = ?', rowId, projectId);
}

/**
 * Rows in this project that carry a Jira key, used by the import path to decide
 * insert-vs-update and to resolve `parent_jira_key` references within a batch.
 */
export async function listJiraKeyed(projectId: number | string) {
  const db = await getDb();
  return db.all<{ id: number; jira_key: string }>(
    "SELECT id, jira_key FROM activities WHERE project_id = ? AND jira_key IS NOT NULL AND jira_key != ''",
    projectId,
  );
}

/** Just the keys, for the import dialog's overwrite-count preview. */
export async function listJiraKeys(projectId: number | string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.all<{ jira_key: string }>(
    "SELECT jira_key FROM activities WHERE project_id = ? AND jira_key IS NOT NULL AND jira_key != ''",
    projectId,
  );
  return rows.map(r => r.jira_key);
}

/**
 * Import-path fields. This is the fixed column set the import writes — deliberately
 * NOT the mass-assignment allowlist, because the import never takes caller-named
 * columns. `jira_key` is absent from the update list on purpose: it is the match key.
 */
export type ImportedActivity = Record<string, unknown>;

/** Update an existing row matched by Jira key. Preserves the route's exact column set. */
export async function updateImportedActivity(
  projectId: number | string,
  rowId: number,
  act: ImportedActivity,
  parentId: number | null,
) {
  const db = await getDb();
  return db.run(
    `UPDATE activities SET
        phase = ?, no = ?, activity = ?, deliverable = ?, sign_off_doc = ?,
        accountable = ?, responsible = ?, support = ?,
        plan_start = ?, plan_end = ?, actual_start = ?, actual_end = ?,
        status = ?, completion_pct = ?, notes = ?,
        delay_owner = ?, delay_reason = ?, sprint = ?, parent_id = ?, priority = ?
      WHERE id = ? AND project_id = ?`,
    act.phase ?? 'General', act.no ?? '', act.activity,
    act.deliverable ?? '', act.sign_off_doc ?? '',
    act.accountable ?? '', act.responsible ?? '', act.support ?? '',
    act.plan_start ?? '', act.plan_end ?? '',
    act.actual_start ?? '', act.actual_end ?? '',
    act.status ?? 'To-do', act.completion_pct ?? 0, act.notes ?? '',
    act.delay_owner ?? 'N/A', act.delay_reason ?? '', act.sprint ?? '',
    parentId, act.priority ?? 'Medium',
    rowId, projectId,
  );
}

/** Insert a new imported row at `orderIdx`. Returns the new row id. */
export async function insertImportedActivity(
  projectId: number | string,
  act: ImportedActivity,
  orderIdx: number,
  parentId: number | null,
  jiraKey: string,
): Promise<number> {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO activities
        (project_id, phase, no, activity, deliverable, sign_off_doc,
         accountable, responsible, support,
         plan_start, plan_end, actual_start, actual_end,
         status, completion_pct, notes, order_idx,
         delay_owner, delay_reason, jira_key, sprint, parent_id, priority)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    projectId, act.phase ?? 'General', act.no ?? '', act.activity,
    act.deliverable ?? '', act.sign_off_doc ?? '',
    act.accountable ?? '', act.responsible ?? '', act.support ?? '',
    act.plan_start ?? '', act.plan_end ?? '',
    act.actual_start ?? '', act.actual_end ?? '',
    act.status ?? 'To-do', act.completion_pct ?? 0, act.notes ?? '',
    orderIdx, act.delay_owner ?? 'N/A', act.delay_reason ?? '',
    jiraKey, act.sprint ?? '', parentId, act.priority ?? 'Medium',
  );
  return Number(r.lastInsertRowid);
}

/**
 * Report reads. Status sets are passed in by the caller because the weights that define
 * "done" / "in progress" live in lib/status-weights.ts, not in the database — the
 * repository must not duplicate that policy.
 */
export async function listDoneBetween(
  projectId: number | string,
  startDate: string,
  endDate: string,
  doneStatuses: readonly string[],
) {
  const db = await getDb();
  const placeholders = doneStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT * FROM activities WHERE project_id = ?
       AND actual_end >= ? AND actual_end <= ?
       AND status IN (${placeholders})
     ORDER BY actual_end`,
    projectId, startDate, endDate, ...doneStatuses,
  );
}

export async function listByStatuses(projectId: number | string, statuses: readonly string[]) {
  const db = await getDb();
  const placeholders = statuses.map(() => '?').join(',');
  return db.all(
    `SELECT * FROM activities WHERE project_id = ? AND status IN (${placeholders}) ORDER BY plan_end`,
    projectId, ...statuses,
  );
}

export async function listPlannedBetweenExcludingStatuses(
  projectId: number | string,
  startDate: string,
  endDate: string,
  excludedStatuses: readonly string[],
) {
  const db = await getDb();
  const placeholders = excludedStatuses.map(() => '?').join(',');
  return db.all(
    `SELECT * FROM activities WHERE project_id = ?
       AND plan_start >= ? AND plan_start <= ?
       AND status NOT IN (${placeholders})
     ORDER BY plan_start`,
    projectId, startDate, endDate, ...excludedStatuses,
  );
}

/** Just status + phase, for the weighted-completion rollup. */
export async function listStatusAndPhase(projectId: number | string) {
  const db = await getDb();
  return db.all<{ status: string; phase: string }>(
    'SELECT status, phase FROM activities WHERE project_id = ?',
    projectId,
  );
}

/** The column set the project-report page needs, ordered by plan_start. */
export async function listForProjectReport(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT id, activity, deliverable, status, phase, plan_start, plan_end,
            actual_start, actual_end, no, parent_id, accountable
     FROM activities WHERE project_id = ? ORDER BY plan_start, id`,
    projectId,
  );
}
