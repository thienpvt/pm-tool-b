import { getKysely } from '@/lib/db/kysely';

/**
 * The `settings` key/value table.
 *
 * `lib/db.ts` excludes this table from its automatic `RETURNING id` because it has no
 * serial `id` column, so writes do not return a generated key.
 */
export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('settings')
    .select('value')
    .where('key', '=', key)
    .executeTakeFirst();
  return row?.value;
}

/** Every key/value pair. The route masks secrets before returning them. */
export async function listSettings() {
  const db = await getKysely();
  return db.selectFrom('settings').select(['key', 'value']).execute();
}

/**
 * Upsert one key. No `RETURNING id` is available on this table (see above), so this
 * returns nothing meaningful — callers must not expect a generated key.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('settings')
    .values({ key, value: String(value) })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value: String(value) }))
    .execute();
}
