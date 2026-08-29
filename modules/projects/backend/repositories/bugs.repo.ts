import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

/**
 * Bug snapshots.
 *
 * Rows are grouped by `snapshot_date`: a POST replaces one date's rows wholesale rather
 * than merging, so re-importing a day is idempotent. `severity` and `snapshot_date` are
 * migration-added columns, not present in the original CREATE TABLE — see
 * ALLOWLIST-DIFF.md.
 *
 * The bugs routes write fixed columns (no `Object.keys(body)`), so there is no
 * mass-assignment hole here and no allowlist is required.
 */

const BUG_COLS = [
  'id',
  'issue_type',
  'issue_key',
  'issue_id',
  'summary',
  'assignee',
  'reporter',
  'priority',
  'severity',
  'status',
  'resolution',
  'created',
  'snapshot_date',
  'created_at',
] as const;

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listSnapshotDates(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select(['snapshot_date', sql<number>`COUNT(*)`.as('count')])
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '!=', '')
    .groupBy('snapshot_date')
    .orderBy('snapshot_date', 'desc')
    .execute();
}

export async function latestSnapshotDate(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select('snapshot_date')
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '!=', '')
    .orderBy('snapshot_date', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export async function listBugsBySnapshot(projectId: number | string, date: string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select(BUG_COLS)
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '=', date)
    .orderBy('created_at')
    .execute();
}

export async function listAllBugs(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select(BUG_COLS)
    .where('project_id', '=', Number(projectId))
    .orderBy('created_at')
    .execute();
}

/**
 * The route's read path: an explicit date, else the latest snapshot, else every row.
 * Kept as one function so the fallback order cannot drift between callers.
 */
export async function listBugs(projectId: number | string, date?: string | null) {
  if (date) return listBugsBySnapshot(projectId, date);

  const latest = await latestSnapshotDate(projectId);
  if (latest?.snapshot_date) return listBugsBySnapshot(projectId, latest.snapshot_date);

  return listAllBugs(projectId);
}

export async function deleteSnapshot(projectId: number | string, date: string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('bugs')
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '=', date)
    .execute();
  return deleteResult(result.numDeletedRows);
}

export async function deleteAllBugs(projectId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('bugs')
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result.numDeletedRows);
}

/**
 * Replace one snapshot date's rows and return the inserted count.
 *
 * ponytail: row-at-a-time insert, matching the current route. A multi-row INSERT would be
 * faster but changes failure semantics mid-import — worth doing only if import size
 * becomes a real problem.
 */
export async function replaceSnapshot(
  projectId: number | string,
  bugs: Record<string, unknown>[],
  date: string,
): Promise<number> {
  const db = await getKysely();
  await db
    .deleteFrom('bugs')
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '=', date)
    .execute();

  let inserted = 0;
  for (const bug of bugs) {
    await db
      .insertInto('bugs')
      .values({
        project_id: Number(projectId),
        issue_type: String(bug.issue_type ?? ''),
        issue_key: String(bug.issue_key ?? ''),
        issue_id: String(bug.issue_id ?? ''),
        summary: String(bug.summary ?? ''),
        assignee: String(bug.assignee ?? ''),
        reporter: String(bug.reporter ?? ''),
        priority: String(bug.priority ?? 'Medium'),
        severity: String(bug.severity ?? ''),
        status: String(bug.status ?? 'To Do'),
        resolution: String(bug.resolution ?? ''),
        created: String(bug.created ?? ''),
        snapshot_date: date,
      })
      .execute();
    inserted++;
  }
  return inserted;
}

/**
 * Closest snapshot on or before `date`. Used by the project report in milestone mode,
 * where the relevant snapshot is the one current as of the milestone end date.
 */
export async function snapshotDateOnOrBefore(projectId: number | string, date: string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select('snapshot_date')
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '!=', '')
    .where('snapshot_date', '<=', date)
    .orderBy('snapshot_date', 'desc')
    .limit(1)
    .executeTakeFirst();
}

/** MAX(snapshot_date) shape the report uses when not scoped to a milestone. */
export async function maxSnapshotDate(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select(sql<string>`MAX(snapshot_date)`.as('snapshot_date'))
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '!=', '')
    .executeTakeFirst();
}

/** Status/priority counts for one snapshot. The report aggregates these into totals. */
export async function countsBySnapshot(projectId: number | string, snapshotDate: string) {
  const db = await getKysely();
  return db
    .selectFrom('bugs')
    .select(['status', 'priority', sql<number>`COUNT(*)`.as('cnt')])
    .where('project_id', '=', Number(projectId))
    .where('snapshot_date', '=', snapshotDate)
    .groupBy(['status', 'priority'])
    .execute();
}
