import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { projectAccessRow, getProjectPmIdentity, createMessage, resolveAnthropicCredentials } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  createMessage: vi.fn(),
  resolveAnthropicCredentials: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  projectAccessRow,
  getProjectPmIdentity,
}));
vi.mock('@/lib/integrations/credentials', () => ({ resolveAnthropicCredentials }));
vi.mock('@/lib/integrations/anthropic/client', () => ({ createMessage }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

/**
 * Route-level proof that Viewer-only actors receive 403 on AI report POST
 * without calling Anthropic (D-15, D-19, AUTH-05).
 */
describe('POST /api/projects/[id]/report access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
    resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'sk-test' });
    createMessage.mockResolvedValue({ text: 'report body' });
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  const emptyReportData = {
    project: { name: 'P', customer_name: 'C', current_phase: 'Execution' },
    weekRange: { start: '2026-06-01', end: '2026-06-07' },
    doneThisWeek: [],
    inProgress: [],
    nextWeekPlan: [],
    openRisks: [],
    openIssues: [],
    stats: { completion_pct: 0, done: 0, inProgress: 0, notStarted: 0, total: 0 },
    epicStats: [],
  };

  function req(body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/report', {
      method: 'POST',
      body: JSON.stringify(body ?? { reportData: emptyReportData, language: 'English' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const viewerSession = {
    id: 2,
    username: 'view',
    display_name: 'Viewer',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
    roles: ['viewer'],
    status: 'active',
    email: 'view@example.com',
  };

  it('returns 403 Forbidden for a viewer-only in-company actor on POST', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(viewerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(createMessage).not.toHaveBeenCalled();
    expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
  });
});
