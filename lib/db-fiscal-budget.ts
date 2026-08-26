import type { Pool } from 'pg';

export const FISCAL_BUDGET_DDL_FLAG = 'fiscal_budget_ddl_v1';

/** Hermetic unit-test assertions against the DDL strings (D-02, D-09, D-12). */
export const FISCAL_BUDGET_DDL = [
  `
    CREATE TABLE IF NOT EXISTS project_fiscal_budgets (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      fiscal_year INTEGER NOT NULL,
      cost_type TEXT NOT NULL,
      approved_amount_vnd BIGINT NOT NULL,
      actual_amount_vnd BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (project_id, fiscal_year, cost_type),
      CHECK (cost_type IN ('CAPEX', 'OPEX')),
      CHECK (approved_amount_vnd >= 0),
      CHECK (actual_amount_vnd >= 0)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS budget_adjustments (
      id SERIAL PRIMARY KEY,
      fiscal_budget_id INTEGER NOT NULL REFERENCES project_fiscal_budgets(id),
      amount_vnd BIGINT NOT NULL,
      effective_date DATE NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      CHECK (amount_vnd <> 0)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS financial_benefits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      fiscal_year INTEGER NOT NULL,
      benefit_type TEXT NOT NULL,
      expected_vnd BIGINT NOT NULL,
      actual_vnd BIGINT,
      UNIQUE (project_id, fiscal_year, benefit_type),
      CHECK (benefit_type IN ('COST_SAVING', 'REVENUE', 'PRODUCTIVITY')),
      CHECK (expected_vnd >= 0)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS nonfinancial_benefits (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      group_name TEXT NOT NULL,
      measure TEXT NOT NULL,
      target TEXT NOT NULL,
      actual_text TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS project_dependencies (
      id SERIAL PRIMARY KEY,
      from_project_id INTEGER NOT NULL REFERENCES projects(id),
      to_project_id INTEGER NOT NULL REFERENCES projects(id),
      dependency_type TEXT NOT NULL,
      need_by DATE NOT NULL,
      effective_from DATE NOT NULL,
      effective_to DATE,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT now(),
      CHECK (dependency_type IN ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH', 'BLOCKS'))
    )
  `,
];

async function settingsFlagExists(pool: Pool, key: string): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 FROM settings WHERE key = $1 LIMIT 1', [key]);
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

async function writeSettingsFlag(pool: Pool, key: string): Promise<void> {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [key, new Date().toISOString()],
  );
}

async function migrateFiscalBudgetDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, FISCAL_BUDGET_DDL_FLAG)) return;

  for (const sql of FISCAL_BUDGET_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, FISCAL_BUDGET_DDL_FLAG);
}

/** Idempotent fiscal/benefit/dependency DDL in the getDb migrate loop (D-02, D-09, D-12). */
export async function migrateFiscalBudget(pool: Pool): Promise<void> {
  try {
    await migrateFiscalBudgetDdl(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
