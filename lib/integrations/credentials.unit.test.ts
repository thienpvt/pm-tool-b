import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { companyJiraConfig, getSetting } = vi.hoisted(() => ({
  companyJiraConfig: vi.fn(),
  getSetting: vi.fn(),
}));

vi.mock('@/lib/repositories/jira-config.repo', () => ({ companyJiraConfig }));
vi.mock('@/lib/repositories/settings.repo', () => ({ getSetting }));

import { resolveAnthropicCredentials, resolveJiraCredentials, resolveResendCredentials } from './credentials';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveJiraCredentials', () => {
  it('resolves three env names from the DB config and strips the baseUrl trailing slash', async () => {
    vi.stubEnv('JIRA_BASE', 'https://tenant.atlassian.net/');
    vi.stubEnv('JIRA_EMAIL', 'a@b.com');
    vi.stubEnv('JIRA_TOKEN', 'tok');
    companyJiraConfig.mockResolvedValue({ base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN' });

    await expect(resolveJiraCredentials(7)).resolves.toEqual({
      baseUrl: 'https://tenant.atlassian.net',
      email: 'a@b.com',
      token: 'tok',
    });
    expect(companyJiraConfig).toHaveBeenCalledWith(7);
  });

  it('returns null when any env var name is missing from process.env', async () => {
    vi.stubEnv('JIRA_BASE', 'https://x.atlassian.net');
    vi.stubEnv('JIRA_EMAIL', 'a@b.com');
    // JIRA_TOKEN unset
    companyJiraConfig.mockResolvedValue({ base_url_var: 'JIRA_BASE', email_var: 'JIRA_EMAIL', token_var: 'JIRA_TOKEN' });

    await expect(resolveJiraCredentials(7)).resolves.toBeNull();
  });

  it('returns null when the company config row is missing or incomplete', async () => {
    companyJiraConfig.mockResolvedValue(null);
    await expect(resolveJiraCredentials(7)).resolves.toBeNull();
    companyJiraConfig.mockResolvedValue({ base_url_var: 'JIRA_BASE', email_var: '', token_var: 'JIRA_TOKEN' });
    await expect(resolveJiraCredentials(7)).resolves.toBeNull();
  });

  it('uses explicit env var names and never calls companyJiraConfig (admin test path)', async () => {
    vi.stubEnv('X', 'https://y.atlassian.net');
    vi.stubEnv('E', 'e@b.com');
    vi.stubEnv('T', 't');

    await expect(resolveJiraCredentials(7, { base_url_var: 'X', email_var: 'E', token_var: 'T' }))
      .resolves.toEqual({ baseUrl: 'https://y.atlassian.net', email: 'e@b.com', token: 't' });
    expect(companyJiraConfig).not.toHaveBeenCalled();
  });
});

describe('resolveAnthropicCredentials', () => {
  it('prefers the env var over the DB setting', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-key');
    getSetting.mockResolvedValue('db-key');

    await expect(resolveAnthropicCredentials()).resolves.toEqual({ apiKey: 'env-key' });
    expect(getSetting).not.toHaveBeenCalled();
  });

  it('falls back to the DB setting when the env var is absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    getSetting.mockResolvedValue('db-key');

    await expect(resolveAnthropicCredentials()).resolves.toEqual({ apiKey: 'db-key' });
    expect(getSetting).toHaveBeenCalledWith('anthropic_api_key');
  });

  it('treats an empty-string env var as unset and falls back to the DB setting (INTG-08)', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    getSetting.mockResolvedValue('db-key');

    await expect(resolveAnthropicCredentials()).resolves.toEqual({ apiKey: 'db-key' });
  });

  it('returns null when both env and DB are absent', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    getSetting.mockResolvedValue(undefined);

    await expect(resolveAnthropicCredentials()).resolves.toBeNull();
  });
});

describe('resolveResendCredentials', () => {
  it('returns the key from the env var', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_key');

    await expect(resolveResendCredentials()).resolves.toEqual({ apiKey: 're_key' });
  });

  it('returns null when the env var is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', undefined);

    await expect(resolveResendCredentials()).resolves.toBeNull();
  });
});
