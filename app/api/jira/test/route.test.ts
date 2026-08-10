import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ getSessionFromRequest: vi.fn() }));
vi.mock('@/lib/repositories/jira-config.repo', () => ({ companyJiraConfig: vi.fn() }));
vi.mock('@/lib/integrations/jira/client', () => ({ testConnection: vi.fn() }));

import { getSessionFromRequest } from '@/lib/auth';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { testConnection } from '@/lib/integrations/jira/client';
import { IntegrationError } from '@/lib/integrations/errors';
import { GET, POST } from './route';

const session = {
  id: 7,
  username: 'pm1',
  display_name: 'PM One',
  company_id: 3,
  company_name: 'Acme',
  is_admin: 0,
};

const admin = { ...session, is_admin: 1 };

function getReq(url = 'http://localhost/api/jira/test') {
  return new NextRequest(url);
}

function postReq(body: unknown) {
  return new NextRequest('http://localhost/api/jira/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.mocked(getSessionFromRequest).mockReset();
  vi.mocked(companyJiraConfig).mockReset();
  vi.mocked(testConnection).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('GET/POST /api/jira/test', () => {
  it('returns 401 when there is no session', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(null);

    const res = await GET(getReq());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'Chưa đăng nhập' });
  });

  it('returns 503 with the config-missing string when DB config is absent', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue(undefined);

    const res = await GET(getReq());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: 'Công ty chưa được cấu hình Jira. Admin vào Quản trị → Companies → Cấu hình Jira.',
    });
  });

  it('returns 503 with the missing-var diagnostic listing unset env names', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue({
      base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN',
    });
    vi.stubEnv('JIRA_BASE', undefined);
    vi.stubEnv('JIRA_EMAIL', 'e@x');
    vi.stubEnv('JIRA_TOKEN', undefined);

    const res = await GET(getReq());

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: 'Biến môi trường chưa được set trên Railway: JIRA_BASE, JIRA_TOKEN',
      missing: ['JIRA_BASE', 'JIRA_TOKEN'],
    });
    expect(testConnection).not.toHaveBeenCalled();
  });

  it('admin POST with body-supplied var names uses the explicit config and never reads companyJiraConfig', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(admin as never);
    vi.stubEnv('NEW_BASE', 'https://pm.atlassian.net');
    vi.stubEnv('NEW_EMAIL', 'a@b');
    vi.stubEnv('NEW_TOKEN', 'tok');
    vi.mocked(testConnection).mockResolvedValue({ displayName: 'D', emailAddress: 'a@b', accountId: 'id' });

    const res = await POST(postReq({
      companyId: 99,
      base_url_var: 'NEW_BASE',
      email_var: 'NEW_EMAIL',
      token_var: 'NEW_TOKEN',
    }));

    expect(companyJiraConfig).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      displayName: 'D',
      email: 'a@b',
      accountId: 'id',
      baseUrl: 'https://pm.atlassian.net',
    });
  });

  it('returns 200 with displayName/email/accountId/baseUrl on success', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue({
      base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN',
    });
    vi.stubEnv('JIRA_BASE', 'https://pm.atlassian.net/');
    vi.stubEnv('JIRA_EMAIL', 'e@x');
    vi.stubEnv('JIRA_TOKEN', 'tok');
    vi.mocked(testConnection).mockResolvedValue({ displayName: 'D', emailAddress: 'e@x', accountId: 'a' });

    const res = await GET(getReq());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      displayName: 'D',
      email: 'e@x',
      accountId: 'a',
      baseUrl: 'https://pm.atlassian.net',
    });
  });

  it('passes through the upstream status and message when testConnection throws upstream', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue({
      base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN',
    });
    vi.stubEnv('JIRA_BASE', 'https://pm.atlassian.net');
    vi.stubEnv('JIRA_EMAIL', 'e@x');
    vi.stubEnv('JIRA_TOKEN', 'tok');
    vi.mocked(testConnection).mockRejectedValue(new IntegrationError({
      kind: 'upstream', service: 'jira', status: 401, message: 'Unauthorized',
    }));

    const res = await GET(getReq());

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'Unauthorized' });
  });

  it('echoes the raw upstream error body on upstream failure (WR-04, deliberate leak)', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue({
      base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN',
    });
    vi.stubEnv('JIRA_BASE', 'https://pm.atlassian.net');
    vi.stubEnv('JIRA_EMAIL', 'e@x');
    vi.stubEnv('JIRA_TOKEN', 'tok');
    vi.mocked(testConnection).mockRejectedValue(new IntegrationError({
      kind: 'upstream', service: 'jira', status: 400, message: 'com.atlassian.jira: Field \'customfield_10014\' does not exist',
    }));

    const res = await GET(getReq());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: 'com.atlassian.jira: Field \'customfield_10014\' does not exist',
    });
  });

  it('maps a network failure to 500 with the Lỗi kết nối prefix and never raw upstream text', async () => {
    vi.mocked(getSessionFromRequest).mockResolvedValue(session as never);
    vi.mocked(companyJiraConfig).mockResolvedValue({
      base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN',
    });
    vi.stubEnv('JIRA_BASE', 'https://pm.atlassian.net');
    vi.stubEnv('JIRA_EMAIL', 'e@x');
    vi.stubEnv('JIRA_TOKEN', 'tok');
    vi.mocked(testConnection).mockRejectedValue(new IntegrationError({
      kind: 'network', service: 'jira',
    }));

    const res = await GET(getReq());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'Lỗi kết nối: IntegrationError[jira:network]' });
  });
});
