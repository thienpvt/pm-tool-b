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

import { listPortfolioMilestones, listPortfolioProjects } from './portfolio.repo';
import { listProjects } from './projects.repo';
import { projectCountsByProgram } from './programs.repo';
import { listResourceMembers } from './resources.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.all.mockResolvedValue([]);
});

function normalizedSql(): string {
  return db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
}

describe('null-company project visibility', () => {
  it.each([
    ['project list', () => listProjects(null)],
    ['resource list', () => listResourceMembers(null)],
    ['portfolio project list', () => listPortfolioProjects(null)],
    ['portfolio milestone list', () => listPortfolioMilestones(null)],
  ])('requires direct and customer ownership to be unassigned for the %s', async (_name, query) => {
    await query();

    expect(normalizedSql()).toContain(
      'p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)',
    );
    expect(db.all).toHaveBeenCalledWith(expect.any(String));
  });

  it('excludes tenant-owned customers from unassigned program project counts', async () => {
    await projectCountsByProgram(null);

    expect(normalizedSql()).toContain(
      'p.customer_id IS NOT NULL AND p.company_id IS NULL AND c.company_id IS NULL',
    );
    expect(db.all).toHaveBeenCalledWith(expect.any(String));
  });
});
