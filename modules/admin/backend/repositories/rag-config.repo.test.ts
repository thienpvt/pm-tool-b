import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { companyRagConfig } from './rag-config.repo';

describe.skipIf(!hasTestDb)('rag-config.repo', () => {
  let companyA: number;
  let companyB: number;

  beforeAll(async () => {
    await setupRepoTables();
    companyA = await seedCompany('RAG Co A');
    companyB = await seedCompany('RAG Co B');
  });

  it('returns undefined when a company has no row, so the caller can fall back', async () => {
    await expect(companyRagConfig(8899)).resolves.toBeUndefined();
  });

  it('reads a company thresholds row', async () => {
    await testDb().run(
      'INSERT INTO company_rag_config (company_id, spi_red_threshold) VALUES (?, ?)',
      companyA, 0.42,
    );
    const cfg = await companyRagConfig(companyA);
    expect(Number(cfg?.spi_red_threshold)).toBeCloseTo(0.42);
  });

  it('scopes by company: one company config is not returned for another', async () => {
    await testDb().run(
      'INSERT INTO company_rag_config (company_id, spi_red_threshold) VALUES (?, ?)',
      companyB, 0.11,
    );
    const cfg = await companyRagConfig(companyA);
    expect(Number(cfg?.spi_red_threshold)).toBeCloseTo(0.42);
  });

  it('handles a null companyId without throwing', async () => {
    await expect(companyRagConfig(null)).resolves.toBeUndefined();
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await companyRagConfig(companyA);
    expect(getKysely).toHaveBeenCalled();
  });
});
