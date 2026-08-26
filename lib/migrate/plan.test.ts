import { describe, expect, it } from 'vitest';
import { parseMigrationFile, planPendingMigrations, sha256 } from './plan';

describe('parseMigrationFile', () => {
  it('parses a leading 1-4 digit version before the first dash', () => {
    const f = parseMigrationFile('0001-baseline-schema.sql', 'CREATE TABLE companies (id SERIAL PRIMARY KEY);');
    expect(f.version).toBe(1);
    expect(f.filename).toBe('0001-baseline-schema.sql');
    expect(f.name).toBe('0001-baseline-schema.sql');
    expect(f.checksum).toBe(sha256('CREATE TABLE companies (id SERIAL PRIMARY KEY);'));
  });

  it('accepts hyphens in the descriptive name portion', () => {
    const f = parseMigrationFile('0002-existing-schema-additions.sql', 'ALTER TABLE users ADD COLUMN x INTEGER;');
    expect(f.version).toBe(2);
    expect(f.filename).toBe('0002-existing-schema-additions.sql');
  });

  it('rejects non-NNNN-*.sql filenames with a descriptive error', () => {
    for (const bad of ['README.md', '0001.sql', 'foo.sql', '12345-oversize.sql', '-no-version.sql']) {
      expect(() => parseMigrationFile(bad, 'x')).toThrow(/Invalid migration filename/);
    }
  });

  it('covers the full 1-4 digit version range', () => {
    expect(parseMigrationFile('0001-x.sql', 'y').version).toBe(1);
    expect(parseMigrationFile('9999-x.sql', 'y').version).toBe(9999);
  });
});

describe('planPendingMigrations', () => {
  const f1 = parseMigrationFile('0001-a.sql', 'CREATE TABLE a (id SERIAL PRIMARY KEY);');
  const f2 = parseMigrationFile('0002-b.sql', 'CREATE TABLE b (id SERIAL PRIMARY KEY);');
  const f3 = parseMigrationFile('0003-c.sql', 'CREATE TABLE c (id SERIAL PRIMARY KEY);');

  it('orders pending migrations by version regardless of input order', () => {
    const { toApply } = planPendingMigrations([f2, f1, f3], []);
    expect(toApply.map((f) => f.version)).toEqual([1, 2, 3]);
  });

  it('computes pending as files whose version is not in the applied set', () => {
    const { toApply } = planPendingMigrations([f1, f2, f3], [{ version: 1, checksum: f1.checksum }]);
    expect(toApply.map((f) => f.version)).toEqual([2, 3]);
  });

  it('returns empty pending when every file is already applied (idempotency proof)', () => {
    const { toApply } = planPendingMigrations(
      [f1, f2, f3],
      [
        { version: 1, checksum: f1.checksum },
        { version: 2, checksum: f2.checksum },
        { version: 3, checksum: f3.checksum },
      ],
    );
    expect(toApply).toEqual([]);
  });

  it('throws on duplicate versions', () => {
    const dup = parseMigrationFile('0001-a.sql', 'one');
    const dup2 = parseMigrationFile('0001-b.sql', 'two');
    expect(() => planPendingMigrations([dup, dup2], [])).toThrow(/Duplicate migration version/);
  });

  it('collects checksum drift for applied versions whose file changed', () => {
    const tampered = parseMigrationFile('0001-a.sql', 'CREATE TABLE a (id SERIAL PRIMARY KEY); -- tampered');
    const { toApply, drifted } = planPendingMigrations(
      [tampered, f2],
      [
        { version: 1, checksum: f1.checksum },
        { version: 2, checksum: f2.checksum },
      ],
    );
    expect(toApply).toEqual([]); // both versions applied, nothing pending
    expect(drifted).toEqual(['0001-a.sql']);
  });

  it('does not flag an applied version with no corresponding file as drift', () => {
    const { toApply, drifted } = planPendingMigrations(
      [f2],
      [
        { version: 1, checksum: 'deadbeef' },
        { version: 2, checksum: f2.checksum },
      ],
    );
    expect(drifted).toEqual([]);
    expect(toApply).toEqual([]);
  });
});
