import { createHash } from 'crypto';

// ── Migration planning (pure logic — no DB, no fs) ─────────────────────────────

export interface MigrationFile {
  /** Leading 1-4 digit version parsed from the `NNNN-*.sql` filename. */
  version: number;
  /** Full filename, e.g. `0001-baseline-schema.sql`. */
  name: string;
  /** Filename alias — kept for callers that prefer the term. */
  filename: string;
  /** sha256 hex digest of the file content; what the ledger stores. */
  checksum: string;
  /** Raw SQL content of the file. */
  sql: string;
}

export interface AppliedMigration {
  version: number;
  checksum: string;
}

const FILENAME_RE = /^(\d{1,4})-[A-Za-z0-9_-]+\.sql$/;

/**
 * Parse a migration filename into a `MigrationFile`. The version is the leading
 * 1-4 digit prefix before the first `-`; the descriptive tail may contain
 * hyphens (e.g. `0002-existing-schema-additions.sql`). Anything else throws.
 */
export function parseMigrationFile(filename: string, sql: string): MigrationFile {
  const match = FILENAME_RE.exec(filename);
  if (!match) throw new Error(`Invalid migration filename: ${filename}`);
  return {
    version: Number(match[1]),
    name: filename,
    filename,
    checksum: sha256(sql),
    sql,
  };
}

/** sha256 hex digest of a migration file's content. */
export function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Compute which migrations to apply given the on-disk files and the applied
 * ledger rows. Sorts by version, throws on duplicate versions, and collects
 * every applied version whose stored checksum no longer matches its file into
 * `drifted`. Pending = files whose version is not in `applied`.
 */
export function planPendingMigrations(
  files: MigrationFile[],
  applied: AppliedMigration[],
): { toApply: MigrationFile[]; drifted: string[] } {
  const byVersion = new Map<number, MigrationFile>();
  for (const file of files) {
    if (byVersion.has(file.version)) {
      throw new Error(`Duplicate migration version: ${file.version}`);
    }
    byVersion.set(file.version, file);
  }

  const sorted = [...files].sort((a, b) => a.version - b.version);
  const appliedVersions = new Set(applied.map((a) => a.version));

  const drifted: string[] = [];
  for (const row of applied) {
    const file = byVersion.get(row.version);
    if (file && file.checksum !== row.checksum) drifted.push(file.filename);
  }

  return { toApply: sorted.filter((f) => !appliedVersions.has(f.version)), drifted };
}
