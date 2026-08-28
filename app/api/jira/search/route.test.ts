import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveJiraCredentials, searchIssues } = vi.hoisted(() => ({
  resolveJiraCredentials: vi.fn(),
  searchIssues: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/integrations/credentials', () => ({ resolveJiraCredentials }));
vi.mock('@/lib/integrations/jira/client', () => ({ searchIssues }));

import { getSessionFromRequest } from '@/lib/auth';
import { POST } from './route';

describe('POST /api/jira/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const ownerSession = {
    id: 2,
    username: 'ava',
    display_name: 'Ava',
    company_id: 5,
    company_name: 'Acme',
    is_admin: 0,
    onboarding_completed: 1,
  };

  const jiraNotConfigured =
    'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.';

  const params = { params: Promise.resolve({}) };

  function req(body?: unknown, rawBody?: string) {
    return new NextRequest('http://localhost/api/jira/search', {
      method: 'POST',
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('returns 400 Invalid JSON for malformed POST body (D-03)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    resolveJiraCredentials.mockResolvedValue({ baseUrl: 'https://jira.example.com', email: 'a@b.c', token: 't' });

    const res = await POST(req(undefined, '{not json'), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid JSON' });
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it('returns 200 on success without dumping issue field payloads (JIRA-01)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    resolveJiraCredentials.mockResolvedValue({ baseUrl: 'https://jira.example.com', email: 'a@b.c', token: 't' });
    searchIssues.mockResolvedValue({
      issues: [{ fields: { summary: 'x', customfield_10001: 'secret' } }],
      total: 1,
      nextPageToken: undefined,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await POST(req({ jql: 'project = A' }), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      issues: [{ fields: { summary: 'x', customfield_10001: 'secret' } }],
      total: 1,
      nextPageToken: undefined,
    });
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('returns 401 when session company_id is null — searchIssues not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue({
      ...ownerSession,
      company_id: null,
    } as never);

    const res = await POST(req({ jql: 'project = A' }), params);

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Jira chưa được cấu hình');
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it('returns 503 when Jira credentials are missing — searchIssues not called', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    resolveJiraCredentials.mockResolvedValue(null);

    const res = await POST(req({ jql: 'project = A' }), params);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toContain('Jira chưa được cấu hình');
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it('returns 400 jql là bắt buộc for empty body', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    resolveJiraCredentials.mockResolvedValue({ baseUrl: 'https://jira.example.com', email: 'a@b.c', token: 't' });

    const res = await POST(req({}), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'jql là bắt buộc' });
    expect(searchIssues).not.toHaveBeenCalled();
  });

  it('returns 400 jql là bắt buộc for empty jql string', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(ownerSession as never);
    resolveJiraCredentials.mockResolvedValue({ baseUrl: 'https://jira.example.com', email: 'a@b.c', token: 't' });

    const res = await POST(req({ jql: '' }), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'jql là bắt buộc' });
    expect(searchIssues).not.toHaveBeenCalled();
  });
});
