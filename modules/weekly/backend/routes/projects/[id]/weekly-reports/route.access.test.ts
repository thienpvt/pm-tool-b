import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listProjectWeeklyHistoryRepo,
  getWeeklyReportFullRow,
  getWeeklyReportWithPeriod,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  insertWeeklyReportVersion,
  finalizeWeeklyReportSubmit,
  openCorrectionOnShell,
  getLatestVersionSnapshot,
  getProjectRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listProjectWeeklyHistoryRepo: vi.fn(),
  getWeeklyReportFullRow: vi.fn(),
  getWeeklyReportWithPeriod: vi.fn(),
  updateWeeklyReportDraft: vi.fn(),
  updatePrevWeekRag: vi.fn(),
  getPriorPeriodSubmittedRag: vi.fn(),
  insertWeeklyReportVersion: vi.fn(),
  finalizeWeeklyReportSubmit: vi.fn(),
  openCorrectionOnShell: vi.fn(),
  getLatestVersionSnapshot: vi.fn(),
  getProjectRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  projectAccessRow,
  getProject: getProjectRepo,
}));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', () => ({
  listProjectWeeklyHistoryRepo,
  getWeeklyReportFullRow,
  getWeeklyReportWithPeriod,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  insertWeeklyReportVersion,
  finalizeWeeklyReportSubmit,
  openCorrectionOnShell,
  getLatestVersionSnapshot,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from '@/app/api/projects/[id]/weekly-reports/route';
import { PATCH } from '@/app/api/projects/[id]/weekly-reports/[reportId]/route';
import { POST as submitPost } from '@/app/api/projects/[id]/weekly-reports/[reportId]/submit/route';
import { POST as correctPost } from '@/app/api/projects/[id]/weekly-reports/[reportId]/correct/route';

const baseShell = {
  id: 10,
  period_id: 1,
  project_id: 7,
  status: 'draft',
  first_submitted_at: null,
  first_lateness: null,
  latest_version: 0,
  correction_open: false,
  highlights: null,
  completed_work: null,
  next_week_goals: null,
  nearest_milestone: null,
  nearest_milestone_id: null,
  raid_dependency: null,
  leadership_support: null,
  this_week_rag: 'Green',
  prev_week_rag: 'Amber',
  draft_raid_json: null,
  iso_week: '2026-W02',
  due_at: '2026-01-09T18:00:00.000Z',
  display_name: '2026-W02',
  company_id: 5,
};

describe('weekly-reports access matrix (D-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getPriorPeriodSubmittedRag.mockResolvedValue('Amber');
    updatePrevWeekRag.mockResolvedValue(undefined);
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 0 });
  });

  const projectParams = (id = '7') => ({ params: Promise.resolve({ id }) });
  const reportParams = (id = '7', reportId = '10') => ({
    params: Promise.resolve({ id, reportId }),
  });

  const pmSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    roles: ['pm'],
    status: 'active',
    email: 'ava@example.com',
  };

  const viewerSession = {
    ...pmSession,
    id: 3,
    username: 'viewer',
    roles: ['viewer'],
  };

  const cpmoSession = {
    ...pmSession,
    id: 1,
    username: 'cpmo',
    roles: ['cpmo'],
  };

  it('Viewer PATCH returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);

    const res = await PATCH(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10', {
        method: 'PATCH',
        body: JSON.stringify({ highlights: 'hi' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      reportParams(),
    );

    expect(res.status).toBe(403);
    expect(updateWeeklyReportDraft).not.toHaveBeenCalled();
  });

  it('Viewer submit returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);

    const res = await submitPost(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/submit', {
        method: 'POST',
      }),
      reportParams(),
    );

    expect(res.status).toBe(403);
    expect(insertWeeklyReportVersion).not.toHaveBeenCalled();
  });

  it('Viewer correct returns 403', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);

    const res = await correctPost(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/correct', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
      reportParams(),
    );

    expect(res.status).toBe(403);
    expect(openCorrectionOnShell).not.toHaveBeenCalled();
  });

  it('PM without assignment returns 403 on PATCH', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    hasActivePmAssignment.mockResolvedValue(false);

    const res = await PATCH(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10', {
        method: 'PATCH',
        body: JSON.stringify({ highlights: 'hi' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      reportParams(),
    );

    expect(res.status).toBe(403);
    expect(hasActivePmAssignment).toHaveBeenCalled();
    expect(updateWeeklyReportDraft).not.toHaveBeenCalled();
  });

  it('PM without assignment returns 403 on submit', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    hasActivePmAssignment.mockResolvedValue(false);

    const res = await submitPost(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/submit', {
        method: 'POST',
      }),
      reportParams(),
    );

    expect(res.status).toBe(403);
    expect(insertWeeklyReportVersion).not.toHaveBeenCalled();
  });

  it('CPMO GET history returns 200 without assignment check (D-13)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(cpmoSession as never);
    listProjectWeeklyHistoryRepo.mockResolvedValue([
      {
        display_name: '2026-W01',
        iso_week: '2026-W01',
        status: 'submitted',
        due_at: '2026-01-02T18:00:00.000Z',
        first_lateness: 'on_time',
        latest_version: 1,
        report_id: 1,
        period_id: 1,
        rag: 'Green',
        submitted_at: '2026-01-02T10:00:00.000Z',
        submitted_by: 2,
      },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/projects/7/weekly-reports'),
      projectParams(),
    );

    expect(res.status).toBe(200);
    expect(hasActivePmAssignment).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json).toHaveLength(1);
  });
});
