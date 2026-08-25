import { getDb } from '@/lib/db';

export type WeeklyReportShellRow = {
  id: number;
  period_id: number;
  project_id: number;
  status: string;
};

export async function insertShell(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: WeeklyReportShellRow[] }> },
  periodId: number,
  projectId: number,
): Promise<WeeklyReportShellRow | undefined> {
  const res = await client.query(
    `INSERT INTO weekly_reports (period_id, project_id)
     VALUES ($1, $2)
     ON CONFLICT (period_id, project_id) DO NOTHING
     RETURNING id, period_id, project_id, status`,
    [periodId, projectId],
  );
  return res.rows[0];
}

export async function getShellsForPeriod(periodId: number): Promise<WeeklyReportShellRow[]> {
  const db = await getDb();
  return db.all<WeeklyReportShellRow>(
    `SELECT id, period_id, project_id, status FROM weekly_reports WHERE period_id = ? ORDER BY project_id`,
    periodId,
  );
}
