import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/lib/integrations/errors';

const { projectAccessRow, hasActivePmAssignment, createMessage, resolveAnthropicCredentials } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  hasActivePmAssignment: vi.fn(),
  createMessage: vi.fn(),
  resolveAnthropicCredentials: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/modules/projects/backend/repositories/projects.repo', () => ({
  projectAccessRow,
  getProjectWithCustomer: vi.fn().mockResolvedValue({ id: 7, name: 'P', company_id: 5, current_phase: 'Execution' }),
}));
vi.mock('@/modules/projects/backend/repositories/pm-assignments.repo', () => ({ hasActivePmAssignment }));
vi.mock('@/modules/projects/backend/repositories/activities.repo', () => ({
  listDoneBetween: vi.fn().mockResolvedValue([]),
  listByStatuses: vi.fn().mockResolvedValue([]),
  listPlannedBetweenExcludingStatuses: vi.fn().mockResolvedValue([]),
  listStatusAndPhase: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/modules/projects/backend/repositories/risks.repo', () => ({ listOpenRisks: vi.fn().mockResolvedValue([]) }));
vi.mock('@/modules/projects/backend/repositories/issues.repo', () => ({ listOpenIssues: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveAnthropicCredentials }));
vi.mock('@/lib/integrations/anthropic/client', () => ({ createMessage }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * Route-level proof of the project-access gate on the weekly report route
 * (06-03: previously raw getSessionFromRequest, no test file). Mocks sit at
 * the repository/integration boundary so the real service and the real
 * assertProjectAccess logic run under test — same convention as
 * app/api/projects/[id]/risks/route.test.ts.
 */
describe('GET/POST /api/projects/[id]/report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasActivePmAssignment.mockResolvedValue(true);
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/projects/7/report', body?: unknown) {
    return new NextRequest(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
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
    roles: ['pm'],
    status: 'active',
    email: 'ava@example.com',
  };

  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  const validPostBody = {
    reportData: {
      project: { name: 'Acme Rollout', customer_name: 'Acme' },
      weekRange: { start: '2026-06-01', end: '2026-06-07' },
      doneThisWeek: [],
      inProgress: [],
      nextWeekPlan: [],
      openRisks: [],
      openIssues: [],
      stats: { completion_pct: 50, done: 1, inProgress: 1, notStarted: 0, total: 2 },
      epicStats: [],
    },
  };

  describe('GET', () => {
    it('returns 401 with no session', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const res = await GET(req('GET'), params());
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(projectAccessRow).not.toHaveBeenCalled();
    });

    it('returns 403 for a cross-company project', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

      const res = await GET(req('GET'), params());

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    });

    it('returns 200 with the report shape for an owner', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

      const res = await GET(req('GET'), params());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({
        project: { id: 7, name: 'P' },
        weekRange: { start: expect.any(String), end: expect.any(String) },
        doneThisWeek: [],
        inProgress: [],
        nextWeekPlan: [],
        openRisks: [],
        openIssues: [],
        stats: expect.objectContaining({ total: 0 }),
        epicStats: [],
      });
    });
  });

  describe('POST', () => {
    it('returns 401 with no session', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(null);
      const res = await POST(req('POST', undefined, validPostBody), params());
      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
      expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
    });

    it('returns 403 for a cross-company project', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

      const res = await POST(req('POST', undefined, validPostBody), params());

      expect(res.status).toBe(403);
      expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
    });

    it('calls the Anthropic client and returns the generated report for an owner', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
      resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'k' });
      createMessage.mockResolvedValue({ text: 'Weekly report text' });

      const res = await POST(req('POST', undefined, validPostBody), params());

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ report: 'Weekly report text' });
      expect(createMessage).toHaveBeenCalledTimes(1);
    });

    it('force500 preserved: an Anthropic upstream error still maps to 500', async () => {
      vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
      projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
      resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'k' });
      createMessage.mockRejectedValue(
        new IntegrationError({ kind: 'upstream', service: 'anthropic', status: 500 }),
      );

      const res = await POST(req('POST', undefined, validPostBody), params());

      expect(res.status).toBe(500);
    });
  });
});
