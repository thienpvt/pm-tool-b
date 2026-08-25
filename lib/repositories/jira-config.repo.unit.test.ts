import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { createJqlPreset, setCompanyJiraConfig } from './jira-config.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.run.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
});

describe('jira-config.repo', () => {
  it('upserts the id-less company config without reading a generated key', async () => {
    await expect(setCompanyJiraConfig(7, {
      base_url_var: ' JIRA_BASE_URL ',
      email_var: ' JIRA_EMAIL ',
      token_var: ' JIRA_TOKEN ',
    })).resolves.toBeUndefined();

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (company_id) DO UPDATE SET'),
      7,
      'JIRA_BASE_URL',
      'JIRA_EMAIL',
      'JIRA_TOKEN',
    );
    expect(db.get).not.toHaveBeenCalled();
  });

  it('evicts the oldest preset at the cap before inserting with RETURNING', async () => {
    db.all.mockResolvedValue([{ id: 3 }, { id: 2 }, { id: 1 }]);
    db.get.mockResolvedValue({ id: 4, name: 'Open bugs' });

    await expect(createJqlPreset('Open bugs', 'status != Done', 'bugs', 3)).resolves.toEqual({
      id: 4,
      name: 'Open bugs',
    });

    expect(db.run).toHaveBeenCalledWith('DELETE FROM jira_jql_presets WHERE id = ?', 1);
    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO jira_jql_presets'),
      'Open bugs',
      'status != Done',
      'bugs',
    );
  });
});
