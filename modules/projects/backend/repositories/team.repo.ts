import { type Insertable, type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

/** Updatable columns for `team_members`. `email` is migration-added — see ALLOWLIST-DIFF.md. */
export const TEAM_COLUMNS = [
  'domain', 'role', 'name', 'email', 'capacity_json', 'notes',
] as const;

type TeamUpdate = Pick<Updateable<Database['team_members']>, typeof TEAM_COLUMNS[number]>;

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listTeam(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('team_members')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('domain')
    .orderBy('id')
    .execute();
}

export async function createTeamMember(projectId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  const b = body as Record<string, unknown>;
  const values: Insertable<Database['team_members']> = {
    project_id: Number(projectId),
    domain: b.domain != null ? String(b.domain) : '',
    role: b.role != null ? String(b.role) : '',
    name: b.name != null ? String(b.name) : '',
    email: b.email != null ? String(b.email) : '',
    capacity_json: b.capacity_json != null ? String(b.capacity_json) : '{}',
    notes: b.notes != null ? String(b.notes) : '',
  };
  return db
    .insertInto('team_members')
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** @throws UnknownColumnError when `fields` names a column outside TEAM_COLUMNS. */
export async function updateTeamMember(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<TeamUpdate>(TEAM_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('team_members')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteTeamMember(projectId: number | string, rowId: number | string) {
  const db = await getKysely();
  const [result] = await db
    .deleteFrom('team_members')
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .execute();
  return deleteResult(result?.numDeletedRows);
}

/** Fields the project report needs; capacity_json is parsed by the caller. */
export async function listForReport(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('team_members')
    .select(['id', 'domain', 'role', 'name', 'capacity_json'])
    .where('project_id', '=', Number(projectId))
    .orderBy('domain')
    .orderBy('name')
    .execute();
}

/** All columns, ordered by domain then id — the shape the resource-plan export renders. */
export async function listForExport(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('team_members')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('domain')
    .orderBy('id')
    .execute();
}
