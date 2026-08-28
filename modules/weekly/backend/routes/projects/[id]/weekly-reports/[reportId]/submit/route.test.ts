import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  getWeeklyReportWithPeriod,
  insertWeeklyReportVersion,
  lockWeeklyReportShell,
  finalizeWeeklyReportSubmit,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  getProjectRepo,
  getRiskRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  getWeeklyReportWithPeriod: vi.fn(),
  insertWeeklyReportVersion: vi.fn(),
  lockWeeklyReportShell: vi.fn(),
  finalizeWeeklyReportSubmit: vi.fn(),
  updatePrevWeekRag: vi.fn(),
  getPriorPeriodSubmittedRag: vi.fn(),
  getProjectRepo: vi.fn(),
  getRiskRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({ projectAccessRow, getProject: getProjectRepo }));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({ getRisk: getRiskRepo }));
vi.mock('@/lib/db', () => ({
  runInTransaction: async (fn: (client: unknown) => Promise<unknown>) => fn({}),
}));
vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', () => ({
  getWeeklyReportWithPeriod,
  insertWeeklyReportVersion,
  lockWeeklyReportShell,
  finalizeWeeklyReportSubmit,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from '@/app/api/projects/[id]/weekly-reports/[reportId]/submit/route';

describe('POST /api/projects/[id]/weekly-reports/[reportId]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
    getPriorPeriodSubmittedRag.mockResolvedValue('Amber');
    updatePrevWeekRag.mockResolvedValue(undefined);
    insertWeeklyReportVersion.mockResolvedValue({});
    lockWeeklyReportShell.mockResolvedValue({
      id: 10,
      latest_version: 0,
      status: 'draft',
      correction_open: false,
      first_submitted_at: null,
      first_lateness: null,
    });
    finalizeWeeklyReportSubmit.mockResolvedValue({});
    getProjectRepo.mockResolvedValue({ rag: 'Green', progress_pct: 0 });
  });

  const params = () => ({ params: Promise.resolve({ id: '7', reportId: '10' }) });

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

  const shell = {
    id: 10,
    period_id: 1,
    project_id: 7,
    status: 'draft',
    first_submitted_at: null,
    first_lateness: null,
    latest_version: 0,
    correction_open: false,
    highlights: 'hi',
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

  it('returns 201 on submit (D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportWithPeriod
      .mockResolvedValueOnce(shell)
      .mockResolvedValue({ ...shell, status: 'submitted', latest_version: 1 });

    const res = await POST(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/submit', {
        method: 'POST',
      }),
      params(),
    );

    expect(res.status).toBe(201);
    expect(insertWeeklyReportVersion).toHaveBeenCalled();
  });

  it('returns 400 with fields array on SubmitValidationError (D-11, RAID-03)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...shell,
      draft_raid_json: {
        risks: [{ id: 'new', fields: { description: '' } }],
        issues: [],
      },
    });

    const res = await POST(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/submit', {
        method: 'POST',
      }),
      params(),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toEqual(['raid.risks[0].description']);
    expect(body).not.toHaveProperty('field');
    expect(insertWeeklyReportVersion).not.toHaveBeenCalled();
  });
});
