import type { AppliedMigration, MigrationFile } from './plan';
import { planPendingMigrations } from './plan';

// ── Migration runner — applies versioned SQL files against a pinned session ────

export interface QueryableClient {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
  release?: () => void;
}

export interface RunResult {
  /** Filenames applied by this run. */
  applied: string[];
  /** Filenames already present in the ledger (skipped). */
  alreadyApplied: string[];
  /** Filenames whose stored checksum no longer matches the file. */
  drifted: string[];
}

export const DEFAULT_LEDGER_TABLE = 'schema_migrations';

/** Valid unquoted PostgreSQL identifier for the ledger table name. */
const LEDGER_TABLE_PATTERN = /^[a-z_][a-z0-9_]*$/;

function assertLedgerTableName(ledgerTable: string): void {
  if (!LEDGER_TABLE_PATTERN.test(ledgerTable)) {
    throw new Error(`Invalid ledger table name: ${ledgerTable}`);
  }
}

/** Session advisory lock key serialising concurrent migrate runs (0x504D4D47 "PMMG"). */
export const MIGRATION_LOCK_KEY = 1347246335;

function isMissingRelation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '42P01') {
    return true;
  }
  const message = err instanceof Error ? err.message : String(err);
  return /relation .* does not exist/i.test(message);
}

async function ensureLedgerTable(client: QueryableClient, ledgerTable: string): Promise<void> {
  assertLedgerTableName(ledgerTable);
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${ledgerTable} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
  );
}

async function readApplied(client: QueryableClient, ledgerTable: string): Promise<AppliedMigration[]> {
  assertLedgerTableName(ledgerTable);
  const res = await client.query(`SELECT version, checksum FROM ${ledgerTable}`);
  return (res.rows as Array<{ version: number; checksum: string }>).map((r) => ({
    version: Number(r.version),
    checksum: String(r.checksum),
  }));
}

function summarize(files: MigrationFile[], applied: AppliedMigration[]) {
  const { toApply, drifted } = planPendingMigrations(files, applied);
  const appliedVersions = new Set(applied.map((a) => a.version));
  return {
    toApply,
    drifted,
    alreadyApplied: files.filter((f) => appliedVersions.has(f.version)).map((f) => f.filename),
  };
}

/**
 * Read-only preview: which migrations WOULD apply. Used by `npm run migrate
 * -- --check` as a deploy gate. Does not create the ledger table — a missing
 * ledger (42P01) is treated as "nothing applied yet".
 */
export async function computePendingMigrations(
  client: QueryableClient,
  files: MigrationFile[],
  opts?: { ledgerTable?: string },
): Promise<{ toApply: MigrationFile[]; alreadyApplied: string[]; drifted: string[] }> {
  const ledgerTable = opts?.ledgerTable ?? DEFAULT_LEDGER_TABLE;
  assertLedgerTableName(ledgerTable);
  await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    let applied: AppliedMigration[] = [];
    try {
      applied = await readApplied(client, ledgerTable);
    } catch (err) {
      if (isMissingRelation(err)) {
        applied = [];
      } else {
        throw err;
      }
    }
    return summarize(files, applied);
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => {});
  }
}

/**
 * Apply pending migrations in version order, recording one ledger row per file
 * with its sha256 checksum. The whole run is wrapped in a session advisory lock
 * so concurrent `npm run migrate` / multi-replica boots cannot interleave DDL.
 * Each migration runs as ONE multi-statement query inside BEGIN/COMMIT — a
 * failure rolls back the entire file and rethrows with the filename attached.
 */
export async function runMigrations(
  client: QueryableClient,
  files: MigrationFile[],
  opts?: { ledgerTable?: string },
): Promise<RunResult> {
  const ledgerTable = opts?.ledgerTable ?? DEFAULT_LEDGER_TABLE;
  assertLedgerTableName(ledgerTable);
  const result: RunResult = { applied: [], alreadyApplied: [], drifted: [] };

  await client.query(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await ensureLedgerTable(client, ledgerTable);
    const applied = await readApplied(client, ledgerTable);
    const { toApply, drifted, alreadyApplied } = summarize(files, applied);
    result.drifted = drifted;
    result.alreadyApplied = alreadyApplied;
    if (drifted.length > 0) {
      throw new Error(`Migration checksum drift detected: ${drifted.join(', ')}`);
    }

    for (const file of toApply) {
      try {
        await client.query('BEGIN');
        await client.query(file.sql);
        await client.query(
          `INSERT INTO ${ledgerTable} (version, name, checksum) VALUES ($1, $2, $3)`,
          [file.version, file.filename, file.checksum],
        );
        await client.query('COMMIT');
        result.applied.push(file.filename);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(
          `Migration ${file.filename} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return result;
  } finally {
    await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`).catch(() => {});
  }
}
