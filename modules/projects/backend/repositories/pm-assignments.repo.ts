import { sql } from 'kysely';
import { runInTransaction } from '@/lib/db';
import { getKysely } from '@/lib/db/kysely';

export type PmAssignmentRole = 'primary' | 'collaborator';

export type PmAssignmentRow = {
  id: number;
  project_id: number;
  user_id: number;
  role: PmAssignmentRole;
  effective_from: string;
  effective_to: string | null;
};

export type ActivePrimaryAssignment = PmAssignmentRow & {
  display_name: string | null;
};

/** Shared window predicate for access and list (D-13, PMAS-04). */
export async function hasActivePmAssignment(
  projectId: number | string,
  userId: number,
): Promise<boolean> {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_pm_assignments')
    .select(sql<number>`1`.as('ok'))
    .where('project_id', '=', Number(projectId))
    .where('user_id', '=', userId)
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
    .executeTakeFirst();
  return !!row;
}

export async function listPmAssignments(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('project_pm_assignments')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('effective_from', 'desc')
    .orderBy('id', 'desc')
    .execute();
}

export async function getActivePrimaryAssignment(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('project_pm_assignments as a')
    .leftJoin('users as u', 'u.id', 'a.user_id')
    .select([
      'a.id',
      'a.project_id',
      'a.user_id',
      'a.role',
      'a.effective_from',
      'a.effective_to',
      'u.display_name',
    ])
    .where('a.project_id', '=', Number(projectId))
    .where('a.role', '=', 'primary')
    .where(sql<boolean>`a.effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(a.effective_to IS NULL OR a.effective_to > CURRENT_DATE)`)
    .executeTakeFirst();
}

export async function getPmAssignmentById(
  projectId: number | string,
  assignmentId: number | string,
) {
  const db = await getKysely();
  return db
    .selectFrom('project_pm_assignments')
    .selectAll()
    .where('id', '=', Number(assignmentId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function hasOverlappingPmAssignment(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
): Promise<boolean> {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_pm_assignments')
    .select(sql<number>`1`.as('ok'))
    .where('project_id', '=', Number(projectId))
    .where('user_id', '=', userId)
    .where('role', '<>', role)
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
    .executeTakeFirst();
  return !!row;
}

export async function hasActivePmAssignmentForUserRole(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
): Promise<boolean> {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_pm_assignments')
    .select(sql<number>`1`.as('ok'))
    .where('project_id', '=', Number(projectId))
    .where('user_id', '=', userId)
    .where('role', '=', role)
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
    .executeTakeFirst();
  return !!row;
}

export async function insertPmAssignment(
  projectId: number | string,
  userId: number,
  role: PmAssignmentRole,
) {
  const db = await getKysely();
  return db
    .insertInto('project_pm_assignments')
    .values({
      project_id: Number(projectId),
      user_id: userId,
      role,
      effective_from: sql`CURRENT_DATE`,
      effective_to: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function softEndPmAssignment(
  projectId: number | string,
  assignmentId: number | string,
  effectiveTo?: string,
) {
  const db = await getKysely();
  if (effectiveTo === undefined) {
    return db
      .updateTable('project_pm_assignments')
      .set({ effective_to: sql<string>`CURRENT_DATE` })
      .where('id', '=', Number(assignmentId))
      .where('project_id', '=', Number(projectId))
      .where('effective_to', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }
  return db
    .updateTable('project_pm_assignments')
    .set({ effective_to: effectiveTo })
    .where('id', '=', Number(assignmentId))
    .where('project_id', '=', Number(projectId))
    .where('effective_to', 'is', null)
    .returningAll()
    .executeTakeFirst();
}

export async function softEndActivePrimary(
  projectId: number | string,
  effectiveTo?: string,
) {
  const db = await getKysely();
  let q = db
    .updateTable('project_pm_assignments')
    .set({
      effective_to: effectiveTo === undefined ? sql<string>`CURRENT_DATE` : effectiveTo,
    })
    .where('project_id', '=', Number(projectId))
    .where('role', '=', 'primary')
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`);
  await q.execute();
}

export async function softEndActiveCollaborators(
  projectId: number | string,
  effectiveTo?: string,
) {
  const db = await getKysely();
  let q = db
    .updateTable('project_pm_assignments')
    .set({
      effective_to: effectiveTo === undefined ? sql<string>`CURRENT_DATE` : effectiveTo,
    })
    .where('project_id', '=', Number(projectId))
    .where('role', '=', 'collaborator')
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`);
  await q.execute();
}

/** Denormalize projects.pm_name/pm_email from active primary user (D-14 display only). */
export async function syncProjectPmDisplay(projectId: number | string) {
  const db = await getKysely();
  const primary = await getActivePrimaryAssignment(projectId);
  if (!primary) {
    await db
      .updateTable('projects')
      .set({ pm_name: '', pm_email: '' })
      .where('id', '=', Number(projectId))
      .execute();
    return;
  }
  await sql`
    UPDATE projects SET pm_name = u.display_name, pm_email = COALESCE(u.email, '')
    FROM users u
    WHERE projects.id = ${Number(projectId)} AND u.id = ${primary.user_id}
  `.execute(db);
}

/** Soft-end active primary and insert replacement in one transaction (D-12, WR-03). */
export async function replaceActivePrimary(
  projectId: number | string,
  userId: number,
): Promise<PmAssignmentRow | undefined> {
  return runInTransaction(async () => {
    const db = await getKysely();
    await db
      .updateTable('project_pm_assignments')
      .set({ effective_to: sql<string>`CURRENT_DATE` })
      .where('project_id', '=', Number(projectId))
      .where('role', '=', 'primary')
      .where(sql<boolean>`effective_from <= CURRENT_DATE`)
      .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
      .execute();

    return db
      .insertInto('project_pm_assignments')
      .values({
        project_id: Number(projectId),
        user_id: userId,
        role: 'primary',
        effective_from: sql`CURRENT_DATE`,
        effective_to: null,
      })
      .returningAll()
      .executeTakeFirst();
  });
}

/** End last primary and cascade collaborators atomically (D-12). */
export async function endPrimaryWithCollaboratorCascade(
  projectId: number | string,
  assignmentId: number | string,
  effectiveTo?: string,
) {
  return runInTransaction(async () => {
    const db = await getKysely();
    const endValue =
      effectiveTo === undefined ? sql<string>`CURRENT_DATE` : effectiveTo;

    await db
      .updateTable('project_pm_assignments')
      .set({ effective_to: endValue })
      .where('project_id', '=', Number(projectId))
      .where('role', '=', 'collaborator')
      .where(sql<boolean>`effective_from <= CURRENT_DATE`)
      .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
      .execute();

    return db
      .updateTable('project_pm_assignments')
      .set({ effective_to: endValue })
      .where('id', '=', Number(assignmentId))
      .where('project_id', '=', Number(projectId))
      .where('effective_to', 'is', null)
      .returningAll()
      .executeTakeFirst();
  });
}
