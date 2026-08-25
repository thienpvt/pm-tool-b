import type { Pool } from 'pg';

export const PROJECT_MASTER_DDL_FLAG = 'project_master_ddl_v1';

/** Hermetic unit-test assertions against the DDL strings (D-01, D-11, D-16, D-09). */
export const PROJECT_MASTER_DDL = [
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_code TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS portfolio_year INTEGER`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS status_reason TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS progress_pct INTEGER DEFAULT 0`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS weekly_report_start_period TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_end TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS adjusted_end TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS classification TEXT`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance TEXT`,
  `
    CREATE TABLE IF NOT EXISTS project_pm_assignments (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('primary','collaborator')),
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS project_stakeholders (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      stakeholder_role TEXT NOT NULL CHECK (stakeholder_role IN ('sponsor','psc_chair','psc_member','project_director','key_stakeholder')),
      user_id INTEGER REFERENCES users(id),
      external_name TEXT,
      external_email TEXT,
      effective_from DATE NOT NULL,
      effective_to DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS projects_company_code_lower_unique
    ON projects (company_id, LOWER(project_code))
    WHERE project_code IS NOT NULL AND TRIM(project_code) <> ''
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

async function migrateProjectMasterDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, PROJECT_MASTER_DDL_FLAG)) return;

  for (const sql of PROJECT_MASTER_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, PROJECT_MASTER_DDL_FLAG);
}

/**
 * Idempotent project master DDL in the getDb migrate loop (D-01, D-11, D-16, D-19).
 * Assignment backfill (D-14) is owned by plan 11-03.
 */
export async function migrateProjectMaster(pool: Pool): Promise<void> {
  try {
    await migrateProjectMasterDdl(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
