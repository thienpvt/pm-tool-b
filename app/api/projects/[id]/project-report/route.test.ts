import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/lib/integrations/errors';

const {
  projectAccessRow,
  getProjectPmIdentity,
  createMessage,
  resolveAnthropicCredentials,
} = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  getProjectPmIdentity: vi.fn(),
  createMessage: vi.fn(),
  resolveAnthropicCredentials: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({
  projectAccessRow,
  getProjectPmIdentity,
  getProjectForReport: vi.fn().mockResolvedValue({
    id: 7, name: 'P', company_id: 5, current_phase: 'Execution',
    start_date: '2026-01-01', end_date: '2026-12-31',
  }),
}));
vi.mock('@/lib/repositories/activities.repo', () => ({
  listForProjectReport: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/milestones.repo', () => ({
  listMilestones: vi.fn().mockResolvedValue([]),
  listEpicActivityIds: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/bugs.repo', () => ({
  maxSnapshotDate: vi.fn().mockResolvedValue(null),
  snapshotDateOnOrBefore: vi.fn().mockResolvedValue(null),
  countsBySnapshot: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listOpenRisks: vi.fn().mockResolvedValue([]),
  listNotClosedByPriority: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/issues.repo', () => ({
  listOpenIssues: vi.fn().mockResolvedValue([]),
  listNotClosedByPriority: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/team.repo', () => ({
  listForReport: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/repositories/rag-config.repo', () => ({
  companyRagConfig: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/integrations/credentials', () => ({ resolveAnthropicCredentials }));
vi.mock('@/lib/integrations/anthropic/client', () => ({ createMessage }));

import { getSessionFromRequest } from '@/lib/auth';
import { GET, POST } from './route';

/**
 * Route-level proof of the project-access gate on the full project-report
 * route (06-03: previously raw getSessionFromRequest, no test file). Mocks
 * sit at the repository/integration boundary so the real service and the
 * real assertProjectAccess logic run under test — same convention as
 * app/api/projects/[id]/risks/route.test.ts.
 */
describe('GET/POST /api/projects/[id]/project-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectPmIdentity.mockResolvedValue({ pm_name: 'Ava', pm_email: 'ava@example.com' });
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(method: string, url = 'http://localhost/api/projects/7/project-report', body?: unknown) {
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
      project: { name: 'Acme Rollout', customer_name: 'Acme', current_phase: 'Execution', rag: 'green' },
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      stats: { completion_pct: 50, done: 1, inProgress: 1, notStarted: 0, total: 2 },
      epicStats: [],
      completedInPeriod: [],
      upcomingActivities: [],
      openRisks: [],
      openIssues: [],
      bugStats: null,
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
        project: expect.objectContaining({ id: 7, name: 'P' }),
        milestones: [],
        periodStart: expect.any(String),
        periodEnd: expect.any(String),
        stats: expect.objectContaining({ total: 0 }),
        epicStats: [],
        completedInPeriod: [],
        upcomingActivities: [],
        openRisks: [],
        openIssues: [],
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
      createMessage.mockResolvedValue({ text: 'Project report text' });

      const res = await POST(req('POST', undefined, validPostBody), params());

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ report: 'Project report text' });
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
