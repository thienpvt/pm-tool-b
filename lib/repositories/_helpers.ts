/**
 * Shared write-path guard for repositories.
 *
 * Every UPDATE in this codebase used to be built from `Object.keys(body)`, which let a
 * client set any column it could name — including `company_id`, the tenancy key. These
 * helpers replace that: a caller declares an explicit column allowlist, and an unknown
 * key is rejected rather than silently dropped (REPO-03).
 */

export class UnknownColumnError extends Error {
  readonly columns: string[];

  constructor(columns: string[]) {
    super(columns.length ? `Unknown column(s): ${columns.join(', ')}` : 'No updatable columns provided');
    this.name = 'UnknownColumnError';
    this.columns = columns;
  }
}

/**
 * Build the `SET` fragment of an UPDATE from an allowlist.
 *
 * Returns the fragment only — the caller owns the full statement, so the table name is
 * never interpolated here and no value is ever inlined. Placeholders are `?`, matching
 * the convention `lib/db.ts` rewrites to `$n`.
 *
 * Columns are emitted in allowlist order, not caller-key order, so the SQL is
 * deterministic for a given set of fields.
 *
 * @throws UnknownColumnError if any key is outside the allowlist, or if nothing is left to set.
 */
export function buildUpdate(
  table: string,
  allowlist: readonly string[],
  fields: Record<string, unknown>,
): { sql: string; values: unknown[] } {
  const keys = Object.keys(fields);
  const unknown = keys.filter(k => !allowlist.includes(k));
  if (unknown.length) throw new UnknownColumnError(unknown);

  const columns = allowlist.filter(c => keys.includes(c));
  if (!columns.length) throw new UnknownColumnError([]);

  return {
    sql: columns.map(c => `${c} = ?`).join(', '),
    values: columns.map(c => fields[c]),
  };
}
