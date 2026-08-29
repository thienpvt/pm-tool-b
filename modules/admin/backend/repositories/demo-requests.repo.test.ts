import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { createDemoRequest } from './demo-requests.repo';

describe.skipIf(!hasTestDb)('demo-requests.repo', () => {
  beforeAll(async () => {
    await setupRepoTables();
  });

  it('createDemoRequest inserts a row retrievable by id', async () => {
    const suffix = `${Date.now()}`;
    const id = await createDemoRequest(
      `Demo User ${suffix}`,
      '555-0100',
      `demo-${suffix}@example.com`,
      `Demo Co ${suffix}`,
    );
    const row = await testDb().get<{ full_name: string; email: string }>(
      'SELECT full_name, email FROM demo_requests WHERE id = ?',
      id,
    );
    expect(row?.full_name).toBe(`Demo User ${suffix}`);
    expect(row?.email).toBe(`demo-${suffix}@example.com`);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await createDemoRequest('Kysely Probe', '555-0199', 'kysely-probe@test.com', 'Probe Co');
    expect(getKysely).toHaveBeenCalled();
  });
});
