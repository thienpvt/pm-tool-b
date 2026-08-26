import { getDb } from '@/lib/db';

export type DashboardSurface = 'portfolio' | 'pm';

export async function getDashboardFilters(userId: number, surface: DashboardSurface) {
  const db = await getDb();
  const row = await db.get<{ filters_json: unknown; updated_at: string | null }>(
    `SELECT filters_json, updated_at FROM dashboard_filter_state
     WHERE user_id = ? AND surface = ?`,
    userId,
    surface,
  );
  if (!row) {
    return { filters: {} as Record<string, unknown>, updated_at: null };
  }
  const filters =
    row.filters_json && typeof row.filters_json === 'object' && !Array.isArray(row.filters_json)
      ? (row.filters_json as Record<string, unknown>)
      : {};
  return { filters, updated_at: row.updated_at };
}

export async function upsertDashboardFilters(
  userId: number,
  surface: DashboardSurface,
  filtersJson: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO dashboard_filter_state (user_id, surface, filters_json)
     VALUES (?, ?, ?::jsonb)
     ON CONFLICT (user_id, surface) DO UPDATE SET
       filters_json = excluded.filters_json,
       updated_at = now()`,
    userId,
    surface,
    JSON.stringify(filtersJson),
  );
}
