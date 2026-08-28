import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  getWeeklyReportFullRow,
  getLatestVersionSnapshot,
  openCorrectionOnShell,
  getWeeklyReportWithPeriod,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  getWeeklyReportFullRow: vi.fn(),
  getLatestVersionSnapshot: vi.fn(),
  openCorrectionOnShell: vi.fn(),
  getWeeklyReportWithPeriod: vi.fn(),
  updatePrevWeekRag: vi.fn(),
  getPriorPeriodSubmittedRag: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', () => ({
  getWeeklyReportFullRow,
  getLatestVersionSnapshot,
  openCorrectionOnShell,
  getWeeklyReportWithPeriod,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from '@/app/api/projects/[id]/weekly-reports/[reportId]/correct/route';

describe('POST /api/projects/[id]/weekly-reports/[reportId]/correct', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
    getPriorPeriodSubmittedRag.mockResolvedValue(null);
    updatePrevWeekRag.mockResolvedValue(undefined);
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
    status: 'submitted',
    first_submitted_at: '2026-01-08T12:00:00.000Z',
    first_lateness: 'on_time',
    latest_version: 1,
    correction_open: false,
    highlights: 'old',
    completed_work: null,
    next_week_goals: null,
    nearest_milestone: null,
    nearest_milestone_id: null,
    raid_dependency: null,
    leadership_support: null,
    this_week_rag: 'Green',
    prev_week_rag: 'Amber',
    draft_raid_json: null,
  };

  it('opens correction overlay and returns shell (D-08, D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportFullRow.mockResolvedValue(shell);
    getLatestVersionSnapshot.mockResolvedValue({
      highlights: 'snap',
      completed_work: null,
      next_week_goals: null,
      nearest_milestone: { text: null, milestone_id: null },
      raid_dependency: null,
      leadership_support: null,
      this_week_rag: 'Green',
      draft_raid_json: null,
    });
    openCorrectionOnShell.mockResolvedValue({ ...shell, correction_open: true });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...shell,
      correction_open: true,
      iso_week: '2026-W02',
      due_at: '2026-01-09T18:00:00.000Z',
      display_name: '2026-W02',
      company_id: 5,
    });

    const res = await POST(
      new NextRequest('http://localhost/api/projects/7/weekly-reports/10/correct', {
        method: 'POST',
        body: JSON.stringify({ highlights: 'overlay' }),
        headers: { 'Content-Type': 'application/json' },
      }),
      params(),
    );

    expect(res.status).toBe(200);
    expect(openCorrectionOnShell).toHaveBeenCalled();
    const json = await res.json();
    expect(json.correction_open).toBe(true);
  });
});
