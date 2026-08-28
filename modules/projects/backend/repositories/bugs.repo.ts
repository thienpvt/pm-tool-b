import { getDb } from '@/lib/db';

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

/** Column list the route returns. Kept verbatim so response shape does not change. */
const BUG_COLS =
  'id, issue_type, issue_key, issue_id, summary, assignee, reporter, priority, severity, status, resolution, created, snapshot_date, created_at';

export async function listSnapshotDates(projectId: number | string) {
  const db = await getDb();
  return db.all<{ snapshot_date: string; count: number }>(
    `SELECT snapshot_date, COUNT(*) as count FROM bugs
       WHERE project_id = ? AND snapshot_date != ''
       GROUP BY snapshot_date ORDER BY snapshot_date DESC`,
    projectId,
  );
}

export async function latestSnapshotDate(projectId: number | string) {
  const db = await getDb();
  return db.get<{ snapshot_date: string }>(
    `SELECT snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != ''
       ORDER BY snapshot_date DESC LIMIT 1`,
    projectId,
  );
}

export async function listBugsBySnapshot(projectId: number | string, date: string) {
  const db = await getDb();
  return db.all(
    `SELECT ${BUG_COLS} FROM bugs WHERE project_id = ? AND snapshot_date = ? ORDER BY created_at`,
    projectId, date,
  );
}

export async function listAllBugs(projectId: number | string) {
  const db = await getDb();
  return db.all(`SELECT ${BUG_COLS} FROM bugs WHERE project_id = ? ORDER BY created_at`, projectId);
}

/**
 * The route's read path: an explicit date, else the latest snapshot, else every row.
 * Kept as one function so the fallback order cannot drift between callers.
 */
export async function listBugs(projectId: number | string, date?: string | null) {
  if (date) return listBugsBySnapshot(projectId, date);

  const latest = await latestSnapshotDate(projectId);
  if (latest) return listBugsBySnapshot(projectId, latest.snapshot_date);

  return listAllBugs(projectId);
}

export async function deleteSnapshot(projectId: number | string, date: string) {
  const db = await getDb();
  return db.run('DELETE FROM bugs WHERE project_id = ? AND snapshot_date = ?', projectId, date);
}

export async function deleteAllBugs(projectId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM bugs WHERE project_id = ?', projectId);
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
  const db = await getDb();
  await db.run('DELETE FROM bugs WHERE project_id = ? AND snapshot_date = ?', projectId, date);

  let inserted = 0;
  for (const bug of bugs) {
    await db.run(
      `INSERT INTO bugs
         (project_id, issue_type, issue_key, issue_id, summary, assignee, reporter,
          priority, severity, status, resolution, created, snapshot_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      projectId,
      bug.issue_type ?? '',
      bug.issue_key ?? '',
      bug.issue_id ?? '',
      bug.summary ?? '',
      bug.assignee ?? '',
      bug.reporter ?? '',
      bug.priority ?? 'Medium',
      bug.severity ?? '',
      bug.status ?? 'To Do',
      bug.resolution ?? '',
      bug.created ?? '',
      date,
    );
    inserted++;
  }
  return inserted;
}

/**
 * Closest snapshot on or before `date`. Used by the project report in milestone mode,
 * where the relevant snapshot is the one current as of the milestone end date.
 */
export async function snapshotDateOnOrBefore(projectId: number | string, date: string) {
  const db = await getDb();
  return db.get<{ snapshot_date: string }>(
    `SELECT snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != '' AND snapshot_date <= ?
     ORDER BY snapshot_date DESC LIMIT 1`,
    projectId, date,
  );
}

/** MAX(snapshot_date) shape the report uses when not scoped to a milestone. */
export async function maxSnapshotDate(projectId: number | string) {
  const db = await getDb();
  return db.get<{ snapshot_date: string }>(
    `SELECT MAX(snapshot_date) as snapshot_date FROM bugs WHERE project_id = ? AND snapshot_date != ''`,
    projectId,
  );
}

/** Status/priority counts for one snapshot. The report aggregates these into totals. */
export async function countsBySnapshot(projectId: number | string, snapshotDate: string) {
  const db = await getDb();
  return db.all<{ status: string; priority: string; cnt: number }>(
    `SELECT status, priority, COUNT(*) as cnt FROM bugs
     WHERE project_id = ? AND snapshot_date = ?
     GROUP BY status, priority`,
    projectId, snapshotDate,
  );
}
