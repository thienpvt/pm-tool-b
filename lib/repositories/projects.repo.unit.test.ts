import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    exec: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { listProjects } from './projects.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.all.mockResolvedValue([]);
});

function normalizedSql(): string {
  return db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
}

describe('listProjects', () => {
  it('scopes to company without a global all-rows branch (D-13)', async () => {
    await listProjects(5);

    expect(normalizedSql()).toContain('WHERE (p.company_id = ? OR c.company_id = ?)');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 5);
  });

  it('ANDs D-14 assignment predicate when PM opts provided (D-14)', async () => {
    await listProjects(5, { pmEmail: 'ava@example.com', pmName: 'Ava', username: 'ava' });

    expect(normalizedSql()).toContain('LOWER(p.pm_email) = LOWER(?)');
    expect(normalizedSql()).toContain('LOWER(TRIM(COALESCE(p.pm_name');
    expect(db.all).toHaveBeenCalledWith(
      expect.any(String),
      5,
      5,
      'ava@example.com',
      'Ava',
      'ava',
    );
  });

  it('returns unassigned-only rows for null company (CR-01)', async () => {
    await listProjects(null);

    expect(normalizedSql()).toContain(
      'p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)',
    );
  });
});
