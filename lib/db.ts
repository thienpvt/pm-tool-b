import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'pm.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function hashPwd(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function initSchema(db: Database.Database) {
  // ── Auth tables ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
      is_admin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL
    );
  `);

  // ── Migrate existing tables — safe to run repeatedly ──────────────────────
  try { db.exec(`ALTER TABLE activities ADD COLUMN delay_owner TEXT DEFAULT 'N/A'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE activities ADD COLUMN delay_reason TEXT DEFAULT ''`); } catch { /* already exists */ }
  // risks & issues — new fields
  try { db.exec(`ALTER TABLE risks ADD COLUMN priority TEXT DEFAULT 'Medium'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE risks ADD COLUMN impact TEXT DEFAULT 'Major'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE risks ADD COLUMN affected_activity_id INTEGER`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE issues ADD COLUMN priority TEXT DEFAULT 'Medium'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE issues ADD COLUMN impact TEXT DEFAULT 'Major'`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE issues ADD COLUMN affected_activity_id INTEGER`); } catch { /* already exists */ }
  // customers support
  try { db.exec(`ALTER TABLE projects ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL`); } catch { /* already exists */ }
  // company scoping
  try { db.exec(`ALTER TABLE projects ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE customers ADD COLUMN company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL`); } catch { /* already exists */ }

  try { db.exec(`CREATE TABLE IF NOT EXISTS project_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    name TEXT DEFAULT ''
  )`); } catch { /* already exists */ }

  seedAuthData(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT DEFAULT '',
      contact_name TEXT DEFAULT '',
      contact_email TEXT DEFAULT '',
      contact_phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      client TEXT,
      pm_name TEXT,
      pm_email TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'active',
      current_phase TEXT DEFAULT 'Initiation',
      description TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      delay_reason TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      domain TEXT,
      role TEXT,
      name TEXT NOT NULL,
      capacity_json TEXT DEFAULT '{}',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      frequency TEXT,
      content TEXT,
      participants TEXT,
      method TEXT,
      type TEXT DEFAULT 'regular'
    );

    CREATE TABLE IF NOT EXISTS escalation_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      level INTEGER NOT NULL,
      level_name TEXT,
      channel TEXT,
      participants TEXT,
      input TEXT,
      output TEXT
    );

    CREATE TABLE IF NOT EXISTS risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      risk_id TEXT,
      description TEXT NOT NULL,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open'
    );

    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      issue_id TEXT,
      description TEXT NOT NULL,
      root_cause TEXT,
      category TEXT,
      owner TEXT,
      trigger TEXT,
      mitigation TEXT,
      due_date TEXT,
      status TEXT DEFAULT 'Open'
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      content_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedAuthData(db: Database.Database) {
  const { c } = db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (c > 0) return; // already seeded

  // Create default company
  db.prepare('INSERT OR IGNORE INTO companies (name) VALUES (?)').run('Chartertech Global');
  const company = db.prepare("SELECT id FROM companies WHERE name = 'Chartertech Global'").get() as { id: number };

  // Create admin (no company)
  db.prepare('INSERT OR IGNORE INTO users (username, password_hash, display_name, is_admin) VALUES (?,?,?,?)')
    .run('admin', hashPwd('Khang@19'), 'Administrator', 1);

  // Create ct_user1 linked to Chartertech Global
  db.prepare('INSERT OR IGNORE INTO users (username, password_hash, display_name, company_id, is_admin) VALUES (?,?,?,?,?)')
    .run('ct_user1', hashPwd('Ctech@26'), 'CT User 1', company.id, 0);

  // Assign all existing projects + customers to Chartertech Global
  db.prepare('UPDATE projects SET company_id = ? WHERE company_id IS NULL').run(company.id);
  db.prepare('UPDATE customers SET company_id = ? WHERE company_id IS NULL').run(company.id);
}

export type Customer = {
  id: number;
  name: string;
  industry: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  notes: string;
  created_at: string;
};

export type Project = {
  id: number;
  name: string;
  client: string;
  customer_id: number | null;
  pm_name: string;
  pm_email: string;
  start_date: string;
  end_date: string;
  status: string;
  current_phase: string;
  description: string;
  created_at: string;
};

export type Activity = {
  id: number;
  project_id: number;
  phase: string;
  no: string;
  activity: string;
  deliverable: string;
  sign_off_doc: string;
  accountable: string;
  responsible: string;
  support: string;
  plan_start: string;
  plan_end: string;
  actual_start: string;
  actual_end: string;
  status: string;
  completion_pct: number;
  notes: string;
  order_idx: number;
  delay_owner: string;
  delay_reason: string;
};

export type TeamMember = {
  id: number;
  project_id: number;
  domain: string;
  role: string;
  name: string;
  capacity_json: string;
  notes: string;
};

export type Meeting = {
  id: number;
  project_id: number;
  name: string;
  frequency: string;
  content: string;
  participants: string;
  method: string;
  type: string;
};

export type EscalationLevel = {
  id: number;
  project_id: number;
  level: number;
  level_name: string;
  channel: string;
  participants: string;
  input: string;
  output: string;
};

export type Risk = {
  id: number;
  project_id: number;
  risk_id: string;
  description: string;
  category: string;
  owner: string;
  trigger: string;
  mitigation: string;
  due_date: string;
  status: string;
};

export type Issue = {
  id: number;
  project_id: number;
  issue_id: string;
  description: string;
  root_cause: string;
  category: string;
  owner: string;
  trigger: string;
  mitigation: string;
  due_date: string;
  status: string;
};

export type Document = {
  id: number;
  project_id: number;
  type: string;
  title: string;
  content_json: string;
  created_at: string;
  updated_at: string;
};
