import {
  createDocument as createDocumentRepo,
  deleteDocument as deleteDocumentRepo,
  findDocumentByType,
  findDocumentInProject,
  getDocument,
  listDocuments as listDocumentsRepo,
  updateDocumentContent,
} from '@/lib/repositories/documents.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError, ValidationError } from './errors';

export async function listDocuments(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listDocumentsRepo(projectId);
}

/**
 * Upsert-or-diary write. status_report always inserts; other types are one-per-type.
 * content is stringified here so the route stays free of that policy.
 */
export async function upsertDocument(
  projectId: number | string,
  actor: AccessActor,
  body: { type?: string; title?: string; content?: unknown },
) {
  await assertProjectAccess(projectId, actor);

  if (body.type === 'status_report') {
    const created = await createDocumentRepo(
      projectId,
      'status_report',
      body.title ?? 'Weekly Report',
      JSON.stringify(body.content ?? {}),
    );
    return { row: created, created: true };
  }

  const existing = await findDocumentByType(projectId, body.type ?? '');
  if (existing) {
    const updated = await updateDocumentContent(
      existing.id,
      body.title ?? body.type ?? '',
      JSON.stringify(body.content),
    );
    return { row: updated, created: false };
  }

  const created = await createDocumentRepo(
    projectId,
    body.type ?? '',
    body.title ?? body.type ?? '',
    JSON.stringify(body.content ?? {}),
  );
  return { row: created, created: true };
}

export async function updateDocument(
  projectId: number | string,
  actor: AccessActor,
  docId: number | string,
  title: string,
  content: unknown,
) {
  await assertProjectAccess(projectId, actor);
  const doc = await findDocumentInProject(projectId, docId);
  if (!doc) throw new NotFoundError('Not found', 'document');
  await updateDocumentContent(docId, title, JSON.stringify(content));
  return getDocument(docId);
}

export async function deleteDocument(
  projectId: number | string,
  actor: AccessActor,
  docId: number | string | null,
) {
  await assertProjectAccess(projectId, actor);
  if (!docId) throw new ValidationError('Missing docId', 'docId');
  const doc = await findDocumentInProject(projectId, docId);
  if (!doc) throw new NotFoundError('Not found', 'document');
  await deleteDocumentRepo(docId);
  return { ok: true as const };
}
