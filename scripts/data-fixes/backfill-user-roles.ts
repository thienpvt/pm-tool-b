/**
 * One-off user_roles backfill from break-glass flag (roles_backfill_v1).
 * Operator replacement for getDb() migrateUsersRolesAndAudit backfill path.
 */
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';
import { backfillUserRoles } from '@/lib/db-roles';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    await backfillUserRoles(pool);
    console.log('backfill-user-roles: complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
