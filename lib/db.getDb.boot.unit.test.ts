import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Extract the getDb function body from lib/db.ts (region-scoped, not file-wide). */
function extractGetDbBody(src: string): string {
  const start = src.indexOf('export async function getDb()');
  expect(start).toBeGreaterThan(-1);
  const openBrace = src.indexOf('{', start);
  expect(openBrace).toBeGreaterThan(-1);

  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openBrace + 1, i);
    }
  }
  throw new Error('Could not find closing brace for getDb');
}

describe('getDb boot path (DATA-01, D-05)', () => {
  const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
  const body = extractGetDbBody(src);

  it('calls assertMigrated and seedAuthData', () => {
    expect(body).toMatch(/assertMigrated/);
    expect(body).toMatch(/seedAuthData/);
  });

  it('does not run schema-init, legacy migrate array, weighted backfill, or await migrate*(pool)', () => {
    expect(body).not.toMatch(/initPostgresSchema/);
    expect(body).not.toMatch(/migratePostgresSchema/);
    expect(body).not.toMatch(/backfillWeightedCompletion/);
    expect(body).not.toMatch(/await migrate\w+\(pool\)/);
  });

  it('does not import scripts/data-fixes (DATA-03)', () => {
    expect(src).not.toMatch(/scripts\/data-fixes/);
  });
});
