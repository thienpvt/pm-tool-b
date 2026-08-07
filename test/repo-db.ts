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

  async run(sql: string, ...params: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }> {
    let pgSql = this.toPositional(sql);
    if (/^\s*INSERT\s/i.test(sql)) pgSql += ' RETURNING id';
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
 * Minimal DDL for the tables Phase 2 plan 01 touches. Column sets match
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
  customer_id INTEGER, company_id INTEGER, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY, name TEXT, company_id INTEGER
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
  status TEXT, priority TEXT, impact TEXT, affected_activity_id INTEGER
);
CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY, project_id INTEGER, issue_id TEXT, description TEXT,
  root_cause TEXT, category TEXT, owner TEXT, trigger TEXT, mitigation TEXT,
  due_date TEXT, status TEXT, priority TEXT, impact TEXT, affected_activity_id INTEGER
);
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
  id SERIAL PRIMARY KEY, project_id INTEGER, name TEXT, start_date TEXT, end_date TEXT
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
`;

/**
 * Create the tables if absent. Deliberately does NOT truncate or drop:
 * vitest runs test files in parallel workers, so a TRUNCATE in one suite would
 * delete rows another suite is mid-assertion on. Suites isolate themselves by
 * calling `seedProject()` and working only inside the project id it returns —
 * every repository read is already `WHERE project_id = ?`, so that is enough.
 */
export async function setupRepoTables(): Promise<void> {
  await testDb().exec(DDL);
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
