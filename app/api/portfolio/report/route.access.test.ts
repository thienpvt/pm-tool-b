import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMessage, resolveAnthropicCredentials } = vi.hoisted(() => ({
  createMessage: vi.fn(),
  resolveAnthropicCredentials: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveAnthropicCredentials }));
vi.mock('@/lib/integrations/anthropic/client', () => ({ createMessage }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

/**
 * Route-level proof that Viewer-only actors receive 403 on portfolio AI POST
 * without calling Anthropic (D-13, D-15, D-19, AUTH-05).
 */
describe('POST /api/portfolio/report access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'sk-test' });
    createMessage.mockResolvedValue({ text: 'portfolio report' });
  });

  const portfolioPayload = {
    reportDate: '2026-06-01',
    kpi: {
      totalProjects: 1,
      totalPrograms: 1,
      avgCompletion: 50,
      activeProjects: 1,
      totalOpenRisks: 0,
      totalOpenIssues: 0,
    },
    programs: [],
    noProgramProjects: [],
    language: 'English',
  };

  function req(body?: unknown) {
    return new NextRequest('http://localhost/api/portfolio/report', {
      method: 'POST',
      body: JSON.stringify(body ?? { portfolioData: portfolioPayload }),
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

    const res = await POST(req());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(createMessage).not.toHaveBeenCalled();
    expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
  });
});
