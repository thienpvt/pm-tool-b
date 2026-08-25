import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { createJqlPreset, deleteJqlPreset, listJqlPresets, setCompanyJiraConfig } from './jira-config.repo';

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

    await expect(createJqlPreset(7, 'Open bugs', 'status != Done', 'bugs', 3)).resolves.toEqual({
      id: 4,
      name: 'Open bugs',
    });

    expect(db.run).toHaveBeenCalledWith(
      'DELETE FROM jira_jql_presets WHERE id = ? AND company_id = ?',
      1,
      7,
    );
    expect(db.get).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO jira_jql_presets'),
      'Open bugs',
      'status != Done',
      'bugs',
      7,
    );
  });

  it('listJqlPresets filters by company_id and context', async () => {
    await listJqlPresets(5, 'timeline');
    const sql = db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
    expect(sql).toContain('WHERE company_id = ?');
    expect(sql).toContain('context = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5, 'timeline');
  });

  it('deleteJqlPreset filters by company_id', async () => {
    await deleteJqlPreset(5, 12);
    expect(db.run).toHaveBeenCalledWith(
      'DELETE FROM jira_jql_presets WHERE id = ? AND company_id = ?',
      12,
      5,
    );
  });
});
