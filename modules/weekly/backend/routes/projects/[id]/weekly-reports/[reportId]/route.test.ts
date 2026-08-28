import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  getWeeklyReportWithPeriod,
  getWeeklyReportFullRow,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  getProjectRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  getWeeklyReportWithPeriod: vi.fn(),
  getWeeklyReportFullRow: vi.fn(),
  updateWeeklyReportDraft: vi.fn(),
  updatePrevWeekRag: vi.fn(),
  getPriorPeriodSubmittedRag: vi.fn(),
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
  getWeeklyReportWithPeriod,
  getWeeklyReportFullRow,
  updateWeeklyReportDraft,
  updatePrevWeekRag,
  getPriorPeriodSubmittedRag,
  getWeeklyReportFullRow: getWeeklyReportFullRow,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, PATCH } from '@/app/api/projects/[id]/weekly-reports/[reportId]/route';

describe('GET/PATCH /api/projects/[id]/weekly-reports/[reportId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
    getPriorPeriodSubmittedRag.mockResolvedValue(null);
    getProjectRepo.mockResolvedValue({ rag: 'Green' });
    updatePrevWeekRag.mockResolvedValue(undefined);
  });

  const params = (id = '7', reportId = '10') => ({
    params: Promise.resolve({ id, reportId }),
  });

  function req(method: string, body?: unknown) {
    return new NextRequest(`http://localhost/api/projects/7/weekly-reports/10`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    });
  }

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
    status: 'not_submitted',
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
    this_week_rag: null,
    prev_week_rag: null,
    draft_raid_json: null,
    iso_week: '2026-W02',
    due_at: '2026-01-09T18:00:00.000Z',
    display_name: '2026-W02',
    company_id: 5,
  };

  it('PATCH as assigned PM returns updated shell (D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportFullRow.mockResolvedValue({ ...shell });
    updateWeeklyReportDraft.mockResolvedValue({ ...shell, status: 'draft', highlights: 'hi' });
    getWeeklyReportWithPeriod.mockResolvedValue({
      ...shell,
      status: 'draft',
      highlights: 'hi',
      prev_week_rag: 'Green',
    });

    const res = await PATCH(req('PATCH', { highlights: 'hi' }), params());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('draft');
    expect(json.highlights).toBe('hi');
    expect(hasActivePmAssignment).toHaveBeenCalled();
  });

  it('PATCH submitted without correction_open returns 409 (D-08, D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportFullRow.mockResolvedValue({
      ...shell,
      status: 'submitted',
      correction_open: false,
    });

    const res = await PATCH(req('PATCH', { highlights: 'nope' }), params());

    expect(res.status).toBe(409);
    expect(updateWeeklyReportDraft).not.toHaveBeenCalled();
  });

  it('GET returns shell with prev_week_rag', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getWeeklyReportWithPeriod.mockResolvedValue({ ...shell, prev_week_rag: 'Amber' });

    const res = await GET(req('GET'), params());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.prev_week_rag).toBe('Amber');
  });
});
