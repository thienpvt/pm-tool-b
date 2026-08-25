import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import {
  createBugMapping,
  createTimelineMapping,
  updateTimelineMapping,
} from './import-mapping.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.run.mockResolvedValue({ lastInsertRowid: 21, changes: 1 });
  db.get.mockResolvedValue({ id: 21, name: 'Standard' });
});

describe('import-mapping.repo', () => {
  it.each([
    ['timeline', createTimelineMapping, 'timeline_import_mappings'],
    ['bug', createBugMapping, 'bug_import_mappings'],
  ] as const)('creates a %s mapping and reads it by the generated id', async (_kind, create, table) => {
    await expect(create('Standard', '{"name":"Summary"}')).resolves.toEqual({
      id: 21,
      name: 'Standard',
    });

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining(`INSERT INTO ${table}`),
      'Standard',
      '{"name":"Summary"}',
    );
    expect(db.get).toHaveBeenCalledWith(
      `SELECT * FROM ${table} WHERE id = ?`,
      21,
    );
  });

  it('updates and reloads a timeline mapping with company scope', async () => {
    await updateTimelineMapping(5, 21, 'Renamed', '{"name":"Title"}');

    expect(db.run).toHaveBeenCalledWith(
      'UPDATE timeline_import_mappings SET name = ?, mappings_json = ? WHERE id = ? AND company_id = ?',
      'Renamed',
      '{"name":"Title"}',
      21,
      5,
    );
    expect(db.get).toHaveBeenCalledWith(
      'SELECT * FROM timeline_import_mappings WHERE id = ? AND company_id = ?',
      21,
      5,
    );
  });
});
