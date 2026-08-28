import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  projectAccessRow,
  hasActivePmAssignment,
  listProjectWeeklyHistoryRepo,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  listProjectWeeklyHistoryRepo: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/weekly/backend/repositories/weekly-reports.repo', () => ({
  listProjectWeeklyHistoryRepo,
}));

import { getSessionFromRequest } from '@/lib/auth';
import { GET } from '@/app/api/projects/[id]/weekly-reports/route';

describe('GET /api/projects/[id]/weekly-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

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

  it('returns history newest iso_week first (D-09, D-15)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(pmSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listProjectWeeklyHistoryRepo.mockResolvedValue([
      {
        display_name: '2026-W02',
        iso_week: '2026-W02',
        status: 'draft',
        due_at: '2020-01-01T00:00:00.000Z',
        first_lateness: null,
        latest_version: 0,
        report_id: 2,
        period_id: 2,
        rag: null,
        submitted_at: null,
        submitted_by: null,
      },
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
      params(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].iso_week).toBe('2026-W02');
    expect(json[0].overdue).toBe(true);
    expect(json[1].iso_week).toBe('2026-W01');
  });
});
