import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const executeTakeFirst = vi.fn();
  const where = vi.fn(() => ({ executeTakeFirst }));
  const select = vi.fn(() => ({ where }));
  const selectFrom = vi.fn(() => ({ select }));
  return { executeTakeFirst, select, selectFrom, where };
});

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => ({ selectFrom: mocks.selectFrom })),
}));

import { companyRagConfig } from './rag-config.repo';

const RAG_COLUMNS = [
  'spi_red_threshold',
  'spi_amber_threshold',
  'deadline_red_days',
  'deadline_amber_days',
  'risks_red',
  'risks_amber',
  'issues_amber',
  'low_progress_amber',
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.executeTakeFirst.mockResolvedValue(undefined);
});

describe('companyRagConfig public projection', () => {
  it('selects only the eight RagConfig fields', async () => {
    await companyRagConfig(12);

    expect(mocks.selectFrom).toHaveBeenCalledWith('company_rag_config');
    expect(mocks.select).toHaveBeenCalledWith(RAG_COLUMNS);
    expect(mocks.where).toHaveBeenCalledWith('company_id', '=', 12);
  });
});
