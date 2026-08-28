import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  getProjectWithCustomer,
  getProjectForReport,
  listDoneBetween,
  listByStatuses,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
  listOpenRisks,
  listOpenIssues,
  listMilestones,
  listEpicActivityIds,
  listForProjectReport,
  risksNotClosed,
  issuesNotClosed,
  maxSnapshotDate,
  snapshotDateOnOrBefore,
  countsBySnapshot,
  teamForReport,
  companyRagConfig,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  getProjectWithCustomer: vi.fn(),
  getProjectForReport: vi.fn(),
  listDoneBetween: vi.fn(),
  listByStatuses: vi.fn(),
  listPlannedBetweenExcludingStatuses: vi.fn(),
  listStatusAndPhase: vi.fn(),
  listOpenRisks: vi.fn(),
  listOpenIssues: vi.fn(),
  listMilestones: vi.fn(),
  listEpicActivityIds: vi.fn(),
  listForProjectReport: vi.fn(),
  risksNotClosed: vi.fn(),
  issuesNotClosed: vi.fn(),
  maxSnapshotDate: vi.fn(),
  snapshotDateOnOrBefore: vi.fn(),
  countsBySnapshot: vi.fn(),
  teamForReport: vi.fn(),
  companyRagConfig: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  getProjectWithCustomer,
  getProjectForReport,
}));
vi.mock('@/modules/projects/backend/repositories/activities.repo', () => ({
  listDoneBetween,
  listByStatuses,
  listPlannedBetweenExcludingStatuses,
  listStatusAndPhase,
  listForProjectReport,
}));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({
  listOpenRisks,
  listNotClosedByPriority: risksNotClosed,
}));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({
  listOpenIssues,
  listNotClosedByPriority: issuesNotClosed,
}));
vi.mock('@/modules/projects/backend/repositories/milestones.repo', () => ({
  listMilestones,
  listEpicActivityIds,
}));
vi.mock('@/modules/projects/backend/repositories/bugs.repo', () => ({
  maxSnapshotDate,
  snapshotDateOnOrBefore,
  countsBySnapshot,
}));
vi.mock('@/modules/projects/backend/repositories/team.repo', () => ({
  listForReport: teamForReport,
}));
vi.mock('@/modules/admin/backend/repositories/rag-config.repo', () => ({ companyRagConfig }));

import { getProjectReport, getWeeklyProjectReport } from '@/modules/reports/backend/services/project-report.service';
import { ForbiddenError } from '@/lib/services/errors';

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  listDoneBetween.mockResolvedValue([]);
  listByStatuses.mockResolvedValue([]);
  listPlannedBetweenExcludingStatuses.mockResolvedValue([]);
  listStatusAndPhase.mockResolvedValue([]);
  listOpenRisks.mockResolvedValue([]);
  listOpenIssues.mockResolvedValue([]);
  listMilestones.mockResolvedValue([]);
  listEpicActivityIds.mockResolvedValue([]);
  listForProjectReport.mockResolvedValue([]);
  risksNotClosed.mockResolvedValue([]);
  issuesNotClosed.mockResolvedValue([]);
  maxSnapshotDate.mockResolvedValue(null);
  snapshotDateOnOrBefore.mockResolvedValue(null);
  countsBySnapshot.mockResolvedValue([]);
  teamForReport.mockResolvedValue([]);
  companyRagConfig.mockResolvedValue(null);
  getProjectWithCustomer.mockResolvedValue({ id: 7, name: 'P', company_id: 5, current_phase: 'Execution' });
  getProjectForReport.mockResolvedValue({
    id: 7, name: 'P', company_id: 5, current_phase: 'Execution',
    start_date: '2026-01-01', end_date: '2026-12-31',
  });
});

describe('getWeeklyProjectReport', () => {
  it('asserts access before any repository call', async () => {
    await getWeeklyProjectReport(7, owner, { start: '2026-06-01', end: '2026-06-07' });
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(getProjectWithCustomer).toHaveBeenCalledWith(7);
  });

  it('does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(getWeeklyProjectReport(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(getProjectWithCustomer).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenError for a cross-company actor', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(getWeeklyProjectReport(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('getProjectReport', () => {
  it('asserts access before any repository call', async () => {
    await getProjectReport(7, owner, {});
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(getProjectForReport).toHaveBeenCalledWith(7);
  });

  it('does not call repositories when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(getProjectReport(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(getProjectForReport).not.toHaveBeenCalled();
  });

  it('propagates ForbiddenError for a cross-company actor', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(getProjectReport(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('resolves RAG config from project.company_id, not actor.company_id (behavior freeze)', async () => {
    // Project belongs to company 42; actor is company 5 — config must still load for 42.
    getProjectForReport.mockResolvedValue({
      id: 7, name: 'P', company_id: 42, current_phase: 'Execution',
      start_date: '2026-01-01', end_date: '2026-12-31',
    });
    await getProjectReport(7, owner, {});
    expect(companyRagConfig).toHaveBeenCalledWith(42);
    expect(companyRagConfig).not.toHaveBeenCalledWith(5);
  });
});
