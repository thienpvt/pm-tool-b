import { afterAll, describe, expect, it } from 'vitest';
import { parseMigrationFile } from './plan';
import { runMigrations, type QueryableClient } from './runner';
import { closeTestPool, hasTestDb, testPool } from '../../test/db';

const BASELINE_SQL = 'CREATE TABLE companies (id SERIAL PRIMARY KEY);';

/**
 * Fake pg client that records every `query(text)` call and keeps an in-memory
 * ledger so a second `runMigrations` run sees the first run's rows. `failOn`
 * lets a test force a mid-migration failure (syntax error) to assert ROLLBACK.
 */
class FakeClient implements QueryableClient {
  queries: string[] = [];
  ledger: Array<{ version: number; checksum: string }> = [];
  failOn?: string;

  async query(text: string): Promise<{ rows: unknown[] }> {
    this.queries.push(text);
    if (this.failOn && text === this.failOn) throw new Error('syntax error at or near "THIS"');
    if (text.startsWith('CREATE TABLE IF NOT EXISTS')) return { rows: [] };
    if (text.startsWith('SELECT version, checksum FROM')) return { rows: this.ledger };
    if (text.startsWith('SELECT pg_advisory_lock') || text.startsWith('SELECT pg_advisory_unlock')) {
      return { rows: [] };
    }
    if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rows: [] };
    const insert = /^INSERT INTO (\S+) \(version, name, checksum\) VALUES \((\d+), '([^']+)', '([^']+)'\)$/.exec(
      text,
    );
    if (insert) {
      this.ledger.push({ version: Number(insert[2]), checksum: insert[4] });
      return { rows: [] };
    }
    return { rows: [] };
  }
}

describe('runMigrations (unit, fake client)', () => {
  const baseline = parseMigrationFile('0001-baseline-schema.sql', BASELINE_SQL);

  it('records one ledger row per applied migration with version + checksum, framed by BEGIN/COMMIT', async () => {
    const client = new FakeClient();
    const result = await runMigrations(client, [baseline]);

    expect(result.applied).toEqual(['0001-baseline-schema.sql']);
    expect(result.alreadyApplied).toEqual([]);
    expect(result.drifted).toEqual([]);

    expect(client.queries).toContain('BEGIN');
    expect(client.queries).toContain('COMMIT');
    expect(client.queries).not.toContain('ROLLBACK');

    const inserts = client.queries.filter((q) => q.startsWith('INSERT INTO schema_migrations'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toContain('0001-baseline-schema.sql');
    expect(inserts[0]).toContain(baseline.checksum);
  });

  it('is idempotent: a second run inserts zero rows and reports alreadyApplied', async () => {
    const client = new FakeClient();
    const first = await runMigrations(client, [baseline]);
    expect(first.applied).toEqual(['0001-baseline-schema.sql']);

    const second = await runMigrations(client, [baseline]);
    expect(second.applied).toEqual([]);
    expect(second.alreadyApplied).toEqual(['0001-baseline-schema.sql']);

    const inserts = client.queries.filter((q) => q.startsWith('INSERT INTO schema_migrations'));
    expect(inserts).toHaveLength(1);
  });

  it('rolls back and rethrows with the filename when a migration fails', async () => {
    const failing = parseMigrationFile('0002-broken.sql', 'THIS IS NOT VALID SQL;');
    const client = new FakeClient();
    client.failOn = 'THIS IS NOT VALID SQL;';

    await expect(runMigrations(client, [baseline, failing])).rejects.toThrow(/0002-broken\.sql/);

    expect(client.queries).toContain('ROLLBACK');
    // Only the successful baseline insert landed; the failing migration rolled back.
    const inserts = client.queries.filter((q) => q.startsWith('INSERT INTO schema_migrations'));
    expect(inserts).toHaveLength(1);
  });

  it('throws on checksum drift against an already-applied migration', async () => {
    const client = new FakeClient();
    await runMigrations(client, [baseline]);

    const tampered = parseMigrationFile('0001-baseline-schema.sql', `${BASELINE_SQL} -- tampered`);
    await expect(runMigrations(client, [tampered])).rejects.toThrow(/checksum drift/i);
  });
});

describe.skipIf(!hasTestDb)('runMigrations against real Postgres', () => {
  const LEDGER = 'schema_migrations_probe';
  const PROBE_SQL = 'CREATE TABLE IF NOT EXISTS migrate_tracer_probe (id SERIAL PRIMARY KEY);';

  afterAll(async () => {
    await testPool().query(`DROP TABLE IF EXISTS ${LEDGER}`);
    await testPool().query('DROP TABLE IF EXISTS migrate_tracer_probe');
    await closeTestPool();
  });

  it('applies a probe migration once and is a no-op on the second run', async () => {
    const client = await testPool().connect();
    try {
      const probeFile = parseMigrationFile('0001-probe.sql', PROBE_SQL);

      const first = await runMigrations(client, [probeFile], { ledgerTable: LEDGER });
      expect(first.applied).toEqual(['0001-probe.sql']);

      const ledger = await client.query(`SELECT version, name, checksum FROM ${LEDGER}`);
      expect(ledger.rows).toHaveLength(1);
      expect(ledger.rows[0]).toMatchObject({ version: 1, name: '0001-probe.sql' });

      const table = await client.query(`SELECT to_regclass('public.migrate_tracer_probe') AS cls`);
      expect(table.rows[0].cls).not.toBeNull();

      const second = await runMigrations(client, [probeFile], { ledgerTable: LEDGER });
      expect(second.applied).toEqual([]);
      expect(second.alreadyApplied).toEqual(['0001-probe.sql']);

      const rowsAfter = await client.query(`SELECT COUNT(*)::int AS c FROM ${LEDGER}`);
      expect(rowsAfter.rows[0].c).toBe(1);
    } finally {
      client.release();
    }
  });
});
