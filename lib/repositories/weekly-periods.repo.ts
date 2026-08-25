import { Pool, type PoolClient } from 'pg';
import { getDb } from '@/lib/db';
import {
  formatPeriodDisplayName,
  isoWeekBoundsUtc,
  materializeDueAtUtc,
} from '@/lib/iso-week';
import { insertShell, type WeeklyReportShellRow } from './weekly-reports.repo';

export type CompanyWeeklyConfigRow = {
  due_weekday: number;
  due_time_utc: string;
};

export type WeeklyPeriodRow = {
  id: number;
  company_id: number;
  iso_week: string;
  start_date: string;
  end_date: string;
  due_at: string;
  display_name: string;
  config_snapshot: {
    due_weekday: number;
    due_time_utc: string;
    obligation_rule_version: number;
  };
  created_by: number | null;
  created_at: string;
};

export type WeeklyPeriodWithShells = WeeklyPeriodRow & {
  shells: WeeklyReportShellRow[];
};

const DEFAULT_CONFIG: CompanyWeeklyConfigRow = {
  due_weekday: 5,
  due_time_utc: '18:00:00',
};

async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

export async function getCompanyWeeklyConfig(
  companyId: number,
): Promise<CompanyWeeklyConfigRow | null> {
  const db = await getDb();
  const row = await db.get<{ due_weekday: number; due_time_utc: string }>(
    `SELECT due_weekday, due_time_utc::text AS due_time_utc
     FROM company_weekly_config WHERE company_id = ?`,
    companyId,
  );
  if (!row) return null;
  return {
    due_weekday: row.due_weekday,
    due_time_utc: row.due_time_utc.slice(0, 8),
  };
}

export async function upsertCompanyWeeklyConfig(
  companyId: number,
  config: { due_weekday: number; due_time_utc: string; updated_by: number },
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO company_weekly_config (company_id, due_weekday, due_time_utc, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       due_weekday = excluded.due_weekday,
       due_time_utc = excluded.due_time_utc,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    companyId,
    config.due_weekday,
    config.due_time_utc,
    config.updated_by,
  );
}

export async function listObligatedProjectIds(
  companyId: number,
  isoWeek: string,
  client?: PoolClient,
): Promise<number[]> {
  const sql = `
    SELECT p.id
    FROM projects p
    WHERE p.company_id = $1
      AND p.weekly_report_enabled = TRUE
      AND p.weekly_report_start_period <= $2
      AND COALESCE(p.stage, '') <> 'L5'
      AND COALESCE(p.status, '') NOT IN ('Completed', 'Paused', 'Cancelled', 'Other')
  `;
  if (client) {
    const res = await client.query<{ id: number }>(sql, [companyId, isoWeek]);
    return res.rows.map((r) => r.id);
  }
  const db = await getDb();
  const rows = await db.all<{ id: number }>(
    sql.replace(/\$(\d+)/g, '?'),
    companyId,
    isoWeek,
  );
  return rows.map((r) => r.id);
}

export async function listWeeklyPeriods(companyId: number): Promise<WeeklyPeriodRow[]> {
  const db = await getDb();
  return db.all<WeeklyPeriodRow>(
    `SELECT id, company_id, iso_week, start_date::text AS start_date, end_date::text AS end_date,
            due_at, display_name, config_snapshot, created_by, created_at
     FROM weekly_periods
     WHERE company_id = ?
     ORDER BY iso_week DESC`,
    companyId,
  );
}

export async function createPeriodWithShells(
  companyId: number,
  isoWeek: string,
  createdBy: number,
): Promise<WeeklyPeriodWithShells> {
  const storedConfig = await getCompanyWeeklyConfig(companyId);
  const config = storedConfig ?? DEFAULT_CONFIG;
  const configSnapshot = {
    due_weekday: config.due_weekday,
    due_time_utc: config.due_time_utc,
    obligation_rule_version: 1,
  };

  const { startDate, endDate } = isoWeekBoundsUtc(isoWeek);
  const dueAt = materializeDueAtUtc(startDate, config.due_weekday, config.due_time_utc);
  const displayName = formatPeriodDisplayName(isoWeek, startDate, endDate);

  return withPgTransaction(async (client) => {
    const periodRes = await client.query<WeeklyPeriodRow>(
      `INSERT INTO weekly_periods
         (company_id, iso_week, start_date, end_date, due_at, display_name, config_snapshot, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       RETURNING id, company_id, iso_week, start_date::text AS start_date, end_date::text AS end_date,
                 due_at, display_name, config_snapshot, created_by, created_at`,
      [
        companyId,
        isoWeek,
        startDate,
        endDate,
        dueAt.toISOString(),
        displayName,
        JSON.stringify(configSnapshot),
        createdBy,
      ],
    );
    const period = periodRes.rows[0];
    const projectIds = await listObligatedProjectIds(companyId, isoWeek, client);
    const shells: WeeklyReportShellRow[] = [];
    for (const projectId of projectIds) {
      const shell = await insertShell(client, period.id, projectId);
      if (shell) shells.push(shell);
    }
    return { ...period, shells };
  });
}
