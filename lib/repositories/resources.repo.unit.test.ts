import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { listResourceMembers } from './resources.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.all.mockResolvedValue([{ id: 1, name: 'Ava' }]);
});

describe('resources.repo', () => {
  it('uses the company and customer ownership paths for a tenant', async () => {
    await expect(listResourceMembers(7, false)).resolves.toEqual([{ id: 1, name: 'Ava' }]);

    expect(db.all).toHaveBeenCalledWith(
      expect.stringContaining('WHERE (p.company_id = ? OR c.company_id = ?)'),
      7,
      7,
    );
  });

  it('uses the strict unassigned-project predicate for a null-company user', async () => {
    await listResourceMembers(null, false);

    const sql = String(db.all.mock.calls[0][0]).replace(/\s+/g, ' ').trim();
    expect(sql).toContain(
      'p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)',
    );
    expect(db.all).toHaveBeenCalledWith(expect.any(String));
  });

  it('keeps the admin branch unfiltered', async () => {
    await listResourceMembers(null, true);

    expect(db.all).toHaveBeenCalledWith(expect.not.stringContaining('WHERE'));
  });
});
