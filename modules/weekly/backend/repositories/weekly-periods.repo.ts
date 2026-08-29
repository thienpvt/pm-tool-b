import type { PoolClient } from 'pg';
import { runInTransaction } from '@/lib/db';
import { getKysely } from '@/lib/db/kysely';
import {
  formatPeriodDisplayName,
  isoWeekBoundsUtc,
  materializeDueAtUtc,
} from '@/lib/iso-week';
import { insertShell, type WeeklyReportShellRow } from '@/modules/weekly/backend/repositories/weekly-reports.repo';

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

type WeeklyPeriodDbRow = {
  id: number;
  company_id: number;
  iso_week: string;
  start_date: string;
  end_date: string;
  due_at: Date | string;
  display_name: string;
  config_snapshot: unknown;
  created_by: number | null;
  created_at: Date | string;
};

function mapWeeklyPeriodRow(row: WeeklyPeriodDbRow): WeeklyPeriodRow {
  return {
    id: row.id,
    company_id: row.company_id,
    iso_week: row.iso_week,
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    due_at: row.due_at instanceof Date ? row.due_at.toISOString() : String(row.due_at),
    display_name: row.display_name,
    config_snapshot: row.config_snapshot as WeeklyPeriodRow['config_snapshot'],
    created_by: row.created_by,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return runInTransaction(fn);
}

export async function getCompanyWeeklyConfig(
  companyId: number,
): Promise<CompanyWeeklyConfigRow | null> {
  const db = await getKysely();
  const row = await db
    .selectFrom('company_weekly_config')
    .select(['due_weekday', 'due_time_utc'])
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  if (!row) return null;
  const dueTime = String(row.due_time_utc);
  return {
    due_weekday: row.due_weekday,
    due_time_utc: dueTime.slice(0, 8),
  };
}

export async function upsertCompanyWeeklyConfig(
  companyId: number,
  config: { due_weekday: number; due_time_utc: string; updated_by: number },
): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('company_weekly_config')
    .values({
      company_id: companyId,
      due_weekday: config.due_weekday,
      due_time_utc: config.due_time_utc,
      updated_by: config.updated_by,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column('company_id').doUpdateSet({
        due_weekday: (eb) => eb.ref('excluded.due_weekday'),
        due_time_utc: (eb) => eb.ref('excluded.due_time_utc'),
        updated_by: (eb) => eb.ref('excluded.updated_by'),
        updated_at: (eb) => eb.ref('excluded.updated_at'),
      }),
    )
    .execute();
}

export async function listObligatedProjectIds(
  companyId: number,
  isoWeek: string,
): Promise<number[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('projects as p')
    .select('p.id')
    .where('p.company_id', '=', companyId)
    .where('p.weekly_report_enabled', '=', true)
    .where('p.weekly_report_start_period', '<=', isoWeek)
    .where((eb) =>
      eb.or([eb('p.stage', 'is', null), eb('p.stage', '<>', 'L5')]),
    )
    .where((eb) =>
      eb.or([
        eb('p.status', 'is', null),
        eb('p.status', 'not in', ['Completed', 'Paused', 'Cancelled', 'Other']),
      ]),
    )
    .execute();
  return rows.map((r) => r.id);
}

export async function listWeeklyPeriods(companyId: number): Promise<WeeklyPeriodRow[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('weekly_periods')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('iso_week', 'desc')
    .execute();
  return rows.map(mapWeeklyPeriodRow);
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
    const db = await getKysely();
    const periodRow = await db
      .insertInto('weekly_periods')
      .values({
        company_id: companyId,
        iso_week: isoWeek,
        start_date: startDate,
        end_date: endDate,
        due_at: dueAt,
        display_name: displayName,
        config_snapshot: JSON.stringify(configSnapshot),
        created_by: createdBy,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    const period = mapWeeklyPeriodRow(periodRow);
    const projectIds = await listObligatedProjectIds(companyId, isoWeek);
    const shells: WeeklyReportShellRow[] = [];
    for (const projectId of projectIds) {
      const shell = await insertShell(client, period.id, projectId);
      if (shell) shells.push(shell);
    }
    return { ...period, shells };
  });
}
