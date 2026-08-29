import { type Updateable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';
import { pickAllowed } from '@/lib/repositories/_kysely-helpers';

/**
 * Updatable columns for `escalation_levels`. No migration-added columns.
 *
 * The route exposes only GET and PUT — there is no create or delete handler today, so
 * this module intentionally has no `createEscalation` / `deleteEscalation`. Adding them
 * would be new API surface, not a SQL move.
 */
export const ESCALATION_COLUMNS = [
  'level', 'level_name', 'channel', 'participants', 'input', 'output',
] as const;

type EscalationUpdate = Pick<Updateable<Database['escalation_levels']>, typeof ESCALATION_COLUMNS[number]>;

export async function listEscalations(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('escalation_levels')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('level', 'desc')
    .execute();
}

/** Ascending level order used by the project-plan export workbook. */
export async function listEscalationsForExport(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('escalation_levels')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('level')
    .execute();
}

/** @throws UnknownColumnError when `fields` names a column outside ESCALATION_COLUMNS. */
export async function updateEscalation(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const picked = pickAllowed<EscalationUpdate>(ESCALATION_COLUMNS, fields);
  const db = await getKysely();
  return db
    .updateTable('escalation_levels')
    .set(picked)
    .where('id', '=', Number(rowId))
    .where('project_id', '=', Number(projectId))
    .returningAll()
    .executeTakeFirst();
}
