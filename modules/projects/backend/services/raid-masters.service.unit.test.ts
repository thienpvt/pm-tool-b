import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listUpcomingMilestonesRepo,
  listOverdueMilestonesRepo,
  listHighOpenRaidRepo,
  listTechnologyCouncilIssuesRepo,
} = vi.hoisted(() => ({
  listUpcomingMilestonesRepo: vi.fn(),
  listOverdueMilestonesRepo: vi.fn(),
  listHighOpenRaidRepo: vi.fn(),
  listTechnologyCouncilIssuesRepo: vi.fn(),
}));

vi.mock('@/modules/projects/backend/repositories/milestones.repo', () => ({
  listUpcomingMilestones: listUpcomingMilestonesRepo,
  listOverdueMilestones: listOverdueMilestonesRepo,
}));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({
  listHighOpenRaid: listHighOpenRaidRepo,
}));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({
  listTechnologyCouncilIssues: listTechnologyCouncilIssuesRepo,
}));

import {
  listHighOpenRaid,
  listOverdueMilestones,
  listTechnologyCouncilIssues,
  listUpcomingMilestones,
} from './raid-masters.service';

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

  it('listHighOpenRaid returns record count not distinct projects (two risks one issue => 3)', async () => {
    const records = [
      { entity_type: 'risk', id: 1, project_id: 10, priority: 'High', status: 'Open' },
      { entity_type: 'risk', id: 2, project_id: 10, priority: 'High', status: 'In Progress' },
      { entity_type: 'issue', id: 3, project_id: 10, priority: 'High', status: 'Open' },
    ];
    listHighOpenRaidRepo.mockResolvedValue(records);

    const result = await listHighOpenRaid(5);

    expect(listHighOpenRaidRepo).toHaveBeenCalledWith(5);
    expect(result.records).toEqual(records);
    expect(result.count).toBe(3);
  });

  it('listTechnologyCouncilIssues delegates to repo with companyId', async () => {
    const rows = [{ id: 1, technology_council: true, status: 'Open', project_name: 'Alpha' }];
    listTechnologyCouncilIssuesRepo.mockResolvedValue(rows);

    await expect(listTechnologyCouncilIssues(5)).resolves.toEqual(rows);

    expect(listTechnologyCouncilIssuesRepo).toHaveBeenCalledWith(5);
  });
});
