import { Pool } from 'pg';
import crypto from 'crypto';
import { assertMigrated } from './migrate/assertMigrated';

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
    // Tables that use non-SERIAL primary keys (no 'id' column to RETURNING).
    // company_rag_config was missing here: its PK is company_id, so the admin
    // rag-config upsert failed at runtime with `column "id" does not exist`.
    const noIdTables = ['settings', 'company_jira_config', 'company_rag_config'];
    return !!table && !noIdTables.includes(table);
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

// ── Seed default users ─────────────────────────────────────────────────────────
export async function seedAuthData(db: DbClient) {
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

// ── SSL mode ───────────────────────────────────────────────────────────────────
// Driven by the standard libpq `sslmode` query param on DATABASE_URL — the portable,
// infra-agnostic way to control this (add `?sslmode=disable` for an on-prem Postgres
// without TLS, `?sslmode=require` or omit it for managed/cloud Postgres).
//   Fallback: if `sslmode` isn't set at all, disable TLS for railway.internal
//   (already-deployed Railway URLs), localhost, and private LAN hosts.
export function resolveSsl(databaseUrl: string): false | { rejectUnauthorized: boolean } {
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) return sslmode === 'disable' ? false : { rejectUnauthorized: false };
  const host = url.hostname;
  if (
    host.endsWith('railway.internal') ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  ) {
    return false;
  }
  return { rejectUnauthorized: false };
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
    ssl: resolveSsl(process.env.DATABASE_URL),
  });
  const client = new PostgresClient(pool);
  // Fail fast if the schema_migrations ledger is absent — schema creation is the
  // migrate job's job now (`npm run migrate`), never app boot.
  await assertMigrated((sql) => pool.query(sql));
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
  status: string; current_phase: string; description: string;
  objective: string; project_owner: string; budget: number; budget_currency: string;
  created_at: string;
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
  name: string; email: string; capacity_json: string; notes: string;
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
