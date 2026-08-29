import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export type DashboardSurface = 'portfolio' | 'pm';

export async function getDashboardFilters(userId: number, surface: DashboardSurface) {
  const db = await getKysely();
  const row = await db
    .selectFrom('dashboard_filter_state')
    .select(['filters_json', 'updated_at'])
    .where('user_id', '=', userId)
    .where('surface', '=', surface)
    .executeTakeFirst();
  if (!row) {
    return { filters: {} as Record<string, unknown>, updated_at: null };
  }
  const raw = row.filters_json;
  const filters =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const updatedAt = row.updated_at;
  return {
    filters,
    updated_at: updatedAt == null ? null : updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
  };
}

export async function upsertDashboardFilters(
  userId: number,
  surface: DashboardSurface,
  filtersJson: Record<string, unknown>,
): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('dashboard_filter_state')
    .values({
      user_id: userId,
      surface,
      filters_json: JSON.stringify(filtersJson),
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'surface']).doUpdateSet({
        filters_json: (eb) => eb.ref('excluded.filters_json'),
        updated_at: sql`now()`,
      }),
    )
    .execute();
}
