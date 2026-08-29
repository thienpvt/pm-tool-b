import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export type DependencyType =
  | 'FINISH_TO_START'
  | 'START_TO_START'
  | 'FINISH_TO_FINISH'
  | 'START_TO_FINISH'
  | 'BLOCKS';

export type ProjectDependencyRow = {
  id: number;
  from_project_id: number;
  to_project_id: number;
  dependency_type: DependencyType;
  need_by: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: string;
};

export type ProjectDependencyListRow = ProjectDependencyRow & {
  direction: 'outgoing' | 'incoming';
};

const FAR_FUTURE = '9999-12-31';

export async function insertProjectDependency(input: {
  fromProjectId: number;
  toProjectId: number;
  dependencyType: DependencyType;
  needBy: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string | null;
  createdBy: number;
}) {
  const db = await getKysely();
  return db
    .insertInto('project_dependencies')
    .values({
      from_project_id: input.fromProjectId,
      to_project_id: input.toProjectId,
      dependency_type: input.dependencyType,
      need_by: input.needBy,
      effective_from: input.effectiveFrom,
      effective_to: input.effectiveTo ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function listProjectDependencies(projectId: number | string) {
  const db = await getKysely();
  const pid = Number(projectId);
  const result = await sql<ProjectDependencyListRow>`
    SELECT *,
      CASE WHEN from_project_id = ${pid} THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM project_dependencies
     WHERE from_project_id = ${pid} OR to_project_id = ${pid}
     ORDER BY need_by, id
  `.execute(db);
  return result.rows;
}

/** Active-window list for Phase 16 dashboards (D-16). */
export async function listOpenProjectDependencies(projectId: number | string) {
  const db = await getKysely();
  const pid = Number(projectId);
  const result = await sql<ProjectDependencyListRow>`
    SELECT *,
      CASE WHEN from_project_id = ${pid} THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM project_dependencies
     WHERE (from_project_id = ${pid} OR to_project_id = ${pid})
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
     ORDER BY need_by, id
  `.execute(db);
  return result.rows;
}

/** Date-window intersection for same from/to/type (NULL effective_to is open-ended). */
export async function hasOverlappingEquivalentDependency(
  fromId: number,
  toId: number,
  type: DependencyType,
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
): Promise<boolean> {
  const db = await getKysely();
  const newTo = effectiveTo ?? FAR_FUTURE;
  const row = await db
    .selectFrom('project_dependencies')
    .select(sql<number>`1`.as('ok'))
    .where('from_project_id', '=', fromId)
    .where('to_project_id', '=', toId)
    .where('dependency_type', '=', type)
    .where('effective_from', '<', newTo)
    .where(sql<boolean>`${effectiveFrom} < COALESCE(effective_to, ${FAR_FUTURE})`)
    .executeTakeFirst();
  return !!row;
}

export async function getDependencyInFromProject(
  fromProjectId: number | string,
  dependencyId: number | string,
) {
  const db = await getKysely();
  return db
    .selectFrom('project_dependencies')
    .selectAll()
    .where('id', '=', Number(dependencyId))
    .where('from_project_id', '=', Number(fromProjectId))
    .executeTakeFirst();
}

export async function softEndDependency(
  fromProjectId: number | string,
  dependencyId: number | string,
  effectiveTo?: string,
) {
  const db = await getKysely();
  if (effectiveTo === undefined) {
    return db
      .updateTable('project_dependencies')
      .set({ effective_to: sql<string>`CURRENT_DATE` })
      .where('id', '=', Number(dependencyId))
      .where('from_project_id', '=', Number(fromProjectId))
      .where('effective_to', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }
  return db
    .updateTable('project_dependencies')
    .set({ effective_to: effectiveTo })
    .where('id', '=', Number(dependencyId))
    .where('from_project_id', '=', Number(fromProjectId))
    .where('effective_to', 'is', null)
    .returningAll()
    .executeTakeFirst();
}
