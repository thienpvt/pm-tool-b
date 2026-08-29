import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '@/test/db';
import { seedProject, setupRepoTables, testDb, testKysely } from '@/test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

vi.mock('@/lib/db/kysely', () => ({
  getKysely: vi.fn(async () => testKysely()),
}));

import {
  createDocument,
  deleteDocument,
  findDocumentByType,
  findDocumentInProject,
  listDocuments,
  updateDocumentContent,
} from './documents.repo';

describe.skipIf(!hasTestDb)('documents.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('Documents Suite');
  });

  it('loads via getKysely', async () => {
    const { getKysely } = await import('@/lib/db/kysely');
    await listDocuments(projectId);
    expect(getKysely).toHaveBeenCalled();
  });

  it('creates a document and reads it back', async () => {
    const created = await createDocument(projectId, 'charter', 'Charter', '{"v":1}') as { id: number };
    const rows = await listDocuments(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('lists most recently created first', async () => {
    const p = await seedProject('Doc Order');
    const first = await createDocument(p, 'risk_log', 'Risk Log', '{}') as { id: number };
    const second = await createDocument(p, 'status_report', 'Weekly', '{}') as { id: number };

    const rows = await listDocuments(p) as { id: number }[];
    // created_at DESC — second should appear before first
    const ids = rows.map(r => r.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it('does not read another project documents', async () => {
    const other = await seedProject('Other Docs');
    await createDocument(other, 'charter', 'Theirs', '{}');

    const rows = await listDocuments(projectId) as { type: string }[];
    // Both projects get a 'charter' row; scoping ensures only this project's appears
    const types = rows.map(r => r.type);
    // This project has never had a charter — verify no bleed
    const ours = rows.filter(r => r.type === 'charter') as { project_id?: number }[];
    for (const doc of ours) {
      // Every charter row should belong to projectId, not other
      const full = await testDb().get<{ project_id: number }>(
        'SELECT project_id FROM documents WHERE id = ?',
        (doc as { id: number }).id,
      );
      expect(full?.project_id).toBe(projectId);
    }
  });

  it('findDocumentByType locates an existing document', async () => {
    const p = await seedProject('Find By Type');
    await createDocument(p, 'charter', 'Charter', '{}');
    const found = await findDocumentByType(p, 'charter');
    expect(found).toBeTruthy();
    expect(await findDocumentByType(p, 'nonexistent')).toBeUndefined();
  });

  it('findDocumentInProject requires ownership', async () => {
    const other = await seedProject('Ownership Check');
    const foreign = await createDocument(other, 'notes', 'Notes', '{}') as { id: number };

    expect(await findDocumentInProject(projectId, foreign.id)).toBeUndefined();
    expect(await findDocumentInProject(other, foreign.id)).toBeTruthy();
  });

  it('updateDocumentContent updates title and content_json', async () => {
    const doc = await createDocument(projectId, 'plan', 'Before', '{"old":1}') as { id: number };
    const updated = await updateDocumentContent(doc.id, 'After', '{"new":1}') as { title: string; content_json: string };

    expect(updated.title).toBe('After');
    expect(updated.content_json).toBe('{"new":1}');
  });

  it('deleteDocument removes the row', async () => {
    const doc = await createDocument(projectId, 'temp', 'Temp', '{}') as { id: number };
    await deleteDocument(doc.id);
    const rows = await listDocuments(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).not.toContain(doc.id);
  });
});
