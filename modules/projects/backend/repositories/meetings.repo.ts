import { getDb } from '@/lib/db';
import { buildUpdate } from '@/lib/repositories/_helpers';

/** Updatable columns for `meetings`. No migration-added columns — see ALLOWLIST-DIFF.md. */
export const MEETING_COLUMNS = [
  'name', 'frequency', 'content', 'participants', 'method', 'type',
] as const;

export async function listMeetings(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM meetings WHERE project_id = ? ORDER BY id', projectId);
}

export async function createMeeting(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  const r = await db.run(
    'INSERT INTO meetings (project_id, name, frequency, content, participants, method, type) VALUES (?,?,?,?,?,?,?)',
    projectId, b.name ?? '', b.frequency ?? '', b.content ?? '', b.participants ?? '',
    b.method ?? '', b.type ?? 'regular');
  return db.get('SELECT * FROM meetings WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside MEETING_COLUMNS. */
export async function updateMeeting(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('meetings', MEETING_COLUMNS, fields);
  const db = await getDb();
  return db.get(
    `UPDATE meetings SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deleteMeeting(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM meetings WHERE id = ? AND project_id = ?', rowId, projectId);
}
