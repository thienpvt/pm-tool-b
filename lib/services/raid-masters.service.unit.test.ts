import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listUpcomingMilestonesRepo,
  listOverdueMilestonesRepo,
} = vi.hoisted(() => ({
  listUpcomingMilestonesRepo: vi.fn(),
  listOverdueMilestonesRepo: vi.fn(),
}));

vi.mock('@/lib/repositories/milestones.repo', () => ({
  listUpcomingMilestones: listUpcomingMilestonesRepo,
  listOverdueMilestones: listOverdueMilestonesRepo,
}));

import { listOverdueMilestones, listUpcomingMilestones } from './raid-masters.service';

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('raid-masters.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('listUpcomingMilestones passes companyId with today and today+7 UTC date strings', async () => {
    listUpcomingMilestonesRepo.mockResolvedValue([]);
    const today = '2026-08-26';
    const windowEnd = addUtcDays(today, 7);

    await listUpcomingMilestones(5);

    expect(listUpcomingMilestonesRepo).toHaveBeenCalledWith(5, today, windowEnd);
  });

  it('listOverdueMilestones passes companyId with today UTC date string', async () => {
    listOverdueMilestonesRepo.mockResolvedValue([]);

    await listOverdueMilestones(5);

    expect(listOverdueMilestonesRepo).toHaveBeenCalledWith(5, '2026-08-26');
  });
});
