import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

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

function deleteResult(numDeletedRows: bigint | number | undefined) {
  return { lastInsertRowid: 0, changes: Number(numDeletedRows ?? 0) };
}

export async function listDocuments(projectId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('documents')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getDocument(docId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', Number(docId))
    .executeTakeFirst();
}

/** Existence + ownership probe used by PUT and DELETE before they touch a row. */
export async function findDocumentInProject(projectId: number | string, docId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('documents')
    .select('id')
    .where('id', '=', Number(docId))
    .where('project_id', '=', Number(projectId))
    .executeTakeFirst();
}

export async function findDocumentByType(projectId: number | string, type: string) {
  const db = await getKysely();
  return db
    .selectFrom('documents')
    .select('id')
    .where('project_id', '=', Number(projectId))
    .where('type', '=', type)
    .executeTakeFirst();
}

/** Document shape consumed by Word export, optionally pinned to a specific report row. */
export async function getDocumentForExport(
  projectId: number | string,
  type: string,
  documentId?: number | string,
) {
  const db = await getKysely();
  if (documentId != null) {
    return db
      .selectFrom('documents')
      .selectAll()
      .where('id', '=', Number(documentId))
      .where('project_id', '=', Number(projectId))
      .executeTakeFirst();
  }
  return db
    .selectFrom('documents')
    .selectAll()
    .where('project_id', '=', Number(projectId))
    .where('type', '=', type)
    .executeTakeFirst();
}

export async function createDocument(
  projectId: number | string,
  type: string,
  title: string,
  contentJson: string,
) {
  const db = await getKysely();
  return db
    .insertInto('documents')
    .values({
      project_id: Number(projectId),
      type,
      title,
      content_json: contentJson,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Updates content/title and bumps `updated_at`, matching the route's NOW() write. */
export async function updateDocumentContent(
  docId: number | string,
  title: string,
  contentJson: string,
) {
  const db = await getKysely();
  await db
    .updateTable('documents')
    .set({
      content_json: contentJson,
      title,
      updated_at: sql`NOW()`,
    })
    .where('id', '=', Number(docId))
    .execute();
  return db
    .selectFrom('documents')
    .selectAll()
    .where('id', '=', Number(docId))
    .executeTakeFirstOrThrow();
}

export async function deleteDocument(docId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('documents')
    .where('id', '=', Number(docId))
    .execute();
  return deleteResult(result.numDeletedRows);
}
