import type { Pool } from 'pg';

export const DASHBOARDS_DDL_FLAG = 'dashboards_ddl_v1';

/** Hermetic unit-test assertions against the DDL strings (D-07). */
export const DASHBOARDS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS dashboard_filter_state (
      user_id INTEGER NOT NULL REFERENCES users(id),
      surface TEXT NOT NULL CHECK (surface IN ('portfolio', 'pm')),
      filters_json JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, surface)
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

async function migrateDashboardsDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, DASHBOARDS_DDL_FLAG)) return;

  for (const sql of DASHBOARDS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, DASHBOARDS_DDL_FLAG);
}

/** Idempotent dashboard_filter_state DDL in the getDb migrate loop (D-07). */
export async function migrateDashboards(pool: Pool): Promise<void> {
  try {
    await migrateDashboardsDdl(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
