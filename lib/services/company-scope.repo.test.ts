import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedCompany, seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { getBudget, getPortfolioSummary, listBudgets } from '@/modules/portfolio/backend/services/portfolio.service';
import { getPortfolioReport } from './portfolio-report.service';
import { getRoadmap } from '@/modules/portfolio/backend/services/roadmap.service';
import { listPortfolioBudgets } from '@/modules/portfolio/backend/repositories/portfolio.repo';
import { NotFoundError } from '@/lib/services/errors';

/**
 * SVC-05 proof: aggregate services exclude another company's rows from lists
 * AND from rollup totals. Real-DB gated — mocked repos cannot prove SQL joins.
 */
describe.skipIf(!hasTestDb)('portfolio aggregates are company-scoped (SVC-05)', () => {
  let companyA: number;
  let companyB: number;
  let projectA: number;
  let projectB: number;

  beforeAll(async () => {
    await setupRepoTables();

    // Budget rollup tables are not in the Phase-2 minimal DDL — create the
    // subset listPortfolioBudgets needs so the rollup total assertion can run.
    await testDb().exec(`
      CREATE TABLE IF NOT EXISTS portfolio_budgets (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        period_type TEXT,
        period_label TEXT,
        start_date TEXT,
        end_date TEXT,
        total_amount NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'VND',
        notes TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (
        id SERIAL PRIMARY KEY,
        portfolio_budget_id INTEGER,
        project_id INTEGER,
        allocated_amount NUMERIC DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS portfolio_members (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        role TEXT DEFAULT '',
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        note TEXT DEFAULT '',
        member_type TEXT DEFAULT 'internal',
        member_category TEXT DEFAULT 'delivery',
        overhead_remaining FLOAT DEFAULT 0
      );
      ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'internal';
      ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS member_category TEXT DEFAULT 'delivery';
      ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS overhead_remaining FLOAT DEFAULT 0;
      CREATE TABLE IF NOT EXISTS portfolio_program_allocations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER,
        program_id INTEGER,
        allocated_headcount NUMERIC(6,1) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(company_id, program_id)
      );
    `);

    companyA = await seedCompany('Scope Co A');
    companyB = await seedCompany('Scope Co B');
    projectA = await seedProject('a-project', {
      company_id: companyA,
      current_phase: 'Execution',
      status: 'Active',
    });
    projectB = await seedProject('b-project', {
      company_id: companyB,
      current_phase: 'Execution',
      status: 'Active',
    });

    // Risks: 1 open on A, 5 open on B — if B leaks into KPI totals, totalOpenRisks ≥ 5.
    const db = testDb();
    await db.run(
      `INSERT INTO risks (project_id, risk_id, description, status, priority)
       VALUES (?, 'R-A1', 'a-risk', 'Open', 'High')`,
      projectA,
    );
    for (let i = 0; i < 5; i++) {
      await db.run(
        `INSERT INTO risks (project_id, risk_id, description, status, priority)
         VALUES (?, ?, 'b-risk', 'Open', 'High')`,
        projectB,
        `R-B${i}`,
      );
    }

    // Activities for completion % — only A should contribute to avgCompletion for A actor.
    await db.run(
      `INSERT INTO activities (project_id, phase, no, activity, status, completion_pct)
       VALUES (?, 'Execution', '1', 'a-act', 'Done', 100)`,
      projectA,
    );
    await db.run(
      `INSERT INTO activities (project_id, phase, no, activity, status, completion_pct)
       VALUES (?, 'Execution', '1', 'b-act', 'Done', 100)`,
      projectB,
    );

    // Budget rollup: 1000 on A, 99999 on B — sum for A must be 1000, not 100999.
    const ba = await db.run(
      `INSERT INTO portfolio_budgets
         (company_id, period_type, period_label, start_date, end_date, total_amount)
       VALUES (?, 'quarterly', 'A-Q1', '2026-01-01', '2026-03-31', 1000)`,
      companyA,
    );
    const bb = await db.run(
      `INSERT INTO portfolio_budgets
         (company_id, period_type, period_label, start_date, end_date, total_amount)
       VALUES (?, 'quarterly', 'B-Q1', '2026-01-01', '2026-03-31', 99999)`,
      companyB,
    );
    await db.run(
      `INSERT INTO portfolio_budget_allocations (portfolio_budget_id, project_id, allocated_amount)
       VALUES (?, ?, 1000)`,
      ba.lastInsertRowid,
      projectA,
    );
    await db.run(
      `INSERT INTO portfolio_budget_allocations (portfolio_budget_id, project_id, allocated_amount)
       VALUES (?, ?, 99999)`,
      bb.lastInsertRowid,
      projectB,
    );
  });

  const actorA = () => ({ company_id: companyA as number | null, is_admin: 0 as number | boolean });

  it('portfolio summary excludes company B from rows and KPI totals', async () => {
    const result = await getPortfolioSummary(actorA());
    const ids = result.projects.map((p: { id: number }) => p.id);

    expect(ids).toContain(projectA);
    expect(ids).not.toContain(projectB);

    // Totals, not just row lists — B has 5 open risks; a leak would inflate this.
    expect(result.kpi.totalProjects).toBe(
      result.projects.length,
    );
    expect(result.kpi.totalProjects).toBeGreaterThanOrEqual(1);
    // All returned projects belong to A (by the fixture we own; other suites may seed more under A)
    for (const p of result.projects as { id: number; open_risks: number }[]) {
      expect(p.id).not.toBe(projectB);
    }
    // B's 5 open risks must not appear in the sum over returned projects
    const openFromB = (result.projects as { id: number; open_risks: number | string }[])
      .filter(p => p.id === projectB)
      .reduce((s, p) => s + Number(p.open_risks), 0);
    expect(openFromB).toBe(0);
    // KPI totalOpenRisks equals sum of returned open_risks only
    const sumOpen = (result.projects as { open_risks: number | string }[])
      .reduce((s, p) => s + Number(p.open_risks), 0);
    expect(Number(result.kpi.totalOpenRisks)).toBe(sumOpen);
    // And that sum must not include B's 5 (projectA has exactly 1 in this fixture;
    // other parallel seeds under companyA may add more, so lower-bound only on A presence)
    const projectARow = (result.projects as { id: number; open_risks: number }[])
      .find(p => p.id === projectA);
    expect(Number(projectARow?.open_risks)).toBe(1);
    expect(Number(result.kpi.totalOpenRisks)).toBeLessThan(1 + 5); // would be ≥6 if B leaked into sum
  });

  it('roadmap excludes company B from programs and noProgramProjects', async () => {
    const result = await getRoadmap(actorA());
    const all = [
      ...result.noProgramProjects,
      ...result.programs.flatMap((c: { projects: { id: number }[] }) => c.projects),
    ] as { id: number }[];
    const ids = all.map(p => p.id);
    expect(ids).toContain(projectA);
    expect(ids).not.toContain(projectB);
    expect(all.length).toBe(ids.filter(id => id !== projectB).length);
  });

  it('portfolio report excludes company B from rows and KPI totals', async () => {
    const result = await getPortfolioReport(actorA(), {});
    const ids = (result.projects as { id: number }[]).map(p => p.id);
    expect(ids).toContain(projectA);
    expect(ids).not.toContain(projectB);
    expect(result.kpi.totalProjects).toBe(result.projects.length);
    expect(result.kpi.totalProjects).toBe(
      (result.projects as { id: number }[]).filter(p => p.id !== projectB).length,
    );
    // KPI open-risk sum must match returned projects only
    const sumOpen = (result.projects as { open_risks: number | string }[])
      .reduce((s, p) => s + Number(p.open_risks), 0);
    expect(Number(result.kpi.totalOpenRisks)).toBe(sumOpen);
    expect(ids).not.toContain(projectB);
  });

  it('budget rollup total_allocated excludes company B', async () => {
    const rows = await listPortfolioBudgets(companyA) as {
      company_id: number;
      total_amount: number | string;
      total_allocated: number | string;
      period_label: string;
    }[];

    // No B rows at all
    expect(rows.every(r => Number(r.company_id) === companyA)).toBe(true);
    expect(rows.some(r => r.period_label === 'B-Q1')).toBe(false);
    expect(rows.some(r => r.period_label === 'A-Q1')).toBe(true);

    // Totals: allocated sum must not include B's 99999
    const allocatedSum = rows.reduce((s, r) => s + Number(r.total_allocated), 0);
    expect(allocatedSum).toBeGreaterThanOrEqual(1000);
    expect(allocatedSum).toBeLessThan(1000 + 99999);
    // Amount sum similarly
    const amountSum = rows.reduce((s, r) => s + Number(r.total_amount), 0);
    expect(amountSum).toBeLessThan(1000 + 99999);

    // 04-06: portfolio.service.ts's listBudgets wraps this same repository call —
    // prove the service layer carries the identical company-scoped totals (SVC-05),
    // folded into this test rather than a new `it()` so the DB-gated skip count is
    // unaffected when TEST_DATABASE_URL is absent.
    const svcRows = await listBudgets({ company_id: companyA, is_admin: 0 }) as typeof rows;
    expect(svcRows.every(r => Number(r.company_id) === companyA)).toBe(true);
    expect(svcRows.some(r => r.period_label === 'B-Q1')).toBe(false);
    const svcAllocatedSum = svcRows.reduce((s, r) => s + Number(r.total_allocated), 0);
    expect(svcAllocatedSum).toBe(allocatedSum);

    // getBudget on company B's own budget id must 404 for a company A actor —
    // never return the foreign row.
    const bRows = await listPortfolioBudgets(companyB) as { id: number; period_label: string }[];
    const bBudgetId = bRows.find(r => r.period_label === 'B-Q1')!.id;
    await expect(
      getBudget(bBudgetId, { company_id: companyA, is_admin: 0 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
