import { getDb } from '@/lib/db';

/**
 * Saved column-mapping templates for the two import paths:
 * `timeline_import_mappings` (activity/timeline import) and `bug_import_mappings`
 * (bug snapshot import).
 *
 * Timeline mappings are company-scoped (Phase 9 TENANT-01). Bug mappings remain
 * global until 09-02.
 */

// ── Timeline mappings (company-scoped) ────────────────────────────────────────

export async function listTimelineMappings() {
  const db = await getDb();
  return db.all('SELECT * FROM timeline_import_mappings ORDER BY created_at DESC');
}

export async function getTimelineMappingById(id: number | string) {
  const db = await getDb();
  return db.get<{ id: number; company_id: number; name: string; mappings_json: string }>(
    'SELECT * FROM timeline_import_mappings WHERE id = ?',
    id,
  );
}

export async function createTimelineMapping(name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO timeline_import_mappings (name, mappings_json) VALUES (?, ?)',
    name, mappingsJson,
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

// ── Bug mappings (global until 09-02) ─────────────────────────────────────────

export async function listBugMappings() {
  const db = await getDb();
  return db.all('SELECT * FROM bug_import_mappings ORDER BY created_at DESC');
}

/** Ids newest-first, used by the route to evict the oldest when the cap is reached. */
export async function bugMappingIds() {
  const db = await getDb();
  return db.all<{ id: number }>('SELECT id FROM bug_import_mappings ORDER BY created_at DESC');
}

export async function createBugMapping(name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO bug_import_mappings (name, mappings_json) VALUES (?, ?)',
    name, mappingsJson,
  );
  return db.get('SELECT * FROM bug_import_mappings WHERE id = ?', r.lastInsertRowid);
}

export async function deleteBugMapping(id: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM bug_import_mappings WHERE id = ?', id);
}
