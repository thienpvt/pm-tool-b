import { getDb } from '@/lib/db';
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

export async function listUsers(
  companyId: number,
  filters: UserListFilters = {},
): Promise<UserRow[]> {
  const db = await getDb();
  const conditions = ['u.company_id = ?'];
  const params: unknown[] = [companyId];

  if (filters.status) {
    conditions.push('u.status = ?');
    params.push(filters.status);
  }
  if (filters.role) {
    conditions.push(
      'EXISTS (SELECT 1 FROM user_roles urf WHERE urf.user_id = u.id AND urf.role = ?)',
    );
    params.push(filters.role);
  }
  if (filters.q?.trim()) {
    const pattern = `%${filters.q.trim()}%`;
    conditions.push(
      '(u.username ILIKE ? OR u.display_name ILIKE ? OR COALESCE(u.email, \'\') ILIKE ?)',
    );
    params.push(pattern, pattern, pattern);
  }

  const rows = await db.all<{
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
  }>(
    `SELECT u.id, u.username, u.display_name, COALESCE(u.email, '') as email,
            u.company_id, u.status, u.locked_at, u.locked_by, u.deleted_at, u.created_at,
            c.name as company_name,
            COALESCE(
              ARRAY_AGG(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
              ARRAY[]::text[]
            ) as roles
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY u.id, c.name
     ORDER BY u.username`,
    ...params,
  );

  return rows.map(row => ({ ...row, roles: (row.roles ?? []) as AppRole[] }));
}

export async function findUserById(id: number | string): Promise<UserRow | undefined> {
  const db = await getDb();
  const row = await db.get<{
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
  }>(
    `SELECT u.id, u.username, u.display_name, COALESCE(u.email, '') as email,
            u.company_id, u.status, u.locked_at, u.locked_by, u.deleted_at, u.created_at,
            c.name as company_name,
            COALESCE(
              ARRAY_AGG(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
              ARRAY[]::text[]
            ) as roles
     FROM users u
     LEFT JOIN companies c ON u.company_id = c.id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id, c.name`,
    id,
  );
  if (!row) return undefined;
  return { ...row, roles: (row.roles ?? []) as AppRole[] };
}

export async function findUserByUsername(username: string): Promise<{ id: number; username: string } | undefined> {
  const db = await getDb();
  return db.get('SELECT id, username FROM users WHERE username = ?', username);
}

export async function findUserByEmailLower(email: string): Promise<{ id: number; email: string } | undefined> {
  const db = await getDb();
  return db.get(
    'SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) AND email IS NOT NULL AND email <> \'\'',
    email,
  );
}

export async function insertUser(input: InsertUserInput): Promise<UserRow> {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO users (username, password_hash, display_name, email, company_id, status, is_admin)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    input.username,
    input.password_hash,
    input.display_name,
    input.email,
    input.company_id,
    input.status,
  );
  const created = await findUserById(r.lastInsertRowid);
  if (!created) throw new Error('insertUser: row missing after insert');
  return created;
}

export async function updateUserRow(
  userId: number | string,
  patch: Partial<Record<UserColumn, string>>,
): Promise<void> {
  const entries = Object.entries(patch).filter(([k, v]) => isUserColumn(k) && v !== undefined);
  if (!entries.length) return;
  const db = await getDb();
  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  await db.run(
    `UPDATE users SET ${setClause} WHERE id = ?`,
    ...entries.map(([, v]) => v),
    userId,
  );
}

export async function replaceUserRoles(
  userId: number | string,
  companyId: number,
  roles: AppRole[],
): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM user_roles WHERE user_id = ?', userId);
  for (const role of roles) {
    await db.run(
      'INSERT INTO user_roles (user_id, role, company_id) VALUES (?, ?, ?)',
      userId,
      role,
      companyId,
    );
  }
}

export async function lockUserRow(
  userId: number | string,
  lockedBy: number,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE users SET status = 'locked', locked_at = now(), locked_by = ? WHERE id = ?`,
    lockedBy,
    userId,
  );
}

export async function unlockUserRow(userId: number | string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE users SET status = 'active', locked_at = NULL, locked_by = NULL WHERE id = ?`,
    userId,
  );
}

export async function deactivateUserRow(userId: number | string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE users SET status = 'inactive', deleted_at = now() WHERE id = ?`,
    userId,
  );
}

export async function deleteSessionsForUser(userId: number | string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM sessions WHERE user_id = ?', userId);
}
