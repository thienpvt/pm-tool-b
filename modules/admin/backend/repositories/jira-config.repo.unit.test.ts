import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const execute = vi.fn();
  const executeTakeFirstOrThrow = vi.fn();
  const returningAll = vi.fn(() => ({ executeTakeFirstOrThrow }));
  const onConflict = vi.fn(() => ({ doUpdateSet: vi.fn(() => ({ execute })) }));
  const doUpdateSet = vi.fn(() => ({ execute }));
  const onConflictFn = vi.fn((fn: (oc: { column: typeof columnFn; doUpdateSet: typeof doUpdateSet }) => unknown) => {
    const columnFn = vi.fn(() => ({ doUpdateSet }));
    return fn({ column: columnFn, doUpdateSet });
  });
  const values = vi.fn(() => ({ onConflict: onConflictFn, returningAll, execute }));
  const insertInto = vi.fn(() => ({ values }));
  const limit = vi.fn(() => ({ execute }));
  const orderBy = vi.fn(() => ({ limit, execute }));
  const whereSecond = vi.fn(() => ({ orderBy, execute }));
  const whereFirst = vi.fn(() => ({ where: whereSecond, orderBy, execute }));
  const selectAll = vi.fn(() => ({ where: whereFirst, orderBy, execute }));
  const select = vi.fn(() => ({ where: whereFirst, orderBy, execute }));
  const selectFrom = vi.fn(() => ({ selectAll, select, insertInto, deleteFrom: vi.fn(() => ({ where: whereFirst, execute })) }));
  const sqlExecute = vi.fn();
  return {
    execute,
    executeTakeFirstOrThrow,
    insertInto,
    values,
    onConflictFn,
    selectFrom,
    whereFirst,
    whereSecond,
    orderBy,
    limit,
    sqlExecute,
    getKysely: vi.fn(async () => ({
      insertInto,
      selectFrom,
      deleteFrom: vi.fn(() => ({ where: whereFirst, execute })),
    })),
  };
});

vi.mock('@/lib/db/kysely', () => ({
  getKysely: mocks.getKysely,
}));

vi.mock('kysely', async (importOriginal) => {
  const actual = await importOriginal<typeof import('kysely')>();
  return {
    ...actual,
    sql: Object.assign(
      vi.fn(() => ({ execute: mocks.sqlExecute })),
      { join: actual.sql.join, raw: actual.sql.raw },
    ),
  };
});

import {
  createJqlPreset,
  deleteJqlPreset,
  listJqlPresets,
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
  setCompanyJiraConfig,
} from './jira-config.repo';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.execute.mockResolvedValue(undefined);
  mocks.executeTakeFirstOrThrow.mockResolvedValue({ id: 4, name: 'Open bugs' });
  mocks.sqlExecute.mockResolvedValue({ rows: [] });
});

describe('jira-config.repo', () => {
  it('upserts the id-less company config without reading a generated key', async () => {
    await expect(setCompanyJiraConfig(7, {
      base_url_var: ' JIRA_BASE_URL ',
      email_var: ' JIRA_EMAIL ',
      token_var: ' JIRA_TOKEN ',
    })).resolves.toBeUndefined();

    expect(mocks.insertInto).toHaveBeenCalledWith('company_jira_config');
    expect(mocks.values).toHaveBeenCalledWith({
      company_id: 7,
      base_url_var: 'JIRA_BASE_URL',
      email_var: 'JIRA_EMAIL',
      token_var: 'JIRA_TOKEN',
    });
    expect(mocks.onConflictFn).toHaveBeenCalled();
    expect(mocks.execute).toHaveBeenCalled();
  });

  it('evicts the oldest preset at the cap before inserting with RETURNING', async () => {
    mocks.execute
      .mockResolvedValueOnce([{ id: 3 }, { id: 2 }, { id: 1 }])
      .mockResolvedValueOnce(undefined);

    await expect(createJqlPreset(7, 'Open bugs', 'status != Done', 'bugs', 3)).resolves.toEqual({
      id: 4,
      name: 'Open bugs',
    });

    expect(mocks.executeTakeFirstOrThrow).toHaveBeenCalled();
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Open bugs',
        jql: 'status != Done',
        context: 'bugs',
        company_id: 7,
      }),
    );
  });

  it('listJqlPresets filters by company_id and context', async () => {
    mocks.execute.mockResolvedValue([]);
    await listJqlPresets(5, 'timeline');
    expect(mocks.selectFrom).toHaveBeenCalledWith('jira_jql_presets');
    expect(mocks.whereFirst).toHaveBeenCalledWith('company_id', '=', 5);
    expect(mocks.whereSecond).toHaveBeenCalledWith('context', '=', 'timeline');
  });

  it('deleteJqlPreset filters by company_id', async () => {
    await deleteJqlPreset(5, 12);
    expect(mocks.whereFirst).toHaveBeenCalledWith('id', '=', 12);
    expect(mocks.whereSecond).toHaveBeenCalledWith('company_id', '=', 5);
  });

  it('listRecentJiraSyncMappings filters by company_id', async () => {
    mocks.execute.mockResolvedValue([]);
    await listRecentJiraSyncMappings(5);
    expect(mocks.selectFrom).toHaveBeenCalledWith('jira_sync_mappings');
    expect(mocks.whereFirst).toHaveBeenCalledWith('company_id', '=', 5);
    expect(mocks.limit).toHaveBeenCalledWith(5);
  });

  it('saveJiraSyncMapping scopes eviction DELETE by company_id', async () => {
    await saveJiraSyncMapping(5, '{"a":1}');
    expect(mocks.insertInto).toHaveBeenCalledWith('jira_sync_mappings');
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ mappings_json: '{"a":1}', company_id: 5 }),
    );
    expect(mocks.sqlExecute).toHaveBeenCalled();
  });
});
