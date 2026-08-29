import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';
import type { AppRole, UserStatus } from '@/lib/services/access';

export type UserListFilters = {
  q?: string;
  status?: UserStatus;
  role?: AppRole;
};

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  company_id: number;
  status: UserStatus;
  roles: AppRole[];
  locked_at?: string | null;
  locked_by?: number | null;
  deleted_at?: string | null;
  created_at?: string;
  company_name?: string | null;
};

export type InsertUserInput = {
  username: string;
  password_hash: string;
  display_name: string;
  email: string;
  company_id: number;
  status: UserStatus;
};

const USER_COLUMNS = ['display_name', 'email', 'status', 'password_hash'] as const;
type UserColumn = (typeof USER_COLUMNS)[number];

function isUserColumn(key: string): key is UserColumn {
  return (USER_COLUMNS as readonly string[]).includes(key);
}

type UserQueryRow = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  company_id: number;
  status: UserStatus;
  locked_at: string | null;
  locked_by: number | null;
  deleted_at: string | null;
  created_at: string;
  company_name: string | null;
  roles: AppRole[] | null;
};

const USER_SELECT_BODY = sql`
  SELECT u.id, u.username, u.display_name, COALESCE(u.email, '') as email,
         u.company_id, u.status, u.locked_at, u.locked_by, u.deleted_at, u.created_at,
         c.name as company_name,
         COALESCE(
           ARRAY_AGG(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
           ARRAY[]::text[]
         ) as roles
  FROM users u
  LEFT JOIN companies c ON u.company_id = c.id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
`;

function mapUserRow(row: UserQueryRow): UserRow {
  return { ...row, roles: (row.roles ?? []) as AppRole[] };
}

export async function listUsers(
  companyId: number,
  filters: UserListFilters = {},
): Promise<UserRow[]> {
  const db = await getKysely();
  const conditions = [sql`u.company_id = ${companyId}`];

  if (filters.status) {
    conditions.push(sql`u.status = ${filters.status}`);
  }
  if (filters.role) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM user_roles urf WHERE urf.user_id = u.id AND urf.role = ${filters.role})`,
    );
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(
      sql`(u.username ILIKE ${pattern} OR u.display_name ILIKE ${pattern} OR COALESCE(u.email, '') ILIKE ${pattern})`,
    );
  }

  const whereClause = sql.join(conditions, sql` AND `);
  const result = await sql<UserQueryRow>`
    ${USER_SELECT_BODY}
    WHERE ${whereClause}
    GROUP BY u.id, c.name
    ORDER BY u.username
  `.execute(db);

  return result.rows.map(mapUserRow);
}

export async function findUserById(id: number | string): Promise<UserRow | undefined> {
  const db = await getKysely();
  const result = await sql<UserQueryRow>`
    ${USER_SELECT_BODY}
    WHERE u.id = ${Number(id)}
    GROUP BY u.id, c.name
  `.execute(db);
  const row = result.rows[0];
  if (!row) return undefined;
  return mapUserRow(row);
}

export async function findUserByUsername(username: string): Promise<{ id: number; username: string } | undefined> {
  const db = await getKysely();
  return db
    .selectFrom('users')
    .select(['id', 'username'])
    .where('username', '=', username)
    .executeTakeFirst();
}

export async function findUserByEmailLower(email: string): Promise<{ id: number; email: string } | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('users')
    .select(['id', 'email'])
    .where(sql`LOWER(email)`, '=', email.toLowerCase())
    .where('email', 'is not', null)
    .where('email', '<>', '')
    .executeTakeFirst();
  if (!row?.email) return undefined;
  return { id: row.id, email: row.email };
}

export async function insertUser(input: InsertUserInput): Promise<UserRow> {
  const db = await getKysely();
  const row = await db
    .insertInto('users')
    .values({
      username: input.username,
      password_hash: input.password_hash,
      display_name: input.display_name,
      email: input.email,
      company_id: input.company_id,
      status: input.status,
      is_admin: 0,
      created_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  const created = await findUserById(Number(row.id));
  if (!created) throw new Error('insertUser: row missing after insert');
  return created;
}

export async function updateUserRow(
  userId: number | string,
  patch: Partial<Record<UserColumn, string>>,
): Promise<void> {
  const entries = Object.entries(patch).filter(([k, v]) => isUserColumn(k) && v !== undefined);
  if (!entries.length) return;
  const db = await getKysely();
  const setValues = Object.fromEntries(entries) as Partial<Record<UserColumn, string>>;
  await db
    .updateTable('users')
    .set(setValues)
    .where('id', '=', Number(userId))
    .execute();
}

export async function replaceUserRoles(
  userId: number | string,
  companyId: number,
  roles: AppRole[],
): Promise<void> {
  const db = await getKysely();
  await db.deleteFrom('user_roles').where('user_id', '=', Number(userId)).execute();
  for (const role of roles) {
    await db
      .insertInto('user_roles')
      .values({
        user_id: Number(userId),
        role,
        company_id: companyId,
      })
      .execute();
  }
}

export async function lockUserRow(
  userId: number | string,
  lockedBy: number,
): Promise<void> {
  const db = await getKysely();
  await db
    .updateTable('users')
    .set({
      status: 'locked',
      locked_at: sql`now()`,
      locked_by: lockedBy,
    })
    .where('id', '=', Number(userId))
    .execute();
}

export async function unlockUserRow(userId: number | string): Promise<void> {
  const db = await getKysely();
  await db
    .updateTable('users')
    .set({
      status: 'active',
      locked_at: null,
      locked_by: null,
    })
    .where('id', '=', Number(userId))
    .execute();
}

export async function deactivateUserRow(userId: number | string): Promise<void> {
  const db = await getKysely();
  await db
    .updateTable('users')
    .set({
      status: 'inactive',
      deleted_at: sql`now()`,
    })
    .where('id', '=', Number(userId))
    .execute();
}

export async function deleteSessionsForUser(userId: number | string): Promise<void> {
  const db = await getKysely();
  await db.deleteFrom('sessions').where('user_id', '=', Number(userId)).execute();
}
