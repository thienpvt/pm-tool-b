import { getDb } from '@/lib/db';

/**
 * Saved column-mapping templates for the two import paths:
 * `timeline_import_mappings` (activity/timeline import) and `bug_import_mappings`
 * (bug snapshot import).
 *
 * Both tables are global, not company-scoped — that is the current behavior, and this
 * phase moves SQL without changing access rules. See 02-03-SUMMARY.md.
 */

// ── Timeline mappings ─────────────────────────────────────────────────────────

export async function listTimelineMappings() {
  const db = await getDb();
  return db.all('SELECT * FROM timeline_import_mappings ORDER BY created_at DESC');
}

export async function createTimelineMapping(name: string, mappingsJson: string) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO timeline_import_mappings (name, mappings_json) VALUES (?, ?)',
    name, mappingsJson,
  );
  return db.get('SELECT * FROM timeline_import_mappings WHERE id = ?', r.lastInsertRowid);
}

export async function updateTimelineMapping(id: number | string, name: string, mappingsJson: string) {
  const db = await getDb();
  await db.run(
    'UPDATE timeline_import_mappings SET name = ?, mappings_json = ? WHERE id = ?',
    name, mappingsJson, id,
  );
  return db.get('SELECT * FROM timeline_import_mappings WHERE id = ?', id);
}

export async function deleteTimelineMapping(id: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM timeline_import_mappings WHERE id = ?', id);
}

// ── Bug mappings ──────────────────────────────────────────────────────────────

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
