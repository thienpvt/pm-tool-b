import type { Pool } from 'pg';

const DDL_FLAG = 'users_roles_audit_ddl_v1';
export const ROLES_BACKFILL_FLAG = 'roles_backfill_v1';

/** Hermetic unit-test assertions and 0001 Part 3 source (D-03, D-08). */
export const ROLES_AUDIT_DDL = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `
    DO $$ BEGIN
      ALTER TABLE users ADD CONSTRAINT users_status_check
        CHECK (status IN ('active', 'inactive', 'locked'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `,
  `
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('cpmo', 'pm', 'viewer')),
      company_id INTEGER REFERENCES companies(id),
      PRIMARY KEY (user_id, role)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id),
      actor_id INTEGER REFERENCES users(id),
      entity_type TEXT,
      entity_id TEXT,
      action TEXT,
      before JSONB,
      after JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
    ON users (LOWER(email))
    WHERE email IS NOT NULL AND email <> ''
  `,
];

async function settingsFlagExists(pool: Pool, key: string): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 FROM settings WHERE key = $1 LIMIT 1', [key]);
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

async function writeSettingsFlag(pool: Pool, key: string): Promise<void> {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [key, new Date().toISOString()],
  );
}

async function migrateRolesDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, DDL_FLAG)) return;

  for (const sql of ROLES_AUDIT_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, DDL_FLAG);
}

/**
 * Backfill user_roles from break-glass flag (D-02). Skips null company_id users.
 * Idempotent via NOT EXISTS + ON CONFLICT and settings flag roles_backfill_v1.
 */
export async function backfillUserRoles(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, ROLES_BACKFILL_FLAG)) return;

  await pool.query(`
    INSERT INTO user_roles (user_id, role, company_id)
    SELECT u.id,
           CASE WHEN u.is_admin = 1 THEN 'cpmo' ELSE 'pm' END,
           u.company_id
    FROM users u
    WHERE u.company_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
    ON CONFLICT (user_id, role) DO NOTHING
  `);

  await writeSettingsFlag(pool, ROLES_BACKFILL_FLAG);
}

/**
 * Idempotent users/roles/audit DDL + role backfill in the getDb migrate loop (D-02, D-22).
 */
export async function migrateUsersRolesAndAudit(pool: Pool): Promise<void> {
  try {
    await migrateRolesDdl(pool);
    await backfillUserRoles(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
