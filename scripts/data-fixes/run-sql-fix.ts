/**
 * Shared runner for one-off data-fix scripts under `scripts/data-fixes/`.
 *
 * Operator-run only: requires DATABASE_URL (same contract as `getDb()`), runs a
 * fixed multi-statement SQL string via a single `pool.query` (no splitting on
 * `;`), prints the affected row count, and closes the pool. Never imported by
 * the app — no app-boot path reaches these scripts.
 *
 *   npx tsx scripts/data-fixes/NN-name.ts
 */
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';

export interface Fix {
  name: string;
  sql: string;
}

export async function runFix({ name, sql }: Fix): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    const result = await pool.query(sql);
    console.log(`${name}: ${result.rowCount ?? 0} rows affected`);
  } finally {
    await pool.end();
  }
}
