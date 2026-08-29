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

describe.skip('listProjects (obsolete after Kysely migration — see projects.repo.test.ts)', () => {
  it('scopes to company without a global all-rows branch (D-13)', async () => {
    await listProjects(5);

    expect(normalizedSql()).toContain('WHERE (p.company_id = ? OR c.company_id = ?)');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 5);
  });

  it('ANDs assignment window EXISTS when pmUserId provided (D-13, PMAS-04)', async () => {
    await listProjects(5, { pmUserId: 2 });

    expect(normalizedSql()).toContain('project_pm_assignments');
    expect(normalizedSql()).toContain('user_id = ?');
    expect(normalizedSql()).not.toContain('LOWER(p.pm_email)');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 5, 2);
  });

  it('returns unassigned-only rows for null company (CR-01)', async () => {
    await listProjects(null);

    expect(normalizedSql()).toContain(
      'p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)',
    );
  });
});
