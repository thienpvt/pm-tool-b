import { getDb } from '@/lib/db';
import { buildUpdate } from '@/lib/repositories/_helpers';

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
  return db.get(
    `UPDATE team_members SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deleteTeamMember(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM team_members WHERE id = ? AND project_id = ?', rowId, projectId);
}

/** Fields the project report needs; capacity_json is parsed by the caller. */
export async function listForReport(projectId: number | string) {
  const db = await getDb();
  return db.all<{ id: number; domain: string; role: string; name: string; capacity_json: string }>(
    'SELECT id, domain, role, name, capacity_json FROM team_members WHERE project_id = ? ORDER BY domain, name',
    projectId,
  );
}

/** All columns, ordered by domain then id — the shape the resource-plan export renders. */
export async function listForExport(projectId: number | string) {
  const db = await getDb();
  return db.all<Record<string, string>>(
    'SELECT * FROM team_members WHERE project_id = ? ORDER BY domain, id',
    projectId,
  );
}
