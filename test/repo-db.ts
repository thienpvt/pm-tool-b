import type { Pool } from 'pg';
import type { DbClient } from '@/lib/db';
import { testPool } from './db';

/**
 * A `DbClient` over the Phase 1 test pool.
 *
 * Repository tests must NOT call `getDb()` — that runs `initPostgresSchema`,
 * the migration loop, and `seedAuthData`, which would write default admin
 * credentials into the test database. This adapter gives repositories a real
 * Postgres connection with the same `?` → `$n` placeholder convention
 * `lib/db.ts` uses, and nothing else.
 */
class TestDbClient implements DbClient {
  constructor(private pool: Pool) {}

  /**
   * Same two rewrites `lib/db.ts` performs: `INSERT OR IGNORE` → `ON CONFLICT DO
   * NOTHING`, then `?` → `$n`. Without the first, any repository using the SQLite-dialect
   * upsert (milestone_epics) fails here while working in production — a test-only
   * failure that would look like a repository bug.
   */
  private toPositional(sql: string): string {
    const hadOrIgnore = /\bINSERT\s+OR\s+IGNORE\b/i.test(sql);
    let result = sql.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
    if (hadOrIgnore) result = result.replace(/\s*;?\s*$/, ' ON CONFLICT DO NOTHING');
    let i = 0;
    return result.replace(/\?/g, () => `$${++i}`);
  }

  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const { rows } = await this.pool.query(this.toPositional(sql), params.length ? params : undefined);
    return rows[0] as T | undefined;
  }

  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const { rows } = await this.pool.query(this.toPositional(sql), params.length ? params : undefined);
    return rows as T[];
  }

  /**
   * `lib/db.ts` skips `RETURNING id` for tables with no serial `id` column. Mirror that
   * exact exclusion list here — otherwise a write to `settings` fails only in tests.
   */
  private needsReturningId(sql: string): boolean {
    const table = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i.exec(sql)?.[1]?.toLowerCase();
    return !!table && !['settings', 'company_jira_config', 'company_rag_config', 'company_weekly_config', 'user_roles'].includes(table);
  }

  async run(sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    let pgSql = this.toPositional(sql);
    if (/^\s*INSERT\s/i.test(sql) && this.needsReturningId(sql)) pgSql += ' RETURNING id';
    const result = await this.pool.query(pgSql, params.length ? params : undefined);
    return { lastInsertRowid: result.rows[0]?.id ?? 0, changes: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      await this.pool.query(stmt);
    }
  }
}

export function testDb(): DbClient {
  return new TestDbClient(testPool());
}

/**
 * Minimal DDL for the tables Phase 2 repository tests touch. Column sets match
 * `lib/repositories/ALLOWLIST-DIFF.md`, including the migration-added columns
 * (`activities.project_status`, `activities.parent_id`, `team_members.email`,
 * and the `priority`/`impact`/`affected_activity_id` trio on risks and issues)
 * — a CREATE-TABLE-only schema would let an allowlist regression pass unseen.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT, client TEXT, pm_name TEXT, pm_email TEXT,
  start_date TEXT, end_date TEXT, status TEXT, current_phase TEXT, description TEXT,
  objective TEXT, project_owner TEXT, budget NUMERIC, budget_currency TEXT,
  headcount_quota INTEGER, budget_status TEXT,
  project_code TEXT, portfolio_year INTEGER, stage TEXT, status_reason TEXT, rag TEXT,
  progress_pct INTEGER DEFAULT 0, weekly_report_enabled BOOLEAN DEFAULT FALSE,
  weekly_report_start_period TEXT, plan_end TEXT, adjusted_end TEXT, actual_end TEXT,
  classification TEXT, governance TEXT,
  customer_id INTEGER, company_id INTEGER, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_pm_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('primary','collaborator')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_stakeholders (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  stakeholder_role TEXT NOT NULL CHECK (stakeholder_role IN ('sponsor','psc_chair','psc_member','project_director','key_stakeholder')),
  user_id INTEGER REFERENCES users(id),
  external_name TEXT,
  external_email TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY, name TEXT, industry TEXT, contact_name TEXT,
  contact_email TEXT, contact_phone TEXT, website TEXT, notes TEXT,
  company_id INTEGER, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, headcount_quota INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, username TEXT, password_hash TEXT, display_name TEXT,
  company_id INTEGER, is_admin INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(),
  email TEXT, status TEXT NOT NULL DEFAULT 'active', locked_at TIMESTAMPTZ,
  locked_by INTEGER REFERENCES users(id), deleted_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('cpmo', 'pm', 'viewer')),
  company_id INTEGER REFERENCES companies(id),
  PRIMARY KEY (user_id, role)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id),
  actor_id INTEGER REFERENCES users(id),
  entity_type TEXT,
  entity_id TEXT,
  action TEXT,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY, project_id INTEGER, phase TEXT, no TEXT, activity TEXT,
  deliverable TEXT, sign_off_doc TEXT, accountable TEXT, responsible TEXT, support TEXT,
  plan_start TEXT, plan_end TEXT, actual_start TEXT, actual_end TEXT, status TEXT,
  completion_pct NUMERIC, notes TEXT, order_idx INTEGER, delay_owner TEXT,
  delay_reason TEXT, jira_key TEXT, sprint TEXT, priority TEXT,
  project_status TEXT, parent_id INTEGER
);
CREATE TABLE IF NOT EXISTS risks (
  id SERIAL PRIMARY KEY, project_id INTEGER, risk_id TEXT, description TEXT,
  category TEXT, owner TEXT, trigger TEXT, mitigation TEXT, due_date TEXT,
  status TEXT, priority TEXT, impact TEXT, affected_activity_id INTEGER,
  code TEXT, deactivated_at TIMESTAMPTZ
);
ALTER TABLE risks ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE risks ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY, project_id INTEGER, issue_id TEXT, description TEXT,
  root_cause TEXT, category TEXT, owner TEXT, trigger TEXT, mitigation TEXT,
  due_date TEXT, status TEXT, priority TEXT, impact TEXT, affected_activity_id INTEGER,
  code TEXT, technology_council BOOLEAN DEFAULT FALSE, deactivated_at TIMESTAMPTZ
);
ALTER TABLE issues ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS technology_council BOOLEAN DEFAULT FALSE;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS meetings (
  id SERIAL PRIMARY KEY, project_id INTEGER, name TEXT, frequency TEXT,
  content TEXT, participants TEXT, method TEXT, type TEXT
);
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY, project_id INTEGER, domain TEXT, role TEXT, name TEXT,
  email TEXT, capacity_json TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS escalation_levels (
  id SERIAL PRIMARY KEY, project_id INTEGER, level INTEGER, level_name TEXT,
  channel TEXT, participants TEXT, input TEXT, output TEXT
);
CREATE TABLE IF NOT EXISTS milestones (
  id SERIAL PRIMARY KEY, project_id INTEGER, name TEXT, start_date TEXT, end_date TEXT,
  status TEXT NOT NULL DEFAULT 'planned', plan_end TEXT, adjusted_end TEXT,
  cancelled_at TIMESTAMPTZ, cancelled_by INTEGER REFERENCES users(id)
);
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned';
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS plan_end TEXT;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS adjusted_end TEXT;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users(id);
CREATE TABLE IF NOT EXISTS raid_due_date_history (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('risk','issue')),
  entity_id TEXT NOT NULL,
  old_due TEXT,
  new_due TEXT,
  changed_at TIMESTAMPTZ DEFAULT now(),
  changed_by INTEGER REFERENCES users(id)
);
-- Mirrors lib/db.ts: SERIAL id plus a UNIQUE pair, NOT a composite primary key.
-- The id column is load-bearing here: lib/db.ts appends RETURNING id to every
-- INSERT except settings/company_jira_config, so an id-less table would fail on
-- linkEpic in a way production never does.
CREATE TABLE IF NOT EXISTS milestone_epics (
  id SERIAL PRIMARY KEY,
  milestone_id INTEGER, activity_id INTEGER,
  UNIQUE (milestone_id, activity_id)
);
CREATE TABLE IF NOT EXISTS project_holidays (
  id SERIAL PRIMARY KEY, project_id INTEGER, date TEXT, name TEXT
);
CREATE TABLE IF NOT EXISTS bugs (
  id SERIAL PRIMARY KEY, project_id INTEGER,
  issue_type TEXT DEFAULT '', issue_key TEXT DEFAULT '', issue_id TEXT DEFAULT '',
  summary TEXT NOT NULL DEFAULT '', assignee TEXT DEFAULT '', reporter TEXT DEFAULT '',
  priority TEXT DEFAULT 'Medium', severity TEXT DEFAULT '', status TEXT DEFAULT 'To Do',
  resolution TEXT DEFAULT '', created TEXT DEFAULT '', snapshot_date TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL,
  type TEXT NOT NULL, title TEXT, content_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS budget_items (
  id SERIAL PRIMARY KEY, project_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'CAPEX', group_name TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  planned_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  approved_amount NUMERIC(15,2) DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'USD', notes TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS budget_expenses (
  id SERIAL PRIMARY KEY,
  budget_item_id INTEGER NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  reference TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS company_rag_config (
  company_id INTEGER PRIMARY KEY,
  spi_red_threshold FLOAT NOT NULL DEFAULT 0.6,
  spi_amber_threshold FLOAT NOT NULL DEFAULT 0.8,
  deadline_red_days INTEGER NOT NULL DEFAULT 0,
  deadline_amber_days INTEGER NOT NULL DEFAULT 14,
  risks_red INTEGER NOT NULL DEFAULT 3,
  risks_amber INTEGER NOT NULL DEFAULT 1,
  issues_amber INTEGER NOT NULL DEFAULT 1,
  low_progress_amber FLOAT NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operations_systems (
  id SERIAL PRIMARY KEY, company_id INTEGER, project_id INTEGER, name TEXT NOT NULL,
  description TEXT DEFAULT '', go_live_date DATE, status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operations_budget_items (
  id SERIAL PRIMARY KEY, operations_system_id INTEGER, category TEXT, name TEXT,
  planned_amount NUMERIC DEFAULT 0, actual_amount NUMERIC DEFAULT 0,
  unit TEXT, period_label TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS operations_incidents (
  id SERIAL PRIMARY KEY, operations_system_id INTEGER, title TEXT, severity TEXT,
  description TEXT, reported_at DATE, resolved_at DATE, cost_impact NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Open'
);
CREATE TABLE IF NOT EXISTS timeline_import_mappings (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, mappings_json TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS bug_import_mappings (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, mappings_json TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE TABLE IF NOT EXISTS jira_jql_presets (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, jql TEXT NOT NULL,
  context TEXT DEFAULT '',
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (company_id, name, context)
);
CREATE TABLE IF NOT EXISTS jira_sync_mappings (
  id SERIAL PRIMARY KEY, mappings_json TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jira_sync_mappings_company_id ON jira_sync_mappings (company_id);
`;

/** Advisory lock key serialising DDL across parallel vitest worker processes. */
const DDL_LOCK_KEY = 2026_0002;

/**
 * Create the tables if absent. Deliberately does NOT truncate or drop:
 * vitest runs test files in parallel workers, so a TRUNCATE in one suite would
 * delete rows another suite is mid-assertion on. Suites isolate themselves by
 * calling `seedProject()` and working only inside the project id it returns —
 * every repository read is already `WHERE project_id = ?`, so that is enough.
 *
 * `CREATE TABLE IF NOT EXISTS` is NOT concurrency-safe in Postgres: two workers
 * can both pass the existence check and then collide inserting into `pg_type`
 * (23505 on `pg_type_typname_nsp_index`). A session advisory lock — held on one
 * pinned connection, since advisory locks are per-session — serialises the whole
 * DDL block so only one worker creates and the rest see a genuine no-op.
 */
export async function setupRepoTables(): Promise<void> {
  const client = await testPool().connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [DDL_LOCK_KEY]);
    for (const stmt of DDL.split(';').map(s => s.trim()).filter(Boolean)) {
      await client.query(stmt);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [DDL_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

/** Insert a company and return its id for company-scoped repository suites. */
export async function seedCompany(name = 'Test Company'): Promise<number> {
  const result = await testDb().run('INSERT INTO companies (name) VALUES (?)', name);
  return Number(result.lastInsertRowid);
}

/** Insert a project and return its id, giving the calling suite a private scope. */
export async function seedProject(name = 'Test Project', extra: Record<string, unknown> = {}): Promise<number> {
  // Merge rather than concat: a caller passing `status` must override the default,
  // not produce `column "status" specified more than once`.
  const row: Record<string, unknown> = { name, status: 'Active', ...extra };
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await testPool().query(
    `INSERT INTO projects (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
    vals,
  );
  return rows[0].id as number;
}
