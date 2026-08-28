import { getDb } from '@/lib/db';

export type WeeklyExportLogInput = {
  period_id: number;
  company_id: number;
  exported_by: number;
  format: string;
  data_version: number;
  project_ids: number[];
  period_display_name: string;
};

/** Append-only INSERT into weekly_export_logs (D-09). No update or delete helpers. */
export async function insertWeeklyExportLog(input: WeeklyExportLogInput): Promise<number> {
  const db = await getDb();
  const result = await db.run(
    `INSERT INTO weekly_export_logs (period_id, company_id, exported_by, format, data_version, project_ids, period_display_name)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)`,
    input.period_id,
    input.company_id,
    input.exported_by,
    input.format,
    input.data_version,
    JSON.stringify(input.project_ids),
    input.period_display_name,
  );
  return Number(result.lastInsertRowid);
}
