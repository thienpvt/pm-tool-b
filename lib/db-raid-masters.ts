import type { Pool } from 'pg';

export const RAID_MASTERS_DDL_FLAG = 'raid_masters_ddl_v1';
export const RAID_MASTERS_BACKFILL_FLAG = 'raid_masters_backfill_v1';
export const RAID_MASTERS_INDEX_FLAG = 'raid_masters_index_v1';

/** Hermetic unit-test assertions against the DDL strings (D-01, D-05, D-06, D-10). */
export const RAID_MASTERS_DDL = [
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned'`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS plan_end TEXT`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS adjusted_end TEXT`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`,
  `ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id)`,
  `ALTER TABLE risks ADD COLUMN IF NOT EXISTS code TEXT`,
  `ALTER TABLE risks ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS code TEXT`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS technology_council BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE issues ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`,
  `
    CREATE TABLE IF NOT EXISTS raid_due_date_history (
      id BIGSERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL CHECK (entity_type IN ('risk','issue')),
      entity_id TEXT NOT NULL,
      old_due TEXT,
      new_due TEXT,
      changed_at TIMESTAMPTZ DEFAULT now(),
      changed_by INTEGER REFERENCES users(id)
    )
  `,
];

/** Partial unique indexes — created only after backfill (Pitfall 4). */
export const RAID_MASTERS_INDEX_DDL = [
  `
    CREATE UNIQUE INDEX IF NOT EXISTS risks_project_code_lower_unique
    ON risks (project_id, LOWER(code))
    WHERE code IS NOT NULL AND TRIM(code) <> ''
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS issues_project_code_lower_unique
    ON issues (project_id, LOWER(code))
    WHERE code IS NOT NULL AND TRIM(code) <> ''
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

async function migrateRaidMastersDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, RAID_MASTERS_DDL_FLAG)) return;

  for (const sql of RAID_MASTERS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, RAID_MASTERS_DDL_FLAG);
}

async function dedupeRaidCodes(
  pool: Pool,
  table: 'risks' | 'issues',
): Promise<void> {
  const dupes = await pool.query<{ project_id: number; lc: string; ids: number[] }>(`
    SELECT project_id, LOWER(code) AS lc, array_agg(id ORDER BY id) AS ids
    FROM ${table}
    WHERE code IS NOT NULL AND TRIM(code) <> ''
    GROUP BY project_id, LOWER(code)
    HAVING COUNT(*) > 1
  `);
  for (const row of dupes.rows) {
    const [, ...rest] = row.ids;
    for (let i = 0; i < rest.length; i++) {
      await pool.query(
        `UPDATE ${table} SET code = code || $1 WHERE id = $2`,
        [`-${i + 2}`, rest[i]],
      );
    }
  }
}

async function backfillRaidMasters(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, RAID_MASTERS_BACKFILL_FLAG)) return;

  await pool.query(`
    UPDATE milestones SET plan_end = end_date
    WHERE plan_end IS NULL AND end_date IS NOT NULL
  `);
  await pool.query(`
    UPDATE risks SET code = LOWER(TRIM(risk_id))
    WHERE code IS NULL AND risk_id IS NOT NULL AND TRIM(risk_id) <> ''
  `);
  await pool.query(`
    UPDATE issues SET code = LOWER(TRIM(issue_id))
    WHERE code IS NULL AND issue_id IS NOT NULL AND TRIM(issue_id) <> ''
  `);

  await dedupeRaidCodes(pool, 'risks');
  await dedupeRaidCodes(pool, 'issues');

  await writeSettingsFlag(pool, RAID_MASTERS_BACKFILL_FLAG);
}

async function migrateRaidMastersIndexes(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, RAID_MASTERS_INDEX_FLAG)) return;

  for (const sql of RAID_MASTERS_INDEX_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, RAID_MASTERS_INDEX_FLAG);
}

/**
 * Idempotent RAID / milestone master DDL in the getDb migrate loop (D-01, D-10, D-12).
 * Backfill runs before unique indexes so duplicate legacy codes can be suffixed (Pitfall 4).
 */
export async function migrateRaidMasters(pool: Pool): Promise<void> {
  try {
    await migrateRaidMastersDdl(pool);
    await backfillRaidMasters(pool);
    await migrateRaidMastersIndexes(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
