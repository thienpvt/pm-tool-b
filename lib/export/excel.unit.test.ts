import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  getProject,
  listActivities,
  listTeam,
  listMeetings,
  listEscalationsForExport,
  listRisks,
  listIssues,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProject: vi.fn(),
  listActivities: vi.fn(),
  listTeam: vi.fn(),
  listMeetings: vi.fn(),
  listEscalationsForExport: vi.fn(),
  listRisks: vi.fn(),
  listIssues: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ getProject }));
vi.mock('@/modules/projects/backend/repositories/activities.repo', () => ({ listActivities }));
vi.mock('@/modules/projects/backend/repositories/team.repo', () => ({ listTeam }));
vi.mock('@/modules/projects/backend/repositories/meetings.repo', () => ({ listMeetings }));
vi.mock('@/modules/projects/backend/repositories/escalations.repo', () => ({ listEscalationsForExport }));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({ listRisks }));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({ listIssues }));

import { generateProjectPlan } from './excel';
import { ForbiddenError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: null as number | null, is_admin: 1 as number | boolean };

function mockEmptyPlan() {
  getProject.mockResolvedValue({
    name: 'Alpha',
    client: 'Acme',
    pm_name: 'Ava',
    start_date: '2025-01-01',
    end_date: '2025-06-01',
  });
  listActivities.mockResolvedValue([]);
  listTeam.mockResolvedValue([]);
  listMeetings.mockResolvedValue([]);
  listEscalationsForExport.mockResolvedValue([]);
  listRisks.mockResolvedValue([]);
  listIssues.mockResolvedValue([]);
}

describe('generateProjectPlan', () => {
  it('does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateProjectPlan(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(getProject).not.toHaveBeenCalled();
    expect(listActivities).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenError for a cross-company actor', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateProjectPlan(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('asserts access then returns a Buffer for an admin', async () => {
    mockEmptyPlan();
    const buf = await generateProjectPlan(7, admin);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, admin);
    expect(getProject).toHaveBeenCalledWith(7);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('asserts access before the first repository read for an owner', async () => {
    mockEmptyPlan();
    await generateProjectPlan(7, owner);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(getProject).toHaveBeenCalledWith(7);
  });
});
