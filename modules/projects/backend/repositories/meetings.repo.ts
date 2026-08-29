import { type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

/** Updatable columns for `meetings`. No migration-added columns — see ALLOWLIST-DIFF.md. */
export const MEETING_COLUMNS = [
  'name', 'frequency', 'content', 'participants', 'method', 'type',
] as const;

type MeetingUpdate = Pick<Updateable<Database['meetings']>, typeof MEETING_COLUMNS[number]>;

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listMeetings(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('meetings')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('id')
    .execute();
}

export async function createMeeting(projectId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const b = body as Record<string, unknown>;
  const values: Insertable<Database['meetings']> = {
    project_id: Number(projectId),
    name: b.name != null ? String(b.name) : '',
    frequency: b.frequency != null ? String(b.frequency) : '',
    content: b.content != null ? String(b.content) : '',
    participants: b.participants != null ? String(b.participants) : '',
    method: b.method != null ? String(b.method) : '',
    type: b.type != null ? String(b.type) : 'regular',
  };
  return db
    .insertInto('meetings')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** @throws UnknownColumnError when `fields` names a column outside MEETING_COLUMNS. */
export async function updateMeeting(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<MeetingUpdate>(MEETING_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('meetings')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteMeeting(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  const [result] = await db
    .deleteFrom('meetings')
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result?.numDeletedRows);
}
