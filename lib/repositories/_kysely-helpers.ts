import { UnknownColumnError } from './_helpers';

/**
 * Runtime allowlist filter for Kysely `.set()` writes.
 *
 * Mirrors `buildUpdate` semantics: unknown keys throw `UnknownColumnError`,
 * allowlisted keys are returned in allowlist order. Callers narrow the compile-time
 * type with `Pick<Updateable<Database[table]>, typeof COLUMNS[number]>`.
 */
export function pickAllowed<T extends Record<string, unknown>>(
  allowlist: readonly string[],
  fields: Record<string, unknown>,
): Partial<T> {
  const keys = Object.keys(fields);
  const unknown = keys.filter(k => !allowlist.includes(k));
  if (unknown.length) throw new UnknownColumnError(unknown);

  const columns = allowlist.filter(c => keys.includes(c));
  if (!columns.length) throw new UnknownColumnError([]);

  return Object.fromEntries(columns.map(c => [c, fields[c]])) as Partial<T>;
}
