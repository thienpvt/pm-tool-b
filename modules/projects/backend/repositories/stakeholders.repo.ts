import { getDb } from '@/lib/db';

export type StakeholderRole =
  | 'sponsor'
  | 'psc_chair'
  | 'psc_member'
  | 'project_director'
  | 'key_stakeholder';

export async function listStakeholders(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM project_stakeholders WHERE project_id = ? ORDER BY effective_from DESC, id DESC`,
    Number(projectId),
  );
}

export async function hasActiveStakeholderForRole(
  projectId: number | string,
  role: StakeholderRole,
) {
  const db = await getDb();
  const row = await db.get<{ ok: number }>(
    `SELECT 1 AS ok FROM project_stakeholders
     WHERE project_id = ? AND stakeholder_role = ?
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
     LIMIT 1`,
    Number(projectId),
    role,
  );
  return !!row;
}

export async function getStakeholder(projectId: number | string, stakeholderId: number | string) {
  const db = await getDb();
  return db.get(
    'SELECT * FROM project_stakeholders WHERE id = ? AND project_id = ?',
    stakeholderId,
    Number(projectId),
  );
}

export type InsertStakeholderInput = {
  stakeholder_role: StakeholderRole;
  user_id?: number | null;
  external_name?: string | null;
  external_email?: string | null;
};

export async function insertStakeholder(
  projectId: number | string,
  input: InsertStakeholderInput,
) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO project_stakeholders
       (project_id, stakeholder_role, user_id, external_name, external_email, effective_from, effective_to)
     VALUES (?, ?, ?, ?, ?, CURRENT_DATE, NULL)`,
    Number(projectId),
    input.stakeholder_role,
    input.user_id ?? null,
    input.external_name ?? null,
    input.external_email ?? null,
  );
  return db.get('SELECT * FROM project_stakeholders WHERE id = ?', r.lastInsertRowid);
}

export async function endStakeholder(
  projectId: number | string,
  stakeholderId: number | string,
  effectiveTo?: string,
) {
  const db = await getDb();
  if (effectiveTo === undefined) {
    return db.get(
      `UPDATE project_stakeholders SET effective_to = CURRENT_DATE
       WHERE id = ? AND project_id = ? AND effective_to IS NULL
       RETURNING *`,
      stakeholderId,
      Number(projectId),
    );
  }
  return db.get(
    `UPDATE project_stakeholders SET effective_to = ?
     WHERE id = ? AND project_id = ? AND effective_to IS NULL
     RETURNING *`,
    effectiveTo,
    stakeholderId,
    Number(projectId),
  );
}
