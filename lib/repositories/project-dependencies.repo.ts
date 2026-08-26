import { getDb } from '@/lib/db';

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

const ACTIVE_DEP = `
  effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
`;

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
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO project_dependencies (
      from_project_id, to_project_id, dependency_type, need_by,
      effective_from, effective_to, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.fromProjectId,
    input.toProjectId,
    input.dependencyType,
    input.needBy,
    input.effectiveFrom,
    input.effectiveTo ?? null,
    input.notes ?? null,
    input.createdBy,
  );
  return db.get<ProjectDependencyRow>(
    'SELECT * FROM project_dependencies WHERE id = ?',
    r.lastInsertRowid,
  );
}

export async function listProjectDependencies(projectId: number | string) {
  const db = await getDb();
  return db.all<ProjectDependencyListRow>(
    `SELECT *,
      CASE WHEN from_project_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM project_dependencies
     WHERE from_project_id = ? OR to_project_id = ?
     ORDER BY need_by, id`,
    Number(projectId),
    Number(projectId),
    Number(projectId),
  );
}

export async function listOpenProjectDependencies(projectId: number | string) {
  const db = await getDb();
  return db.all<ProjectDependencyListRow>(
    `SELECT *,
      CASE WHEN from_project_id = ? THEN 'outgoing' ELSE 'incoming' END AS direction
     FROM project_dependencies
     WHERE (from_project_id = ? OR to_project_id = ?)
       AND ${ACTIVE_DEP}
     ORDER BY need_by, id`,
    Number(projectId),
    Number(projectId),
    Number(projectId),
  );
}

/** Date-window intersection for same from/to/type (NULL effective_to is open-ended). */
export async function hasOverlappingEquivalentDependency(
  fromId: number,
  toId: number,
  type: DependencyType,
  effectiveFrom: string,
  effectiveTo: string | null | undefined,
): Promise<boolean> {
  const db = await getDb();
  const newTo = effectiveTo ?? FAR_FUTURE;
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_dependencies
     WHERE from_project_id = ? AND to_project_id = ? AND dependency_type = ?
       AND effective_from < ?
       AND ? < COALESCE(effective_to, ?)
     LIMIT 1`,
    fromId,
    toId,
    type,
    newTo,
    effectiveFrom,
    FAR_FUTURE,
  );
  return !!row;
}

export async function getDependencyInFromProject(
  fromProjectId: number | string,
  dependencyId: number | string,
) {
  const db = await getDb();
  return db.get<ProjectDependencyRow>(
    'SELECT * FROM project_dependencies WHERE id = ? AND from_project_id = ?',
    dependencyId,
    Number(fromProjectId),
  );
}

export async function softEndDependency(
  fromProjectId: number | string,
  dependencyId: number | string,
  effectiveTo?: string,
) {
  const db = await getDb();
  if (effectiveTo === undefined) {
    return db.get<ProjectDependencyRow>(
      `UPDATE project_dependencies SET effective_to = CURRENT_DATE
       WHERE id = ? AND from_project_id = ? AND effective_to IS NULL
       RETURNING *`,
      dependencyId,
      Number(fromProjectId),
    );
  }
  return db.get<ProjectDependencyRow>(
    `UPDATE project_dependencies SET effective_to = ?
     WHERE id = ? AND from_project_id = ? AND effective_to IS NULL
     RETURNING *`,
    effectiveTo,
    dependencyId,
    Number(fromProjectId),
  );
}
