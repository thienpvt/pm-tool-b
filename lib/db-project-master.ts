import type { Pool } from 'pg';

export const PROJECT_MASTER_DDL_FLAG = 'project_master_ddl_v1';
export const PM_ASSIGNMENT_BACKFILL_FLAG = 'pm_assignment_backfill_v1';
export const PROJECT_MASTER_CONSTRAINTS_FLAG = 'project_master_constraints_v1';

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

/** Partial unique indexes for assignment overlap and stakeholder singleton (D-12, D-18, WR-01, WR-03, WR-04). */
export const PROJECT_MASTER_CONSTRAINTS_DDL = [
  `
    CREATE UNIQUE INDEX IF NOT EXISTS project_pm_assignments_one_open_primary_unique
    ON project_pm_assignments (project_id)
    WHERE role = 'primary' AND effective_to IS NULL
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS project_pm_assignments_open_user_role_unique
    ON project_pm_assignments (project_id, user_id, role)
    WHERE effective_to IS NULL
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS project_stakeholders_singleton_open_unique
    ON project_stakeholders (project_id, stakeholder_role)
    WHERE effective_to IS NULL
      AND stakeholder_role IN ('sponsor', 'psc_chair', 'project_director')
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

async function migrateProjectMasterConstraints(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, PROJECT_MASTER_CONSTRAINTS_FLAG)) return;

  for (const sql of PROJECT_MASTER_CONSTRAINTS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, PROJECT_MASTER_CONSTRAINTS_FLAG);
}

/** Phase 10 D-14 email-first then name match; at most one open primary per project (D-14). */
export async function backfillPmAssignments(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, PM_ASSIGNMENT_BACKFILL_FLAG)) return;

  await pool.query(`
    INSERT INTO project_pm_assignments (project_id, user_id, role, effective_from, effective_to)
    SELECT DISTINCT ON (p.id) p.id, u.id, 'primary', CURRENT_DATE, NULL
    FROM projects p
    JOIN users u ON u.company_id = p.company_id
    WHERE (
      TRIM(COALESCE(p.pm_email, '')) <> ''
      OR TRIM(COALESCE(p.pm_name, '')) <> ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM project_pm_assignments a WHERE a.project_id = p.id
    )
    AND (
      (
        TRIM(COALESCE(p.pm_email, '')) <> ''
        AND LOWER(u.email) = LOWER(TRIM(p.pm_email))
      )
      OR (
        TRIM(COALESCE(p.pm_email, '')) = ''
        AND TRIM(COALESCE(p.pm_name, '')) <> ''
        AND (
          LOWER(TRIM(u.display_name)) = LOWER(TRIM(p.pm_name))
          OR LOWER(TRIM(u.username)) = LOWER(TRIM(p.pm_name))
        )
      )
    )
    ORDER BY p.id, u.id
  `);

  await writeSettingsFlag(pool, PM_ASSIGNMENT_BACKFILL_FLAG);
}

/**
 * Idempotent project master DDL in the getDb migrate loop (D-01, D-11, D-16, D-19).
 * Assignment backfill (D-14) runs after DDL via pm_assignment_backfill_v1.
 */
export async function migrateProjectMaster(pool: Pool): Promise<void> {
  try {
    await migrateProjectMasterDdl(pool);
    await migrateProjectMasterConstraints(pool);
    await backfillPmAssignments(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
