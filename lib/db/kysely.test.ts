import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { hasTestDb, testPool } from '@/test/db';
import { setupRepoTables } from '@/test/repo-db';

const root = resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('kysely factory contract', () => {
  it('pins kysely@0.29.5 and kysely-codegen@0.20.0 with codegen:db script', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.kysely).toBe('0.29.5');
    expect(pkg.devDependencies?.['kysely-codegen']).toBe('0.20.0');
    expect(pkg.scripts?.['codegen:db']).toContain('kysely-codegen');
    expect(pkg.scripts?.['codegen:db']).toContain('lib/db/database.ts');
  });

  it('exports getPool from lib/db.ts', () => {
    expect(readSource('lib/db.ts')).toMatch(/export async function getPool/);
  });

  it('getKysely uses getPool and PostgresDialect with txKyselyTarget', () => {
    const source = readSource('lib/db/kysely.ts');
    expect(source).toContain('getPool(');
    expect(source).toContain('PostgresDialect');
    expect(source).toContain('txKyselyTarget');
  });

  it('checks in lib/db/database.ts', () => {
    const source = readSource('lib/db/database.ts');
    expect(source).toContain('export interface Database');
    expect(source).toContain('audit_logs');
  });
});

describe.skipIf(!hasTestDb)('kysely on testPool', () => {
  it('selectFrom audit_logs resolves on PostgresDialect pool', async () => {
    await setupRepoTables();
    const db = new Kysely({
      dialect: new PostgresDialect({ pool: testPool() }),
    });
    await expect(
      db.selectFrom('audit_logs').select('id').limit(1).execute(),
    ).resolves.toEqual(expect.any(Array));
    await db.destroy();
  });
});
