import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export async function listCompaniesWithUserCounts(companyId: number | null, isAdmin: boolean) {
  const db = await getKysely();
  let q = db
    .selectFrom('companies as c')
    .leftJoin('users as u', 'u.company_id', 'c.id')
    .select([
      'c.id',
      'c.name',
      'c.headcount_quota',
      'c.created_at',
    ])
    .select((eb) => eb.fn.count<number>('u.id').as('user_count'))
    .groupBy(['c.id', 'c.name', 'c.headcount_quota', 'c.created_at'])
    .orderBy('c.name');

  if (!isAdmin) {
    q = q.where('c.id', '=', companyId);
  }
  return q.execute();
}

export async function createCompany(name: string) {
  const db = await getKysely();
  return db
    .insertInto('companies')
    .values({ name, created_at: new Date() })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateCompany(companyId: number | string, name: string) {
  const db = await getKysely();
  return db
    .updateTable('companies')
    .set({ name })
    .where('id', '=', Number(companyId))
    .execute();
}

export async function deleteCompany(companyId: number | string) {
  const db = await getKysely();
  return db.deleteFrom('companies').where('id', '=', Number(companyId)).execute();
}

export async function listAdminUsers(companyId: number | null, isAdmin: boolean) {
  const db = await getKysely();
  let q = db
    .selectFrom('users as u')
    .leftJoin('companies as c', 'c.id', 'u.company_id')
    .select([
      'u.id',
      'u.username',
      'u.display_name',
      'u.company_id',
      'u.is_admin',
      'u.created_at',
      sql<string | null>`c.name`.as('company_name'),
    ])
    .orderBy('u.is_admin', 'desc')
    .orderBy('u.username');

  if (!isAdmin) {
    q = q.where('u.company_id', '=', companyId);
  }
  return q.execute();
}

export async function createAdminUser(
  username: string,
  passwordHash: string,
  displayName: string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getKysely();
  return db
    .insertInto('users')
    .values({
      username,
      password_hash: passwordHash,
      display_name: displayName,
      company_id: companyId,
      is_admin: isAdmin ? 1 : 0,
      status: 'active',
      created_at: new Date(),
    })
    .returning(['id', 'username', 'display_name', 'company_id', 'is_admin'])
    .executeTakeFirstOrThrow();
}

export async function setAdminUserPassword(userId: number | string, passwordHash: string) {
  const db = await getKysely();
  return db
    .updateTable('users')
    .set({ password_hash: passwordHash })
    .where('id', '=', Number(userId))
    .execute();
}

export async function updateAdminUser(
  userId: number | string,
  displayName: string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getKysely();
  return db
    .updateTable('users')
    .set({
      display_name: displayName,
      company_id: companyId,
      is_admin: isAdmin ? 1 : 0,
    })
    .where('id', '=', Number(userId))
    .execute();
}

export async function deleteAdminUser(userId: number | string) {
  const db = await getKysely();
  return db.deleteFrom('users').where('id', '=', Number(userId)).execute();
}

export async function listDemoRequests() {
  const db = await getKysely();
  return db.selectFrom('demo_requests').selectAll().orderBy('created_at', 'desc').execute();
}

export async function updateDemoRequest(
  requestId: number | string,
  status: string | null,
  notes: string | null,
) {
  const db = await getKysely();
  const patch: { status?: string; notes?: string | null } = {};
  if (status !== null) patch.status = status;
  if (notes !== null) patch.notes = notes;
  if (!Object.keys(patch).length) return;
  return db
    .updateTable('demo_requests')
    .set(patch)
    .where('id', '=', Number(requestId))
    .execute();
}

export async function deleteDemoRequest(requestId: number | string) {
  const db = await getKysely();
  return db.deleteFrom('demo_requests').where('id', '=', Number(requestId)).execute();
}

export async function resourceAudit(companyId: number | null) {
  const db = await getKysely();
  const company = await db
    .selectFrom('companies')
    .select(['id', 'name'])
    .where('id', '=', companyId)
    .executeTakeFirst();

  const inPortfolioNotInTeams = await sql<{ name: string; role: string; email: string }>`
    SELECT pm.name, pm.role, pm.email FROM portfolio_members pm
    WHERE pm.company_id = ${companyId} AND pm.member_type != 'external'
      AND LOWER(TRIM(pm.name)) NOT IN (
        SELECT LOWER(TRIM(tm.name)) FROM team_members tm
        JOIN projects p ON p.id = tm.project_id WHERE p.company_id = ${companyId})
    ORDER BY pm.name
  `.execute(db);

  const inTeamsNotInPortfolio = await sql<{ name: string; role: string; projects: string }>`
    SELECT tm.name, tm.role, STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS projects
    FROM team_members tm JOIN projects p ON p.id = tm.project_id
    WHERE p.company_id = ${companyId}
      AND LOWER(TRIM(tm.name)) NOT IN (
        SELECT LOWER(TRIM(pm.name)) FROM portfolio_members pm
        WHERE pm.company_id = ${companyId} AND pm.member_type != 'external')
    GROUP BY tm.name, tm.role ORDER BY tm.name
  `.execute(db);

  return {
    company,
    inPortfolioNotInTeams: inPortfolioNotInTeams.rows,
    inTeamsNotInPortfolio: inTeamsNotInPortfolio.rows,
  };
}

export async function addMissingTeamMembersToPortfolio(companyId: number | null) {
  const db = await getKysely();
  const missing = await sql<{ name: string; role: string }>`
    SELECT DISTINCT tm.name, tm.role FROM team_members tm
    JOIN projects p ON p.id = tm.project_id
    WHERE p.company_id = ${companyId}
      AND LOWER(TRIM(tm.name)) NOT IN (
        SELECT LOWER(TRIM(pm.name)) FROM portfolio_members pm WHERE pm.company_id = ${companyId})
    ORDER BY tm.name
  `.execute(db);

  for (const member of missing.rows) {
    await db
      .insertInto('portfolio_members')
      .values({
        company_id: companyId,
        role: member.role || '',
        name: member.name.trim(),
        email: '',
        note: '',
        member_type: 'external',
        created_at: new Date(),
      })
      .execute();
  }
  return missing.rows;
}
