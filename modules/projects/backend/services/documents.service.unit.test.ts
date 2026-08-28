import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listDocumentsRepo,
  createDocumentRepo,
  findDocumentByType,
  findDocumentInProject,
  getDocument,
  updateDocumentContent,
  deleteDocumentRepo,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listDocumentsRepo: vi.fn(),
  createDocumentRepo: vi.fn(),
  findDocumentByType: vi.fn(),
  findDocumentInProject: vi.fn(),
  getDocument: vi.fn(),
  updateDocumentContent: vi.fn(),
  deleteDocumentRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/projects/backend/repositories/documents.repo', () => ({
  listDocuments: listDocumentsRepo,
  createDocument: createDocumentRepo,
  findDocumentByType,
  findDocumentInProject,
  getDocument,
  updateDocumentContent,
  deleteDocument: deleteDocumentRepo,
}));

import { deleteDocument, listDocuments, updateDocument, upsertDocument } from './documents.service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/services/errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('documents.service', () => {
  it('listDocuments asserts access before the repository', async () => {
    listDocumentsRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listDocuments(7, owner)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listDocuments does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listDocuments(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listDocumentsRepo).not.toHaveBeenCalled();
  });

  it('upsertDocument asserts write access before inserting status_report', async () => {
    createDocumentRepo.mockResolvedValue({ id: 3, type: 'status_report' });
    await upsertDocument(7, owner, {
      type: 'status_report',
      title: 'W1',
      content: { a: 1 },
    });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
  });

  it('upsertDocument always inserts status_report', async () => {
    createDocumentRepo.mockResolvedValue({ id: 3, type: 'status_report' });
    const result = await upsertDocument(7, owner, {
      type: 'status_report',
      title: 'W1',
      content: { a: 1 },
    });
    expect(result.created).toBe(true);
    expect(createDocumentRepo).toHaveBeenCalledWith(
      7,
      'status_report',
      'W1',
      JSON.stringify({ a: 1 }),
    );
    expect(findDocumentByType).not.toHaveBeenCalled();
  });

  it('upsertDocument does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(upsertDocument(7, foreign, { type: 'plan' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(createDocumentRepo).not.toHaveBeenCalled();
  });

  it('updateDocument asserts write access before updating', async () => {
    findDocumentInProject.mockResolvedValue({ id: 9 });
    getDocument.mockResolvedValue({ id: 9, title: 't' });
    await updateDocument(7, owner, 9, 't', {});
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(updateDocumentContent).toHaveBeenCalled();
  });

  it('updateDocument throws NotFoundError when doc not in project', async () => {
    findDocumentInProject.mockResolvedValue(undefined);
    await expect(updateDocument(7, owner, 9, 't', {})).rejects.toBeInstanceOf(NotFoundError);
    expect(updateDocumentContent).not.toHaveBeenCalled();
  });

  it('deleteDocument throws ValidationError without docId', async () => {
    await expect(deleteDocument(7, owner, null)).rejects.toBeInstanceOf(ValidationError);
  });

  it('deleteDocument does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(deleteDocument(7, foreign, '1')).rejects.toBeInstanceOf(ForbiddenError);
    expect(findDocumentInProject).not.toHaveBeenCalled();
  });

  it('deleteDocument asserts write access before deleting', async () => {
    findDocumentInProject.mockResolvedValue({ id: 1 });
    deleteDocumentRepo.mockResolvedValue(undefined);
    await deleteDocument(7, owner, '1');
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(deleteDocumentRepo).toHaveBeenCalled();
  });
});
