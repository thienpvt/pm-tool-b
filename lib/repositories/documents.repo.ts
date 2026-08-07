import { getDb } from '@/lib/db';

/**
 * Project documents.
 *
 * Two write shapes, both preserved verbatim from the route:
 *  - `type === 'status_report'` always inserts a new row (diary style, no upsert)
 *  - every other type is one row per (project, type) and upserts
 *
 * `contentJson` arrives already stringified. The caller owns `JSON.stringify`, which
 * keeps this module free of any opinion about the request body shape.
 *
 * Writes are fixed-column (no `Object.keys(body)`), so no allowlist is required —
 * see ALLOWLIST-DIFF.md.
 */

export async function listDocuments(projectId: number | string) {
  const db = await getDb();
  return db.all('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC', projectId);
}

export async function getDocument(docId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM documents WHERE id = ?', docId);
}

/** Existence + ownership probe used by PUT and DELETE before they touch a row. */
export async function findDocumentInProject(projectId: number | string, docId: number | string) {
  const db = await getDb();
  return db.get<{ id: number }>('SELECT id FROM documents WHERE id = ? AND project_id = ?', docId, projectId);
}

export async function findDocumentByType(projectId: number | string, type: string) {
  const db = await getDb();
  return db.get<{ id: number }>('SELECT id FROM documents WHERE project_id = ? AND type = ?', projectId, type);
}

export async function createDocument(
  projectId: number | string,
  type: string,
  title: string,
  contentJson: string,
) {
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO documents (project_id, type, title, content_json) VALUES (?,?,?,?)',
    projectId, type, title, contentJson,
  );
  return db.get('SELECT * FROM documents WHERE id = ?', r.lastInsertRowid);
}

/** Updates content/title and bumps `updated_at`, matching the route's NOW() write. */
export async function updateDocumentContent(
  docId: number | string,
  title: string,
  contentJson: string,
) {
  const db = await getDb();
  await db.run(
    'UPDATE documents SET content_json = ?, title = ?, updated_at = NOW() WHERE id = ?',
    contentJson, title, docId,
  );
  return db.get('SELECT * FROM documents WHERE id = ?', docId);
}

export async function deleteDocument(docId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM documents WHERE id = ?', docId);
}
