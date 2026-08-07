import { getDb } from '@/lib/db';

/**
 * The `settings` key/value table.
 *
 * `lib/db.ts` excludes this table from its automatic `RETURNING id` because it has no
 * serial `id` column — so a write here must not read `lastInsertRowid`.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value;
}
