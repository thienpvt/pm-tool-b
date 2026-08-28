/**
 * One-off project_pm_assignments backfill (pm_assignment_backfill_v1).
 * Operator replacement for getDb() migrateProjectMaster backfill path.
 */
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';
import { backfillPmAssignments } from '@/lib/db-project-master';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    await backfillPmAssignments(pool);
    console.log('backfill-pm-assignments: complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
