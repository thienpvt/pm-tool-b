import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationError } from '@/lib/integrations/errors';

const { projectAccessRow, createMessage, resolveAnthropicCredentials } = vi.hoisted(() => ({
  projectAccessRow: vi.fn(),
  createMessage: vi.fn(),
  resolveAnthropicCredentials: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/projects.repo', () => ({ projectAccessRow }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveAnthropicCredentials }));
vi.mock('@/lib/integrations/anthropic/client', () => ({ createMessage }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

/**
 * Route-level proof of the project-access gate on the generate-email route
 * (06-03: previously raw getSessionFromRequest, no test file). Mocks sit at
 * the repository/integration boundary — same convention as
 * app/api/projects/[id]/risks/route.test.ts.
 */
describe('POST /api/projects/[id]/project-report/generate-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const params = (id = '7') => ({ params: Promise.resolve({ id }) });

  function req(body?: unknown) {
    return new NextRequest('http://localhost/api/projects/7/project-report/generate-email', {
      method: 'POST',
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
  };

  const foreignSession = { ...ownerSession, company_id: 9, username: 'bob' };

  const validBody = {
    reportData: { project: { name: 'Acme Rollout', rag: 'green' }, periodStart: '2026-06-01', periodEnd: '2026-06-30' },
    promptInstruction: 'Write a summary email',
    language: 'English',
  };

  it('returns 401 with no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);
    const res = await POST(req(validBody), params());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(projectAccessRow).not.toHaveBeenCalled();
    expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-company project', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(foreignSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });

    const res = await POST(req(validBody), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: 'Forbidden' });
    expect(resolveAnthropicCredentials).not.toHaveBeenCalled();
  });

  it('calls the Anthropic client and returns subject/emailHtml for an owner', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'k' });
    createMessage.mockResolvedValue({ text: 'Subject: Status Update\n---\n<div>Email body</div>' });

    const res = await POST(req(validBody), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ subject: 'Status Update', emailHtml: '<div>Email body</div>' });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it('an Anthropic upstream error maps to 502 (this route never sets force500)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    projectAccessRow.mockResolvedValue({ company_id: 5, customer_company_id: null });
    resolveAnthropicCredentials.mockResolvedValue({ apiKey: 'k' });
    createMessage.mockRejectedValue(
      new IntegrationError({ kind: 'upstream', service: 'anthropic', status: 500 }),
    );

    const res = await POST(req(validBody), params());

    expect(res.status).toBe(502);
  });
});
