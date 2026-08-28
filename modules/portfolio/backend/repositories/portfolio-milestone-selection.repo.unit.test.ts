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

import { portfolioMilestoneSelection } from '@/modules/portfolio/backend/repositories/portfolio.repo';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('portfolio milestone selection scope', () => {
  it('returns no milestone or activity links when company cannot see the project', async () => {
    db.get.mockResolvedValue(undefined);

    const result = await portfolioMilestoneSelection([41], 7);

    expect(result).toEqual({
      milestones: [],
      projectIds: [],
      activityIds: [],
      periodMin: null,
      periodMax: null,
    });
    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('AND p.company_id = ?'),
      41,
      7,
    );
    expect(db.all).not.toHaveBeenCalled();
  });

  it('limits milestone links to activities in the selected project for null-company scope', async () => {
    db.get.mockResolvedValue({
      id: 41,
      project_id: 9,
      name: 'Launch',
      project_name: 'Atlas',
      program_name: 'Delivery',
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    });
    db.all.mockResolvedValue([{ activity_id: 77 }]);

    const result = await portfolioMilestoneSelection([41], null);

    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('p.company_id IS NULL'),
      41,
    );
    expect(db.all).toHaveBeenCalledWith(
      expect.stringContaining('AND a.project_id = ?'),
      41,
      9,
    );
    expect(result.activityIds).toEqual([77]);
    expect(result.projectIds).toEqual([9]);
  });
});
