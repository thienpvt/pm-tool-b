import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/** Updatable columns for `team_members`. `email` is migration-added — see ALLOWLIST-DIFF.md. */
export const TEAM_COLUMNS = [
  'domain', 'role', 'name', 'email', 'capacity_json', 'notes',
] as const;

export async function listTeam(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM team_members WHERE project_id = ? ORDER BY domain, id', projectId);
}

export async function createTeamMember(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  const r = await db.run(
    'INSERT INTO team_members (project_id, domain, role, name, email, capacity_json, notes) VALUES (?,?,?,?,?,?,?)',
    projectId, b.domain ?? '', b.role ?? '', b.name ?? '', b.email ?? '',
    b.capacity_json ?? '{}', b.notes ?? '');
  return db.get('SELECT * FROM team_members WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside TEAM_COLUMNS. */
export async function updateTeamMember(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('team_members', TEAM_COLUMNS, fields);
  const db = await getDb();
  await db.run(`UPDATE team_members SET ${sql} WHERE id = ? AND project_id = ?`, ...values, rowId, projectId);
  return db.get('SELECT * FROM team_members WHERE id = ?', rowId);
}

export async function deleteTeamMember(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM team_members WHERE id = ? AND project_id = ?', rowId, projectId);
}
