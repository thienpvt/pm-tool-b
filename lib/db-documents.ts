import type { Pool } from 'pg';

export const DOCUMENTS_DDL_FLAG = 'documents_ddl_v1';

/** Hermetic unit-test assertions against the DDL strings (D-11). */
export const DOCUMENTS_DDL = [
  `
    CREATE TABLE IF NOT EXISTS document_catalog (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL CHECK (stage IN ('L0','L1','L2','L3','L4','L5','ALL')),
      mandatory BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS document_templates (
      id SERIAL PRIMARY KEY,
      catalog_id INTEGER NOT NULL REFERENCES document_catalog(id),
      company_id INTEGER NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL,
      document_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      effective_date DATE NOT NULL,
      guidance TEXT NOT NULL DEFAULT '',
      template_url TEXT,
      retired_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (catalog_id, version)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS project_document_checklist (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      catalog_id INTEGER NOT NULL REFERENCES document_catalog(id),
      status TEXT NOT NULL DEFAULT 'none' CHECK (status IN ('none','drafting','pending_approval','approved','not_applicable')),
      confluence_url TEXT,
      approved_at DATE,
      approved_by TEXT,
      na_reason TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (project_id, catalog_id)
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

async function migrateDocumentsDdl(pool: Pool): Promise<void> {
  if (await settingsFlagExists(pool, DOCUMENTS_DDL_FLAG)) return;

  for (const sql of DOCUMENTS_DDL) {
    await pool.query(sql);
  }

  await writeSettingsFlag(pool, DOCUMENTS_DDL_FLAG);
}

/** Idempotent document catalog/template/checklist DDL in the getDb migrate loop (D-11). */
export async function migrateDocuments(pool: Pool): Promise<void> {
  try {
    await migrateDocumentsDdl(pool);
  } catch {
    /* settings table may not exist yet on first run — will retry next boot */
  }
}
