import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import {
  companyJiraConfig,
  listJqlPresets,
  setCompanyJiraConfig,
} from './jira-config.repo';

describe.skipIf(!hasTestDb)('jira-config.repo', () => {
  let companyId: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyId = await seedCompany(`jira-config-${Date.now()}`);
    await testDb().run('DELETE FROM company_jira_config WHERE company_id = ?', companyId);
    await testDb().run('DELETE FROM jira_jql_presets WHERE company_id = ?', companyId);
  });

  it('round-trips setCompanyJiraConfig and companyJiraConfig', async () => {
    await setCompanyJiraConfig(companyId, {
      base_url_var: 'JIRA_BASE_URL',
      email_var: 'JIRA_EMAIL',
      token_var: 'JIRA_TOKEN',
    });
    const cfg = await companyJiraConfig(companyId);
    expect(cfg).toEqual({
      base_url_var: 'JIRA_BASE_URL',
      email_var: 'JIRA_EMAIL',
      token_var: 'JIRA_TOKEN',
    });
  });

  it('listJqlPresets returns presets for company and context', async () => {
    await testDb().run(
      'INSERT INTO jira_jql_presets (name, jql, context, company_id) VALUES (?, ?, ?, ?)',
      'Sprint bugs',
      'project = ABC',
      'bugs',
      companyId,
    );
    const presets = await listJqlPresets(companyId, 'bugs');
    expect(presets.some(p => p.name === 'Sprint bugs')).toBe(true);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await companyJiraConfig(companyId);
    expect(getKysely).toHaveBeenCalled();
  });
});
