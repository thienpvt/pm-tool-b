import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { getSetting } from './settings.repo';

describe.skipIf(!hasTestDb)('settings.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
    // Both keys, not just one: a leftover row from a prior run collides with the insert below.
    await testDb().run("DELETE FROM settings WHERE key = ? OR key = ?", 'repo_test_key', 'anthropic_api_key');
  });

  it('returns undefined for a missing key', async () => {
    await expect(getSetting('definitely_absent_key')).resolves.toBeUndefined();
  });

  it('reads a value back by key', async () => {
    // `settings` has a TEXT primary key, not a serial id — lib/db.ts excludes it from
    // RETURNING id, so this insert must not be read for lastInsertRowid.
    await testDb().run('INSERT INTO settings (key, value) VALUES (?, ?)', 'repo_test_key', 'sk-value');
    await expect(getSetting('repo_test_key')).resolves.toBe('sk-value');
  });

  it('passes the key as text, not as an array parameter', async () => {
    // Regression guard: the previous inline call passed `['anthropic_api_key']`, which pg
    // received as an array literal and never matched. A string param must match.
    await testDb().run('INSERT INTO settings (key, value) VALUES (?, ?)', 'anthropic_api_key', 'sk-real');
    await expect(getSetting('anthropic_api_key')).resolves.toBe('sk-real');
  });
});
