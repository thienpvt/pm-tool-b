import { getDb } from '@/lib/db';

/**
 * Saved column-mapping templates for the two import paths:
 * `timeline_import_mappings` (activity/timeline import) and `bug_import_mappings`
 * (bug snapshot import).
 *
 * Timeline and bug mappings are company-scoped (Phase 9 TENANT-01).
 */

// ── Timeline mappings (company-scoped) ────────────────────────────────────────

export async function listTimelineMappings(companyId: number) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM timeline_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}

export async function getTimelineMappingById(id: number | string) {
  const db = await getDb();
  return db.get<{ id: number; company_id: number; name: string; mappings_json: string }>(
    'SELECT * FROM timeline_import_mappings WHERE id = ?',
    id,
  );
}

export async function findTimelineMappingByName(companyId: number, name: string) {
  const db = await getDb();
  return db.get(
    'SELECT * FROM timeline_import_mappings WHERE company_id = ? AND name = ?',
    companyId, name,
  );
}

export async function createTimelineMapping(companyId: number, name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO timeline_import_mappings (name, mappings_json, company_id) VALUES (?, ?, ?)',
    name, mappingsJson, companyId,
  );
  return db.get('SELECT * FROM timeline_import_mappings WHERE id = ?', r.lastInsertRowid);
}

export async function updateTimelineMapping(
  companyId: number,
  id: number | string,
  name: string,
  mappingsJson: string,
) {
  const db = await getDb();
  await db.run(
    'UPDATE timeline_import_mappings SET name = ?, mappings_json = ? WHERE id = ? AND company_id = ?',
    name, mappingsJson, id, companyId,
  );
  return db.get(
    'SELECT * FROM timeline_import_mappings WHERE id = ? AND company_id = ?',
    id, companyId,
  );
}

export async function deleteTimelineMapping(companyId: number, id: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM timeline_import_mappings WHERE id = ? AND company_id = ?',
    id, companyId,
  );
}

// ── Bug mappings (company-scoped) ─────────────────────────────────────────────

export async function listBugMappings(companyId: number) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM bug_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}

export async function getBugMappingById(id: number | string) {
  const db = await getDb();
  return db.get<{ id: number; company_id: number; name: string; mappings_json: string }>(
    'SELECT * FROM bug_import_mappings WHERE id = ?',
    id,
  );
}

export async function findBugMappingByName(companyId: number, name: string) {
  const db = await getDb();
  return db.get(
    'SELECT * FROM bug_import_mappings WHERE company_id = ? AND name = ?',
    companyId, name,
  );
}

/** Ids newest-first, used by the service to evict the oldest when the cap is reached. */
export async function bugMappingIds(companyId: number) {
  const db = await getDb();
  return db.all<{ id: number }>(
    'SELECT id FROM bug_import_mappings WHERE company_id = ? ORDER BY created_at DESC',
    companyId,
  );
}

export async function createBugMapping(companyId: number, name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO bug_import_mappings (name, mappings_json, company_id) VALUES (?, ?, ?)',
    name, mappingsJson, companyId,
  );
  return db.get('SELECT * FROM bug_import_mappings WHERE id = ?', r.lastInsertRowid);
}

export async function deleteBugMapping(companyId: number, id: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM bug_import_mappings WHERE id = ? AND company_id = ?',
    id, companyId,
  );
}
