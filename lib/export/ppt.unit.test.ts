import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  getProject,
  listTeam,
  listMeetings,
  listRisks,
  listActivities,
  getDocumentForExport,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  getProject: vi.fn(),
  listTeam: vi.fn(),
  listMeetings: vi.fn(),
  listRisks: vi.fn(),
  listActivities: vi.fn(),
  getDocumentForExport: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/projects.repo', () => ({ getProject }));
vi.mock('@/lib/repositories/team.repo', () => ({ listTeam }));
vi.mock('@/lib/repositories/meetings.repo', () => ({ listMeetings }));
vi.mock('@/lib/repositories/risks.repo', () => ({ listRisks }));
vi.mock('@/lib/repositories/activities.repo', () => ({ listActivities }));
vi.mock('@/lib/repositories/documents.repo', () => ({ getDocumentForExport }));

import { generateKickoffPPT } from './ppt';
import { ForbiddenError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };
const admin = { company_id: null as number | null, is_admin: 1 as number | boolean };

function mockEmptyKickoff() {
  getProject.mockResolvedValue({
    name: 'Alpha',
    client: 'Acme',
    pm_name: 'Ava',
    start_date: '2025-01-01',
    end_date: '2025-06-01',
    current_phase: 'Initializing',
  });
  listTeam.mockResolvedValue([]);
  listMeetings.mockResolvedValue([]);
  listRisks.mockResolvedValue([]);
  listActivities.mockResolvedValue([]);
  getDocumentForExport.mockResolvedValue(undefined);
}

describe('generateKickoffPPT', () => {
  it('does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateKickoffPPT(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(getProject).not.toHaveBeenCalled();
    expect(listTeam).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenError for a cross-company actor', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(generateKickoffPPT(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('asserts access then returns a Buffer for an admin', async () => {
    mockEmptyKickoff();
    const buf = await generateKickoffPPT(7, admin);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, admin);
    expect(getProject).toHaveBeenCalledWith(7);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('asserts access before the first repository read for an owner', async () => {
    mockEmptyKickoff();
    await generateKickoffPPT(7, owner, { methodology: 'agile' });
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(getProject).toHaveBeenCalledWith(7);
  });
});
