import type { Pool } from 'pg';

export const WEEKLY_REPORTS_DDL_FLAG = 'weekly_reports_ddl_v1';
export const WEEKLY_REPORTS_INDEX_FLAG = 'weekly_reports_index_v1';

/** Hermetic unit-test assertions against the DDL strings (D-02, D-04, D-08, D-14). */
export const WEEKLY_REPORTS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS company_weekly_config (
      company_id INTEGER PRIMARY KEY REFERENCES companies(id),
      due_weekday SMALLINT NOT NULL DEFAULT 5,
      due_time_utc TIME NOT NULL DEFAULT '18:00:00',
      updated_at TIMESTAMPTZ DEFAULT now(),
      updated_by INTEGER REFERENCES users(id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS weekly_periods (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      iso_week TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      due_at TIMESTAMPTZ NOT NULL,
      display_name TEXT NOT NULL,
      config_snapshot JSONB NOT NULL,
      closed_at TIMESTAMPTZ,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (company_id, iso_week)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS weekly_reports (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'not_submitted',
      first_submitted_at TIMESTAMPTZ,
      first_lateness TEXT,
      latest_version INTEGER NOT NULL DEFAULT 0,
      correction_open BOOLEAN NOT NULL DEFAULT FALSE,
      highlights TEXT,
      completed_work TEXT,
      next_week_goals TEXT,
      nearest_milestone TEXT,
      nearest_milestone_id INTEGER,
      raid_dependency TEXT,
      leadership_support TEXT,
      this_week_rag TEXT,
      prev_week_rag TEXT,
      draft_raid_json JSONB
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS weekly_report_versions (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES weekly_reports(id),
      version INTEGER NOT NULL,
      snapshot JSONB NOT NULL,
      submitted_at TIMESTAMPTZ,
      submitted_by INTEGER REFERENCES users(id),
      rag TEXT,
      progress_pct INTEGER
    )
  `,
];

export const WEEKLY_REPORTS_INDEX_DDL = [
  `CREATE UNIQUE INDEX IF NOT EXISTS weekly_reports_period_project_unique
     ON weekly_reports (period_id, project_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS weekly_report_versions_report_version_unique
     ON weekly_report_versions (report_id, version)`,
];

export const WEEKLY_EXPORT_LOGS_DDL_FLAG = 'weekly_export_logs_ddl_v1';

export const WEEKLY_EXPORT_LOGS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS weekly_export_logs (
      id SERIAL PRIMARY KEY,
      period_id INTEGER NOT NULL REFERENCES weekly_periods(id),
      company_id INTEGER NOT NULL REFERENCES companies(id),
      exported_by INTEGER NOT NULL REFERENCES users(id),
      exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      format TEXT NOT NULL,
      data_version INTEGER NOT NULL,
      project_ids JSONB NOT NULL,
      period_display_name TEXT NOT NULL
    )
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

async function migrateWeeklyReportsDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, WEEKLY_REPORTS_DDL_FLAG)) return;

  for (const sql of WEEKLY_REPORTS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, WEEKLY_REPORTS_DDL_FLAG);
}

async function migrateWeeklyReportsIndexes(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, WEEKLY_REPORTS_INDEX_FLAG)) return;

  for (const sql of WEEKLY_REPORTS_INDEX_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, WEEKLY_REPORTS_INDEX_FLAG);
}

/** Idempotent weekly export log DDL (D-09, D-10). */
export async function migrateWeeklyExportLogs(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, WEEKLY_EXPORT_LOGS_DDL_FLAG)) return;

  for (const sql of WEEKLY_EXPORT_LOGS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, WEEKLY_EXPORT_LOGS_DDL_FLAG);
}

/** Idempotent weekly report DDL in the getDb migrate loop (D-02, D-14). */
export async function migrateWeeklyReports(pool: Pool): Promise<void> {
  try {
    await migrateWeeklyReportsDdl(pool);
    await migrateWeeklyReportsIndexes(pool);
    await migrateWeeklyExportLogs(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
