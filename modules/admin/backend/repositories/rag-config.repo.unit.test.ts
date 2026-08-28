import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    exec: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { companyRagConfig } from './rag-config.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.get.mockResolvedValue(undefined);
});

describe('companyRagConfig public projection', () => {
  it('selects only the eight RagConfig fields', async () => {
    await companyRagConfig(12);

    const sql = String(db.get.mock.calls[0][0]).replace(/\s+/g, ' ').trim();
    expect(sql).toBe(
      'SELECT spi_red_threshold, spi_amber_threshold, deadline_red_days, deadline_amber_days, ' +
      'risks_red, risks_amber, issues_amber, low_progress_amber ' +
      'FROM company_rag_config WHERE company_id = ?',
    );
    expect(sql).not.toContain('SELECT *');
    expect(db.get).toHaveBeenCalledWith(expect.any(String), 12);
  });
});
