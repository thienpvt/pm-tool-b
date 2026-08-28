/**
 * One-off mapping table tenancy backfill (mapping_tenant_*_v1 flags).
 * Operator replacement for getDb() migrateMappingTableTenancy path.
 */
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';
import { migrateMappingTableTenancy } from '@/lib/db-mapping-tenant';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  try {
    await migrateMappingTableTenancy(pool);
    console.log('backfill-mapping-tenant: complete');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
