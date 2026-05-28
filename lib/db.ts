import { Pool } from 'pg';
import crypto from 'crypto';

// ── Interface ──────────────────────────────────────────────────────────────────
export interface DbClient {
  get<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  run(sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }>;
  exec(sql: string): Promise<void>;
}

// ── PostgreSQL Client ──────────────────────────────────────────────────────────
class PostgresClient implements DbClient {
  constructor(private pool: Pool) {}

  private toPositional(sql: string): string {
    const hadOrIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(sql);
    let result = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
    if (hadOrIgnore) result = result.replace(/\s*;?\s*$/, ' ON CONFLICT DO NOTHING');
    let i = 0;
    return result.replace(/\?/g, () => `$${++i}`);
  }

  private needsReturningId(sql: string): boolean {
    const match = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i.exec(sql);
    const table = match?.[1]?.toLowerCase();
    return !!table && table !== 'settings';
  }

  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const { rows } = await this.pool.query(this.toPositional(sql), params.length ? params : undefined);
    return rows[0] as T | undefined;
  }
  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const { rows } = await this.pool.query(this.toPositional(sql), params.length ? params : undefined);
    return rows as T[];
  }
  async run(sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    const isInsert = /^\s*INSERT\s/i.test(sql);
    let pgSql = this.toPositional(sql);
    if (isInsert && this.needsReturningId(sql)) pgSql += ' RETURNING id';
    const result = await this.pool.query(pgSql, params.length ? params : undefined);
    return { lastInsertRowid: result.rows[0]?.id ?? 0, changes: result.rowCount ?? 0 };
  }
  async exec(sql: string): Promise<void> {
    const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of stmts) await this.pool.query(stmt);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function hashPwd(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// ── PostgreSQL schema ──────────────────────────────────────────────────────────
async function initPostgresSchema(db: DbClient) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      client TEXT,
      pm_name TEXT,
      pm_email TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      current_phase TEXT DEFAULT 'Initiation',
      description TEXT,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activities (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      phase TEXT NOT NULL DEFAULT 'General',
      no TEXT,
      activity TEXT NOT NULL,
      deliverable TEXT,
      sign_off_doc TEXT,
      accountable TEXT,
      responsible TEXT,
      support TEXT,
      plan_start TEXT,
      plan_end TEXT,
      actual_start TEXT,
      actual_end TEXT,
      status TEXT DEFAULT 'To-do',
      completion_pct INTEGER DEFAULT 0,
      notes TEXT,
      order_idx INTEGER DEFAULT 0,
      delay_owner TEXT DEFAULT 'N/A',
      delay_reason TEXT DEFAULT '',
      jira_key TEXT DEFAULT '',
      sprint TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      domain TEXT,
      role TEXT,
      name TEXT NOT NULL,
      capacity_json TEXT DEFAULT '{}',
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      frequency TEXT,
      content TEXT,
      participants TEXT,
      method TEXT,
      type TEXT DEFAULT 'regular'
    );
    CREATE TABLE IF NOT EXISTS escalation_levels (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      level_name TEXT,
      channel TEXT,
      participants TEXT,
      input TEXT,
      output TEXT
    );
    CREATE TABLE IF NOT EXISTS risks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      risk_id TEXT,
      description TEXT NOT NULL,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open',
      priority TEXT DEFAULT 'Medium',
      impact TEXT DEFAULT 'Major',
      affected_activity_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS issues (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      issue_id TEXT,
      description TEXT NOT NULL,
      root_cause TEXT,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open',
      priority TEXT DEFAULT 'Medium',
      impact TEXT DEFAULT 'Major',
      affected_activity_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      content_json TEXT DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS project_holidays (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      name TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS timeline_import_mappings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      mappings_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budget_items (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'CAPEX',
      group_name TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'USD',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS budget_expenses (
      id SERIAL PRIMARY KEY,
      budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT NOT NULL DEFAULT '',
      amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      reference TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_members (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      role TEXT DEFAULT '',
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_budgets (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      period_type TEXT NOT NULL DEFAULT 'quarterly',
      period_label TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'VND',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_budget_categories (
      id SERIAL PRIMARY KEY,
      portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      ceiling_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (
      id SERIAL PRIMARY KEY,
      portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_systems (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      go_live_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_budget_items (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'OPEX',
      name TEXT NOT NULL,
      planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'VND/month',
      period_label TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS operations_expenses (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category TEXT DEFAULT 'OPEX',
      description TEXT NOT NULL DEFAULT '',
      amount NUMERIC(15,2) NOT NULL DEFAULT 0,
      reference TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS operations_incidents (
      id SERIAL PRIMARY KEY,
      operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'Medium',
      description TEXT DEFAULT '',
      reported_at TEXT NOT NULL,
      resolved_at TEXT,
      cost_impact NUMERIC(15,2) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS portfolio_program_allocations (
      id SERIAL PRIMARY KEY,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      allocated_headcount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, program_id)
    );
    CREATE TABLE IF NOT EXISTS program_project_allocations (
      id SERIAL PRIMARY KEY,
      program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      allocated_headcount INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(program_id, project_id)
    )
  `);
}

// ── Migrations for existing databases missing new columns ──────────────────────
async function migratePostgresSchema(pool: Pool) {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    `ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS delay_owner TEXT DEFAULT 'N/A'`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS delay_reason TEXT DEFAULT ''`,
    `ALTER TABLE risks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium'`,
    `ALTER TABLE risks ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'Major'`,
    `ALTER TABLE risks ADD COLUMN IF NOT EXISTS affected_activity_id INTEGER`,
    `ALTER TABLE issues ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium'`,
    `ALTER TABLE issues ADD COLUMN IF NOT EXISTS impact TEXT DEFAULT 'Major'`,
    `ALTER TABLE issues ADD COLUMN IF NOT EXISTS affected_activity_id INTEGER`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed INTEGER DEFAULT 0`,
    `UPDATE users SET onboarding_completed = 1 WHERE created_at < '2026-05-08 00:00:00' AND onboarding_completed = 0`,
    `CREATE TABLE IF NOT EXISTS timeline_import_mappings (id SERIAL PRIMARY KEY, name TEXT NOT NULL, mappings_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS budget_items (id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'CAPEX', group_name TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0, actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'USD', notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS budget_expenses (id SERIAL PRIMARY KEY, budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, description TEXT NOT NULL DEFAULT '', amount NUMERIC(15,2) NOT NULL DEFAULT 0, reference TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS jira_key TEXT DEFAULT ''`,
    `ALTER TABLE activities ADD COLUMN IF NOT EXISTS sprint TEXT DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS portfolio_members (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, role TEXT DEFAULT '', name TEXT NOT NULL, email TEXT DEFAULT '', note TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `ALTER TABLE portfolio_members ADD COLUMN IF NOT EXISTS member_type TEXT DEFAULT 'internal'`,
    `UPDATE portfolio_members SET member_type = 'external' WHERE LOWER(note) LIKE '%ai platform%' AND (member_type IS NULL OR member_type = 'internal')`,
    `ALTER TABLE companies ADD COLUMN IF NOT EXISTS headcount_quota INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS headcount_quota INTEGER DEFAULT 0`,
    `ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(15,2) DEFAULT 0`,
    `ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS budget_status TEXT DEFAULT 'draft'`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget_status TEXT DEFAULT 'draft'`,
    `CREATE TABLE IF NOT EXISTS portfolio_budgets (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, period_type TEXT NOT NULL DEFAULT 'quarterly', period_label TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, total_amount NUMERIC(15,2) NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'VND', status TEXT NOT NULL DEFAULT 'draft', notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS portfolio_budget_categories (id SERIAL PRIMARY KEY, portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE, category TEXT NOT NULL, ceiling_amount NUMERIC(15,2) NOT NULL DEFAULT 0, notes TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS portfolio_budget_allocations (id SERIAL PRIMARY KEY, portfolio_budget_id INTEGER NOT NULL REFERENCES portfolio_budgets(id) ON DELETE CASCADE, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, allocated_amount NUMERIC(15,2) NOT NULL DEFAULT 0, notes TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operations_systems (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL, project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT DEFAULT '', go_live_date TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operations_budget_items (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, category TEXT NOT NULL DEFAULT 'OPEX', name TEXT NOT NULL, planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0, actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'VND/month', period_label TEXT DEFAULT '', notes TEXT DEFAULT '')`,
    `CREATE TABLE IF NOT EXISTS operations_expenses (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, expense_date DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT DEFAULT 'OPEX', description TEXT NOT NULL DEFAULT '', amount NUMERIC(15,2) NOT NULL DEFAULT 0, reference TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS operations_incidents (id SERIAL PRIMARY KEY, operations_system_id INTEGER NOT NULL REFERENCES operations_systems(id) ON DELETE CASCADE, title TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'Medium', description TEXT DEFAULT '', reported_at TEXT NOT NULL, resolved_at TEXT, cost_impact NUMERIC(15,2) DEFAULT 0, status TEXT NOT NULL DEFAULT 'Open', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS portfolio_program_allocations (id SERIAL PRIMARY KEY, company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE, program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, allocated_headcount INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(company_id, program_id))`,
    `CREATE TABLE IF NOT EXISTS program_project_allocations (id SERIAL PRIMARY KEY, program_id INTEGER REFERENCES customers(id) ON DELETE CASCADE, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, allocated_headcount INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(program_id, project_id))`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch { /* column already exists */ }
  }
}

// ── Seed default users ─────────────────────────────────────────────────────────
async function seedAuthData(db: DbClient) {
  const row = await db.get<{ c: string | number }>('SELECT COUNT(*) as c FROM users');
  if (Number(row?.c ?? 0) > 0) return;

  await db.run('INSERT OR IGNORE INTO companies (name) VALUES (?)', 'Default Company');
  const company = await db.get<{ id: number }>("SELECT id FROM companies WHERE name = 'Default Company'");

  await db.run(
    'INSERT OR IGNORE INTO users (username, password_hash, display_name, is_admin) VALUES (?, ?, ?, ?)',
    'admin', hashPwd('Khang@19'), 'Administrator', 1
  );
  if (company) {
    await db.run(
      'INSERT OR IGNORE INTO users (username, password_hash, display_name, company_id, is_admin) VALUES (?, ?, ?, ?, ?)',
      'ct_user1', hashPwd('Ctech@26'), 'CT User 1', company.id, 0
    );
    await db.run('UPDATE projects SET company_id = ? WHERE company_id IS NULL', company.id);
    await db.run('UPDATE customers SET company_id = ? WHERE company_id IS NULL', company.id);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────
let _client: DbClient | null = null;

export async function getDb(): Promise<DbClient> {
  if (_client) return _client;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required. Set it to your PostgreSQL connection string.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('railway.internal')
      ? false
      : { rejectUnauthorized: false },
  });
  const client = new PostgresClient(pool);
  await initPostgresSchema(client);
  await migratePostgresSchema(pool);
  _client = client;

  await seedAuthData(_client);
  return _client;
}

// ── Types ──────────────────────────────────────────────────────────────────────
export type Program = {
  id: number; name: string; industry: string; contact_name: string;
  contact_email: string; contact_phone: string; website: string;
  notes: string; created_at: string;
};
export type Project = {
  id: number; name: string; client: string; customer_id: number | null;
  pm_name: string; pm_email: string; start_date: string; end_date: string;
  status: string; current_phase: string; description: string; created_at: string;
};
export type Activity = {
  id: number; project_id: number; phase: string; no: string; activity: string;
  deliverable: string; sign_off_doc: string; accountable: string; responsible: string;
  support: string; plan_start: string; plan_end: string; actual_start: string;
  actual_end: string; status: string; completion_pct: number; notes: string;
  order_idx: number; delay_owner: string; delay_reason: string;
  jira_key: string; sprint: string;
};
export type TeamMember = {
  id: number; project_id: number; domain: string; role: string;
  name: string; capacity_json: string; notes: string;
};
export type Meeting = {
  id: number; project_id: number; name: string; frequency: string;
  content: string; participants: string; method: string; type: string;
};
export type EscalationLevel = {
  id: number; project_id: number; level: number; level_name: string;
  channel: string; participants: string; input: string; output: string;
};
export type Risk = {
  id: number; project_id: number; risk_id: string; description: string;
  category: string; owner: string; trigger: string; mitigation: string;
  due_date: string; status: string;
};
export type Issue = {
  id: number; project_id: number; issue_id: string; description: string;
  root_cause: string; category: string; owner: string; trigger: string;
  mitigation: string; due_date: string; status: string;
};
export type Document = {
  id: number; project_id: number; type: string; title: string;
  content_json: string; created_at: string; updated_at: string;
};
