import { getKysely } from '@/lib/db/kysely';

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
  const db = await getKysely();
  const row = await db
    .insertInto('weekly_export_logs')
    .values({
      period_id: input.period_id,
      company_id: input.company_id,
      exported_by: input.exported_by,
      format: input.format,
      data_version: input.data_version,
      project_ids: JSON.stringify(input.project_ids),
      period_display_name: input.period_display_name,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return Number(row.id);
}
