import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { get: vi.fn(), all: vi.fn(), run: vi.fn(), exec: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import {
  bugMappingIds,
  createBugMapping,
  createTimelineMapping,
  listBugMappings,
  listTimelineMappings,
  updateTimelineMapping,
} from './import-mapping.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.run.mockResolvedValue({ lastInsertRowid: 21, changes: 1 });
  db.get.mockResolvedValue({ id: 21, name: 'Standard' });
});

function normalizedSql(): string {
  return db.all.mock.calls[0][0].replace(/\s+/g, ' ').trim();
}

describe('import-mapping.repo', () => {
  it('listTimelineMappings filters by company_id', async () => {
    await listTimelineMappings(5);
    expect(normalizedSql()).toContain('WHERE company_id = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it('creates a timeline mapping with company_id and reads it by the generated id', async () => {
    await expect(createTimelineMapping(5, 'Standard', '{"name":"Summary"}')).resolves.toEqual({
      id: 21,
      name: 'Standard',
    });

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO timeline_import_mappings'),
      'Standard',
      '{"name":"Summary"}',
      5,
    );
    expect(db.get).toHaveBeenCalledWith(
      'SELECT * FROM timeline_import_mappings WHERE id = ?',
      21,
    );
  });

  it('creates a bug mapping and reads it by the generated id', async () => {
    await expect(createBugMapping(5, 'Standard', '{"name":"Summary"}')).resolves.toEqual({
      id: 21,
      name: 'Standard',
    });

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bug_import_mappings'),
      'Standard',
      '{"name":"Summary"}',
      5,
    );
    expect(db.get).toHaveBeenCalledWith(
      'SELECT * FROM bug_import_mappings WHERE id = ?',
      21,
    );
  });

  it('listBugMappings filters by company_id', async () => {
    await listBugMappings(5);
    expect(normalizedSql()).toContain('WHERE company_id = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5);
  });

  it('bugMappingIds filters by company_id', async () => {
    await bugMappingIds(5);
    expect(normalizedSql()).toContain('WHERE company_id = ?');
    expect(db.all).toHaveBeenCalledWith(expect.any(String), 5);
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
