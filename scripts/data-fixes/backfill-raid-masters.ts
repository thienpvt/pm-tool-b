/**
 * One-off RAID/milestone code backfill (raid_masters_backfill_v1).
 * Operator re-run when flags are unset; DDL/indexes live in 0001 Part 3.
 */
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';
import { backfillRaidMasters } from '@/lib/db-raid-masters';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    await backfillRaidMasters(pool);
    console.log('backfill-raid-masters: complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
