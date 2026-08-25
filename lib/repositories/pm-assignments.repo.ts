import { Pool } from 'pg';
import { getDb } from '@/lib/db';

export type PmAssignmentRole = 'primary' | 'collaborator';

export type PmAssignmentRow = {
  id: number;
  project_id: number;
  user_id: number;
  role: PmAssignmentRole;
  effective_from: string;
  effective_to: string | null;
};

const ACTIVE_WINDOW = `
  effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
`;

/** Shared window predicate for access and list (D-13, PMAS-04). */
export async function hasActivePmAssignment(
  projectId: number | string,
  userId: number,
): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_pm_assignments
     WHERE project_id = ? AND user_id = ?
       AND ${ACTIVE_WINDOW}
     LIMIT 1`,
    Number(projectId),
    userId,
  );
  return !!row;
}

export async function listPmAssignments(projectId: number | string) {
  const db = await getDb();
  return db.all<PmAssignmentRow>(
    `SELECT * FROM project_pm_assignments
     WHERE project_id = ?
     ORDER BY effective_from DESC, id DESC`,
    Number(projectId),
  );
}

export async function getActivePrimaryAssignment(projectId: number | string) {
  const db = await getDb();
  return db.get<PmAssignmentRow>(
    `SELECT * FROM project_pm_assignments
     WHERE project_id = ? AND role = 'primary' AND ${ACTIVE_WINDOW}
     LIMIT 1`,
    Number(projectId),
  );
}

export async function getPmAssignmentById(
  projectId: number | string,
  assignmentId: number | string,
) {
  const db = await getDb();
  return db.get<PmAssignmentRow>(
    'SELECT * FROM project_pm_assignments WHERE id = ? AND project_id = ?',
    assignmentId,
    Number(projectId),
  );
}

export async function hasOverlappingPmAssignment(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_pm_assignments
     WHERE project_id = ? AND user_id = ? AND role <> ?
       AND ${ACTIVE_WINDOW}
     LIMIT 1`,
    Number(projectId),
    userId,
    role,
  );
  return !!row;
}

export async function hasActivePmAssignmentForUserRole(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
): Promise<boolean> {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_pm_assignments
     WHERE project_id = ? AND user_id = ? AND role = ?
       AND ${ACTIVE_WINDOW}
     LIMIT 1`,
    Number(projectId),
    userId,
    role,
  );
  return !!row;
}

export async function insertPmAssignment(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO project_pm_assignments (project_id, user_id, role, effective_from, effective_to)
     VALUES (?, ?, ?, CURRENT_DATE, NULL)`,
    Number(projectId),
    userId,
    role,
  );
  return db.get<PmAssignmentRow>(
    'SELECT * FROM project_pm_assignments WHERE id = ?',
    r.lastInsertRowid,
  );
}

export async function softEndPmAssignment(
  projectId: number | string,
  assignmentId: number | string,
  effectiveTo?: string,
) {
  const db = await getDb();
  if (effectiveTo === undefined) {
    return db.get<PmAssignmentRow>(
      `UPDATE project_pm_assignments SET effective_to = CURRENT_DATE
       WHERE id = ? AND project_id = ? AND effective_to IS NULL
       RETURNING *`,
      assignmentId,
      Number(projectId),
    );
  }
  return db.get<PmAssignmentRow>(
    `UPDATE project_pm_assignments SET effective_to = ?
     WHERE id = ? AND project_id = ? AND effective_to IS NULL
     RETURNING *`,
    effectiveTo,
    assignmentId,
    Number(projectId),
  );
}

export async function softEndActivePrimary(
  projectId: number | string,
  effectiveTo?: string,
) {
  const db = await getDb();
  const endExpr = effectiveTo === undefined ? 'CURRENT_DATE' : '?';
  const params =
    effectiveTo === undefined ? [Number(projectId)] : [effectiveTo, Number(projectId)];
  await db.run(
    `UPDATE project_pm_assignments SET effective_to = ${endExpr}
     WHERE project_id = ? AND role = 'primary' AND ${ACTIVE_WINDOW}`,
    ...params,
  );
}

export async function softEndActiveCollaborators(
  projectId: number | string,
  effectiveTo?: string,
) {
  const db = await getDb();
  const endExpr = effectiveTo === undefined ? 'CURRENT_DATE' : '?';
  const params =
    effectiveTo === undefined ? [Number(projectId)] : [effectiveTo, Number(projectId)];
  await db.run(
    `UPDATE project_pm_assignments SET effective_to = ${endExpr}
     WHERE project_id = ? AND role = 'collaborator' AND ${ACTIVE_WINDOW}`,
    ...params,
  );
}

/** Denormalize projects.pm_name/pm_email from active primary user (D-14 display only). */
export async function syncProjectPmDisplay(projectId: number | string) {
  const db = await getDb();
  const primary = await getActivePrimaryAssignment(projectId);
  if (!primary) {
    await db.run(
      `UPDATE projects SET pm_name = '', pm_email = '' WHERE id = ?`,
      Number(projectId),
    );
    return;
  }
  await db.run(
    `UPDATE projects SET pm_name = u.display_name, pm_email = COALESCE(u.email, '')
     FROM users u
     WHERE projects.id = ? AND u.id = ?`,
    Number(projectId),
    primary.user_id,
  );
}

async function withPgTransaction<T>(fn: (pool: Pool) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(pool);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

/** Soft-end active primary and insert replacement in one transaction (D-12, WR-03). */
export async function replaceActivePrimary(
  projectId: number | string,
  userId: number,
): Promise<PmAssignmentRow | undefined> {
  return withPgTransaction(async (pool) => {
    await pool.query(
      `UPDATE project_pm_assignments SET effective_to = CURRENT_DATE
       WHERE project_id = $1 AND role = 'primary'
         AND effective_from <= CURRENT_DATE
         AND (effective_to IS NULL OR effective_to > CURRENT_DATE)`,
      [Number(projectId)],
    );

    const insertRes = await pool.query(
      `INSERT INTO project_pm_assignments (project_id, user_id, role, effective_from, effective_to)
       VALUES ($1, $2, 'primary', CURRENT_DATE, NULL)
       RETURNING *`,
      [Number(projectId), userId],
    );
    return insertRes.rows[0] as PmAssignmentRow | undefined;
  });
}

/** End last primary and cascade collaborators atomically (D-12). */
export async function endPrimaryWithCollaboratorCascade(
  projectId: number | string,
  assignmentId: number | string,
  effectiveTo?: string,
) {
  return withPgTransaction(async (pool) => {
    const endVal = effectiveTo ?? null;
    const endSql = endVal
      ? `UPDATE project_pm_assignments SET effective_to = $1`
      : `UPDATE project_pm_assignments SET effective_to = CURRENT_DATE`;
    const endParams = endVal ? [endVal] : [];

    await pool.query(
      `${endSql}
       WHERE project_id = $${endParams.length + 1} AND role = 'collaborator'
         AND effective_from <= CURRENT_DATE
         AND (effective_to IS NULL OR effective_to > CURRENT_DATE)`,
      [...endParams, Number(projectId)],
    );

    const primaryRes = await pool.query(
      `${endSql}
       WHERE id = $${endParams.length + 1} AND project_id = $${endParams.length + 2}
         AND effective_to IS NULL
       RETURNING *`,
      [...endParams, assignmentId, Number(projectId)],
    );
    return primaryRes.rows[0] as PmAssignmentRow | undefined;
  });
}
