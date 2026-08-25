import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/export/weekly-report/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  const reportBody = {
    report: 'WEEKLY STATUS',
    reportData: {
      project: {
        name: 'Alpha',
        customer_name: 'Acme',
        client: 'Acme',
        current_phase: 'Development',
        pm_name: 'Ava',
      },
      weekRange: { start: '2025-01-01', end: '2025-01-07' },
      doneThisWeek: [],
      inProgress: [],
      nextWeekPlan: [],
      openRisks: [],
      openIssues: [],
      stats: { total: 0, done: 0, completion_pct: 0 },
    },
    startDate: '2025-01-01',
    endDate: '2025-01-07',
    language: 'English',
  };

  function req(body: unknown = reportBody) {
    return new NextRequest('http://localhost/api/export/weekly-report/7', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
  };
  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req(), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
  });

  it('returns 200 with original Content-Type for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers.get('Content-Disposition')).toContain('WeeklyReport_Alpha_2025-01-01.xlsx');
  });
});
