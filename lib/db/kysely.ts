import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getPool } from '@/lib/db';
import { txKyselyTarget } from '@/lib/db-tx';

let _kysely: Kysely<Database> | null = null;

export async function getKysely(): Promise<Kysely<Database>> {
  const tx = txKyselyTarget();
  if (tx) return tx;
  if (_kysely) return _kysely;
  const pool = await getPool();
  _kysely = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return _kysely;
}
