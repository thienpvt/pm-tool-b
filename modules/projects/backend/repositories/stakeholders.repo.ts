import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export type StakeholderRole =
  | 'sponsor'
  | 'psc_chair'
  | 'psc_member'
  | 'project_director'
  | 'key_stakeholder';

export async function listStakeholders(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('project_stakeholders')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('effective_from', 'desc')
    .orderBy('id', 'desc')
    .execute();
}

export async function hasActiveStakeholderForRole(
  projectId: number | string,
  role: StakeholderRole,
) {
  const db = await getKysely();
  const row = await db
    .selectFrom('project_stakeholders')
    .select(sql<number>`1`.as('ok'))
    .where('project_id', '=', Number(projectId))
    .where('stakeholder_role', '=', role)
    .where(sql<boolean>`effective_from <= CURRENT_DATE`)
    .where(sql<boolean>`(effective_to IS NULL OR effective_to > CURRENT_DATE)`)
    .executeTakeFirst();
  return !!row;
}

export async function getStakeholder(projectId: number | string, stakeholderId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('project_stakeholders')
    .selectAll()
    .where('id', '=', Number(stakeholderId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
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
  const db = await getKysely();
  return db
    .insertInto('project_stakeholders')
    .values({
      project_id: Number(projectId),
      stakeholder_role: input.stakeholder_role,
      user_id: input.user_id ?? null,
      external_name: input.external_name ?? null,
      external_email: input.external_email ?? null,
      effective_from: sql`CURRENT_DATE`,
      effective_to: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function endStakeholder(
  projectId: number | string,
  stakeholderId: number | string,
  effectiveTo?: string,
) {
  const db = await getKysely();
  if (effectiveTo === undefined) {
    return db
      .updateTable('project_stakeholders')
      .set({ effective_to: sql<string>`CURRENT_DATE` })
      .where('id', '=', Number(stakeholderId))
      .where('project_id', '=', Number(projectId))
      .where('effective_to', 'is', null)
      .returningAll()
      .executeTakeFirst();
  }
  return db
    .updateTable('project_stakeholders')
    .set({ effective_to: effectiveTo })
    .where('id', '=', Number(stakeholderId))
    .where('project_id', '=', Number(projectId))
    .where('effective_to', 'is', null)
    .returningAll()
    .executeTakeFirst();
}
