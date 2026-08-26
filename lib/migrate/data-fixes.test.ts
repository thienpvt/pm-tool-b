import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMigrationFile } from './plan';

const root = fileURLToPath(new URL('../..', import.meta.url));

const migrationsDir = () => path.join(root, 'migrations');
const dataFixesDir = () => path.join(root, 'scripts', 'data-fixes');

describe('migrations directory integrity', () => {
  it('accepts every real migration file with unique, ascending versions', () => {
    const files = readdirSync(migrationsDir())
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(files.length).toBeGreaterThan(0);

    const parsed = files.map((f) =>
      parseMigrationFile(f, readFileSync(path.join(migrationsDir(), f), 'utf8')),
    );
    const versions = parsed.map((p) => p.version);
    expect(new Set(versions).size).toBe(versions.length); // unique
    expect(versions).toEqual([...versions].sort((a, b) => a - b)); // ascending
  });

  it('keeps the four data-fix UPDATEs out of migration 0002', () => {
    const sql = readFileSync(path.join(migrationsDir(), '0002-existing-schema-additions.sql'), 'utf8');
    const updateLines = sql
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^UPDATE\b/i.test(l));
    expect(updateLines).toEqual([]);
  });
});

describe('one-off data-fix scripts', () => {
  it('carries a non-empty SQL statement in each fix script', () => {
    const fixFiles = readdirSync(dataFixesDir())
      .filter((f) => f.endsWith('.ts') && f !== 'run-sql-fix.ts')
      .sort();
    expect(fixFiles.length).toBeGreaterThan(0);

    for (const f of fixFiles) {
      const src = readFileSync(path.join(dataFixesDir(), f), 'utf8');
      // Extract the SQL template literal passed to runFix({ sql: `...` }) or
      // built as `const sql = `...``.
      const m = /sql\s*[:=]\s*`([^`]*)`/.exec(src);
      expect(m, `${f} should pass a SQL template literal to runFix`).not.toBeNull();
      const sql = m![1].trim();
      expect(sql.length, `${f} SQL should be non-empty`).toBeGreaterThan(0);
      expect(sql, `${f} SQL should start with UPDATE/INSERT/SELECT`).toMatch(/^(UPDATE|INSERT|SELECT)\b/i);
    }
  });
});
