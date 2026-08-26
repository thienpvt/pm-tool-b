import { describe, expect, it, vi } from 'vitest';
import { assertMigrated } from './assertMigrated';

describe('assertMigrated', () => {
  it('throws a runbook message when the ledger exists but is empty (zero rows)', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(assertMigrated(query)).rejects.toThrow(/npm run migrate/);
  });

  it('resolves when the ledger returns one or more rows', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{}] });
    await expect(assertMigrated(query)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith('SELECT 1 FROM schema_migrations LIMIT 1');
  });

  it('resolves when the ledger table is missing but a legacy 0.1.x-era schema is present', async () => {
    // First call (ledger SELECT) rejects with 42P01; second call (legacy schema
    // probe) resolves with a row — a pre-Task-3 database created by the old
    // inline migration array. The guard must not break that dev's boot.
    const query = vi
      .fn()
      .mockRejectedValueOnce(new Error('relation "schema_migrations" does not exist'))
      .mockResolvedValueOnce({ rows: [{}] });
    await expect(assertMigrated(query)).resolves.toBeUndefined();
  });

  it('throws the runbook message when the ledger is missing and no legacy schema exists', async () => {
    const query = vi.fn().mockRejectedValue(new Error('relation "schema_migrations" does not exist'));
    await expect(assertMigrated(query)).rejects.toThrow(/npm run migrate/);
  });
});
