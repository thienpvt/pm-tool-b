import { sql, type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

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

type ActivityUpdate = Pick<Updateable<Database['activities']>, typeof ACTIVITY_COLUMNS[number]>;

export type ActivityInput = Record<string, unknown>;

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listActivities(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('order_idx')
    .orderBy('id')
    .execute();
}

/** MAX(order_idx) for a project, 0 when it has no activities. */
export async function maxOrderIdx(projectId: number | string): Promise<number> {
  const db = await getKysely();
  const row = await db
    .selectFrom('activities')
    .select((eb) => eb.fn.max('order_idx').as('m'))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
  return row?.m != null ? Number(row.m) : 0;
}

/** The project's own status, used as the `project_status` fallback on create. */
export async function projectStatus(projectId: number | string): Promise<string> {
  const db = await getKysely();
  const row = await db
    .selectFrom('projects')
    .select('status')
    .where('id', '=', Number(projectId))
    .executeTakeFirst();
  return row?.status ?? '';
}

export async function createActivity(projectId: number | string, body: ActivityInput) {
  const db = await getKysely();
  const b = body as Record<string, never>;
  const orderIdx = (await maxOrderIdx(projectId)) + 1;
  const status = b.project_status ?? (await projectStatus(projectId));
  const values: Insertable<Database['activities']> = {
    project_id: Number(projectId),
    phase: b.phase ?? 'General',
    no: b.no ?? '',
    activity: b.activity ?? '',
    deliverable: b.deliverable ?? '',
    sign_off_doc: b.sign_off_doc ?? '',
    accountable: b.accountable ?? '',
    responsible: b.responsible ?? '',
    support: b.support ?? '',
    plan_start: b.plan_start ?? '',
    plan_end: b.plan_end ?? '',
    actual_start: b.actual_start ?? '',
    actual_end: b.actual_end ?? '',
    status: b.status ?? 'To-do',
    completion_pct: b.completion_pct ?? 0,
    notes: b.notes ?? '',
    order_idx: orderIdx,
    delay_owner: b.delay_owner ?? 'N/A',
    delay_reason: b.delay_reason ?? '',
    jira_key: b.jira_key ?? '',
    sprint: b.sprint ?? '',
    project_status: status,
    parent_id: b.parent_id ?? null,
    priority: b.priority ?? 'Medium',
  };
  return db
    .insertInto('activities')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** @throws UnknownColumnError when `fields` names a column outside ACTIVITY_COLUMNS. */
export async function updateActivity(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<ActivityUpdate>(ACTIVITY_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('activities')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteActivity(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  const [result] = await db
    .deleteFrom('activities')
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result?.numDeletedRows);
}

/**
 * Rows in this project that carry a Jira key, used by the import path to decide
 * insert-vs-update and to resolve `parent_jira_key` references within a batch.
 */
export async function listJiraKeyed(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .select(['id', 'jira_key'])
    .where('project_id', '=', Number(projectId))
    .where('jira_key', 'is not', null)
    .where('jira_key', '!=', '')
    .execute();
}

/** Just the keys, for the import dialog's overwrite-count preview. */
export async function listJiraKeys(projectId: number | string): Promise<string[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('activities')
    .select('jira_key')
    .where('project_id', '=', Number(projectId))
    .where('jira_key', 'is not', null)
    .where('jira_key', '!=', '')
    .execute();
  return rows.map((r) => r.jira_key as string);
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
  const db = await getKysely();
  const [result] = await db
    .updateTable('activities')
    .set({
      phase: act.phase != null ? String(act.phase) : 'General',
      no: act.no != null ? String(act.no) : '',
      activity: String(act.activity),
      deliverable: act.deliverable != null ? String(act.deliverable) : '',
      sign_off_doc: act.sign_off_doc != null ? String(act.sign_off_doc) : '',
      accountable: act.accountable != null ? String(act.accountable) : '',
      responsible: act.responsible != null ? String(act.responsible) : '',
      support: act.support != null ? String(act.support) : '',
      plan_start: act.plan_start != null ? String(act.plan_start) : '',
      plan_end: act.plan_end != null ? String(act.plan_end) : '',
      actual_start: act.actual_start != null ? String(act.actual_start) : '',
      actual_end: act.actual_end != null ? String(act.actual_end) : '',
      status: act.status != null ? String(act.status) : 'To-do',
      completion_pct: act.completion_pct != null ? Number(act.completion_pct) : 0,
      notes: act.notes != null ? String(act.notes) : '',
      delay_owner: act.delay_owner != null ? String(act.delay_owner) : 'N/A',
      delay_reason: act.delay_reason != null ? String(act.delay_reason) : '',
      sprint: act.sprint != null ? String(act.sprint) : '',
      parent_id: parentId,
      priority: act.priority != null ? String(act.priority) : 'Medium',
    })
    .where('id', '=', rowId)
    .where('project_id', '=', Number(projectId))
    .execute();
  return { lastInsertRowid: 0, changes: Number(result?.numUpdatedRows ?? 0) };
}

/** Insert a new imported row at `orderIdx`. Returns the new row id. */
export async function insertImportedActivity(
  projectId: number | string,
  act: ImportedActivity,
  orderIdx: number,
  parentId: number | null,
  jiraKey: string,
): Promise<number> {
  const db = await getKysely();
  const row = await db
    .insertInto('activities')
    .values({
      project_id: Number(projectId),
      phase: act.phase != null ? String(act.phase) : 'General',
      no: act.no != null ? String(act.no) : '',
      activity: String(act.activity),
      deliverable: act.deliverable != null ? String(act.deliverable) : '',
      sign_off_doc: act.sign_off_doc != null ? String(act.sign_off_doc) : '',
      accountable: act.accountable != null ? String(act.accountable) : '',
      responsible: act.responsible != null ? String(act.responsible) : '',
      support: act.support != null ? String(act.support) : '',
      plan_start: act.plan_start != null ? String(act.plan_start) : '',
      plan_end: act.plan_end != null ? String(act.plan_end) : '',
      actual_start: act.actual_start != null ? String(act.actual_start) : '',
      actual_end: act.actual_end != null ? String(act.actual_end) : '',
      status: act.status != null ? String(act.status) : 'To-do',
      completion_pct: act.completion_pct != null ? Number(act.completion_pct) : 0,
      notes: act.notes != null ? String(act.notes) : '',
      order_idx: orderIdx,
      delay_owner: act.delay_owner != null ? String(act.delay_owner) : 'N/A',
      delay_reason: act.delay_reason != null ? String(act.delay_reason) : '',
      jira_key: jiraKey,
      sprint: act.sprint != null ? String(act.sprint) : '',
      parent_id: parentId,
      priority: act.priority != null ? String(act.priority) : 'Medium',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return Number(row.id);
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
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('actual_end', '>=', startDate)
    .where('actual_end', '<=', endDate)
    .where('status', 'in', [...doneStatuses])
    .orderBy('actual_end')
    .execute();
}

export async function listByStatuses(projectId: number | string, statuses: readonly string[]) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('status', 'in', [...statuses])
    .orderBy('plan_end')
    .execute();
}

export async function listPlannedBetweenExcludingStatuses(
  projectId: number | string,
  startDate: string,
  endDate: string,
  excludedStatuses: readonly string[],
) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('plan_start', '>=', startDate)
    .where('plan_start', '<=', endDate)
    .where('status', 'not in', [...excludedStatuses])
    .orderBy('plan_start')
    .execute();
}

/** Just status + phase, for the weighted-completion rollup. */
export async function listStatusAndPhase(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .select(['status', 'phase'])
    .where('project_id', '=', Number(projectId))
    .execute();
}

/** The column set the project-report page needs, ordered by plan_start. */
export async function listForProjectReport(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('activities')
    .select([
      'id',
      'activity',
      'deliverable',
      'status',
      'phase',
      'plan_start',
      'plan_end',
      'actual_start',
      'actual_end',
      'no',
      'parent_id',
      'accountable',
    ])
    .where('project_id', '=', Number(projectId))
    .orderBy('plan_start')
    .orderBy('id')
    .execute();
}
