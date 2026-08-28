import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FISCAL_BUDGET_DDL,
  FISCAL_BUDGET_DDL_FLAG,
  migrateFiscalBudget,
} from './db-fiscal-budget';

describe('migrateFiscalBudget DDL fragments', () => {
  it('exports migrateFiscalBudget and fiscal_budget_ddl_v1 settings flag key', () => {
    expect(typeof migrateFiscalBudget).toBe('function');
    expect(FISCAL_BUDGET_DDL_FLAG).toBe('fiscal_budget_ddl_v1');
  });

  it('creates all five fiscal/benefit/dependency tables (D-09, D-12)', () => {
    const ddl = FISCAL_BUDGET_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS project_fiscal_budgets/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS budget_adjustments/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS financial_benefits/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS nonfinancial_benefits/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS project_dependencies/);
  });

  it('includes UNIQUE (project_id, fiscal_year, cost_type) on project_fiscal_budgets (D-02)', () => {
    const ddl = FISCAL_BUDGET_DDL.join('\n');
    expect(ddl).toMatch(/UNIQUE \(project_id, fiscal_year, cost_type\)/);
  });

  it('uses BIGINT VND amount columns (D-02)', () => {
    const ddl = FISCAL_BUDGET_DDL.join('\n');
    expect(ddl).toMatch(/approved_amount_vnd BIGINT NOT NULL/);
    expect(ddl).toMatch(/actual_amount_vnd BIGINT NOT NULL DEFAULT 0/);
    expect(ddl).toMatch(/amount_vnd BIGINT NOT NULL/);
  });
});

describe('getDb wires migrateFiscalBudget after migrateWeeklyReports (D-12)', () => {
  it('awaits migrateFiscalBudget immediately after migrateWeeklyReports in lib/db.ts', () => {
    const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
    const weeklyIdx = src.indexOf('await migrateWeeklyReports(pool)');
    const fiscalIdx = src.indexOf('await migrateFiscalBudget(pool)');
    expect(weeklyIdx).toBeGreaterThan(-1);
    expect(fiscalIdx).toBeGreaterThan(weeklyIdx);
    const backfillIdx = src.indexOf('await backfillWeightedCompletion(pool)');
    expect(fiscalIdx).toBeLessThan(backfillIdx);
  });
});
