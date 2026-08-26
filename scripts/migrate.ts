/**
 * Migration CLI — the ONLY way schema changes are applied to a database.
 *
 *   npm run migrate                apply pending migrations, then seed
 *   npm run migrate -- --check     print pending, exit 1 when any are pending
 *
 * Requires DATABASE_URL. The ledger (`schema_migrations`) records version +
 * sha256 checksum per applied file; editing an applied file makes the runner
 * fail loudly on the next run (checksum drift).
 *
 * Read of `migrations/*.sql` happens at CLI time only — never at app runtime —
 * so `output: 'standalone'` keeps tracing the app bundle without these files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { resolveSsl } from '@/lib/db';
import { parseMigrationFile, type MigrationFile } from '@/lib/migrate/plan';
import { computePendingMigrations, runMigrations } from '@/lib/migrate/runner';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../migrations');

function loadMigrations(): MigrationFile[] {
  const filenames = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return filenames.map((f) => parseMigrationFile(f, readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.',
    );
  }

  const check = process.argv.includes('--check');
  const pool = new Pool({ connectionString: databaseUrl, ssl: resolveSsl(databaseUrl) });
  const client = await pool.connect();

  try {
    const files = loadMigrations();

    if (check) {
      const { toApply, drifted } = await computePendingMigrations(client, files);
      if (drifted.length > 0) {
        console.error(`Migration checksum drift detected: ${drifted.join(', ')}`);
        process.exitCode = 1;
        return;
      }
      if (toApply.length === 0) {
        console.log('Migrations up to date');
        return;
      }
      for (const f of toApply) console.log(`Pending: ${f.filename}`);
      process.exitCode = 1;
      return;
    }

    const result = await runMigrations(client, files);
    for (const f of result.applied) console.log(`Applied ${f}`);
    if (result.applied.length === 0) console.log('Migrations up to date');

    // Seeding is wired in the data-layer plan Task 3: after a successful run the
    // ledger exists, so getDb() passes its assert-migrated guard and seeds the
    // admin user when `users` is empty (idempotent).
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
