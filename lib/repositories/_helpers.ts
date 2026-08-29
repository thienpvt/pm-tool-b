/**
 * Shared write-path guard for repositories.
 *
 * Runtime mass-assignment protection lives in `pickAllowed` (`_kysely-helpers.ts`).
 * This module keeps the shared `UnknownColumnError` type thrown on unknown column keys (REPO-03, D-04).
 */

export class UnknownColumnError extends Error {
  readonly columns: string[];

  constructor(columns: string[]) {
    super(columns.length ? `Unknown column(s): ${columns.join(', ')}` : 'No updatable columns provided');
    this.name = 'UnknownColumnError';
    this.columns = columns;
  }
}
