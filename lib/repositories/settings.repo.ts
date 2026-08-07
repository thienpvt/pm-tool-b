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

/** Every key/value pair. The route masks secrets before returning them. */
export async function listSettings() {
  const db = await getDb();
  return db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
}

/**
 * Upsert one key. No `RETURNING id` is available on this table (see above), so this
 * returns nothing meaningful — callers must not read `lastInsertRowid`.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key, String(value),
  );
}
