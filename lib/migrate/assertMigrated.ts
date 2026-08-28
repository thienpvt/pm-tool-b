/**
 * Fast-fail migration guard for app boot.
 *
 * `getDb()` no longer creates schema or runs the migration loop. Instead it
 * calls `assertMigrated` right after connecting: if the `schema_migrations`
 * ledger has no rows (or does not exist and no legacy schema is present), the
 * app fails fast with the runbook message instead of silently booting against
 * an unmigrated database.
 *
 * Tolerates the pre-Task-3 self-init path: a database whose core schema already
 * exists — created by the old inline migration array — still boots, so a dev
 * who has not run `npm run migrate` yet is not bricked; the operator stamps the
 * ledger with `npm run migrate` (idempotent) at the first opportunity.
 *
 * Reads no files — keeps `lib/db.ts` free of `fs` and preserves
 * `output: 'standalone'`.
 */
const RUNBOOK_MESSAGE = 'Database schema not migrated — run "npm run migrate" first';

const LEGACY_BOOT_WARN =
  'schema_migrations ledger missing but companies table exists — run "npm run migrate" to stamp the ledger';

export async function assertMigrated(
  query: (sql: string) => Promise<{ rows: unknown[] }>,
  ledgerTable = 'schema_migrations',
): Promise<void> {
  try {
    const res = await query(`SELECT 1 FROM ${ledgerTable} LIMIT 1`);
    if (res.rows.length === 0) throw new Error(RUNBOOK_MESSAGE);
    return;
  } catch (err) {
    // Zero rows -> genuinely unmigrated (ledger present but empty). Do not fall
    // through to the legacy probe for this case.
    if (err instanceof Error && err.message === RUNBOOK_MESSAGE) throw err;

    // Ledger query itself failed (42P01 — table missing). If the core schema
    // still exists from the pre-Task-3 inline migration array, this is a legacy
    // database, not a fresh one — let the app boot.
    try {
      const probe = await query('SELECT 1 FROM companies LIMIT 1');
      if (probe.rows.length > 0) {
        console.warn(LEGACY_BOOT_WARN);
        return;
      }
    } catch {
      // companies missing too — genuinely fresh/unmigrated database.
    }
    throw new Error(RUNBOOK_MESSAGE);
  }
}
