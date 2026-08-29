import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedCompany, seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import { listPortfolioProjects, createPortfolioBudget, listPortfolioBudgets, listPortfolioReportProjects } from '@/modules/portfolio/backend/repositories/portfolio.repo';

describe.skipIf(!hasTestDb)('portfolio.repo', () => {
  let companyA: number;
  let projectA: number;
  let projectB: number;

  beforeAll(async () => {
    await setupRepoTables();
    await testDb().exec(`
      CREATE TABLE IF NOT EXISTS portfolio_budgets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        period_type TEXT NOT NULL DEFAULT 'quarterly',
        period_label TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'VND',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE portfolio_budgets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
      ALTER TABLE portfolio_budgets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (
        id SERIAL PRIMARY KEY,
        portfolio_budget_id INTEGER NOT NULL,
        project_id INTEGER,
        allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    companyA = await seedCompany('Portfolio Scope A');
    const companyB = await seedCompany('Portfolio Scope B');
    projectA = await seedProject('Portfolio Project A', { company_id: companyA });
    projectB = await seedProject('Portfolio Project B', { company_id: companyB });
  });

  it('limits callers to their company projects', async () => {
    const rows = await listPortfolioProjects(companyA) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(projectA);
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });

  it('does not return other-company projects when scoped to company A (D-13)', async () => {
    const rows = await listPortfolioProjects(companyA) as { id: number }[];
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listPortfolioProjects(companyA);
    expect(getKysely).toHaveBeenCalled();
  });

  it('createPortfolioBudget then listPortfolioBudgets returns period_label for company (D-05)', async () => {
    const label = `Q1-2026-${Date.now()}`;
    await createPortfolioBudget(companyA, {
      period_label: label,
      start_date: '2026-01-01',
      end_date: '2026-03-31',
      total_amount: 1000,
    });
    const rows = await listPortfolioBudgets(companyA) as { period_label: string }[];
    expect(rows.map(r => r.period_label)).toContain(label);
  });

  it('listPortfolioReportProjects is company-scoped (D-05)', async () => {
    const rows = await listPortfolioReportProjects(companyA) as { id: number }[];
    expect(rows.map(row => row.id)).toContain(projectA);
    expect(rows.map(row => row.id)).not.toContain(projectB);
  });
});
