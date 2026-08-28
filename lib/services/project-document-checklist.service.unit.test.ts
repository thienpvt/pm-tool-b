import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listChecklistByProject,
  getChecklistItemRepo,
  updateChecklistItemRepo,
  auditLog,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listChecklistByProject: vi.fn(),
  getChecklistItemRepo: vi.fn(),
  updateChecklistItemRepo: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('./access', () => ({
  assertProjectAccess,
  assertProjectWriteAccess,
}));

vi.mock('@/lib/repositories/project-document-checklist.repo', () => ({
  listChecklistByProject,
  getChecklistItem: getChecklistItemRepo,
  updateChecklistItem: updateChecklistItemRepo,
}));

vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog }));

import {
  listProjectDocumentChecklist,
  getChecklistItem,
  patchChecklistItem,
} from './project-document-checklist.service';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

beforeEach(() => vi.clearAllMocks());

const pm = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'] as const,
  user_id: 2,
  username: 'pm',
  display_name: 'PM',
  email: 'pm@acme.com',
  status: 'active' as const,
};

const viewer = { ...pm, roles: ['viewer'] as const, user_id: 3 };

const existingItem = {
  id: 100,
  project_id: 7,
  catalog_id: 1,
  status: 'none',
  confluence_url: null,
  approved_at: null,
  approved_by: null,
  na_reason: null,
  notes: null,
  created_at: '',
  updated_at: '',
  catalog_name: 'Charter',
  catalog_stage: 'L2',
  catalog_mandatory: true,
  catalog_active: true,
};

describe('listProjectDocumentChecklist', () => {
  it('calls assertProjectAccess and returns rows', async () => {
    assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
    listChecklistByProject.mockResolvedValue([existingItem]);
    await expect(listProjectDocumentChecklist(7, pm)).resolves.toHaveLength(1);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, pm);
  });
});

describe('getChecklistItem', () => {
  it('throws NotFoundError when item missing', async () => {
    assertProjectAccess.mockResolvedValue({ company_id: 5, customer_company_id: null });
    getChecklistItemRepo.mockResolvedValue(undefined);
    await expect(getChecklistItem(7, 100, pm)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('patchChecklistItem (D-06, D-07, D-08, D-14)', () => {
  beforeEach(() => {
    assertProjectWriteAccess.mockResolvedValue(undefined);
    getChecklistItemRepo.mockResolvedValue(existingItem);
    updateChecklistItemRepo.mockResolvedValue({ ...existingItem, status: 'drafting' });
    auditLog.mockResolvedValue(undefined);
  });

  it('throws ForbiddenError for viewer (D-06)', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(patchChecklistItem(7, 100, viewer, { status: 'drafting' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    expect(updateChecklistItemRepo).not.toHaveBeenCalled();
  });

  it('rejects http-scheme confluence_url (D-07)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, {
        status: 'pending_approval',
        confluence_url: 'http://bad.example.com',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects data-url confluence_url (D-07)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, {
        status: 'pending_approval',
        confluence_url: 'data:text/plain;base64,abc',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('approved requires approved_at and approved_by (D-08)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, {
        status: 'approved',
        confluence_url: 'https://conf.example.com/x',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('not_applicable requires na_reason (D-08)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, { status: 'not_applicable' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows empty confluence_url for none and drafting (D-07)', async () => {
    await expect(patchChecklistItem(7, 100, pm, { status: 'none' })).resolves.toBeDefined();
    await expect(patchChecklistItem(7, 100, pm, { status: 'drafting' })).resolves.toBeDefined();
  });

  it('rejects empty confluence_url for pending_approval (D-07)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, { status: 'pending_approval' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects binary field keys (D-07)', async () => {
    await expect(
      patchChecklistItem(7, 100, pm, { status: 'drafting', file: 'x' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('allows pending_approval when confluence_url exists on row (WR-01)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      confluence_url: 'https://conf.example.com/existing',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'pending_approval',
      confluence_url: 'https://conf.example.com/existing',
    });
    await expect(
      patchChecklistItem(7, 100, pm, { status: 'pending_approval' }),
    ).resolves.toBeDefined();
    expect(updateChecklistItemRepo).toHaveBeenCalled();
  });

  it('allows notes patch on approved item without resending approval fields (WR-01)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'approved',
      confluence_url: 'https://conf.example.com/x',
      approved_at: '2026-01-15',
      approved_by: '42',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'approved',
      confluence_url: 'https://conf.example.com/x',
      approved_at: '2026-01-15',
      approved_by: '42',
      notes: 'updated',
    });
    await expect(
      patchChecklistItem(7, 100, pm, { notes: 'updated' }),
    ).resolves.toBeDefined();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_checklist',
        entity_id: '100',
        action: 'update',
      }),
    );
  });

  it('calls auditLog action update when only approved_at and approved_by change (D-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'approved',
      confluence_url: 'https://conf.example.com/x',
      approved_at: '2026-01-15',
      approved_by: '42',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'approved',
      confluence_url: 'https://conf.example.com/x',
      approved_at: '2026-02-01',
      approved_by: '99',
    });
    await patchChecklistItem(7, 100, pm, {
      approved_at: '2026-02-01',
      approved_by: '99',
    });
    expect(auditLog).toHaveBeenCalledWith({
      actor_id: pm.user_id,
      company_id: pm.company_id,
      entity_type: 'document_checklist',
      entity_id: '100',
      action: 'update',
      before: {
        status: 'approved',
        confluence_url: 'https://conf.example.com/x',
        approved_at: '2026-01-15',
        approved_by: '42',
        na_reason: null,
        notes: null,
      },
      after: {
        status: 'approved',
        confluence_url: 'https://conf.example.com/x',
        approved_at: '2026-02-01',
        approved_by: '99',
        na_reason: null,
        notes: null,
      },
    });
  });

  it('calls auditLog action update when only na_reason changes (D-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'not_applicable',
      na_reason: 'Out of scope',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'not_applicable',
      na_reason: 'Revised rationale',
    });
    await patchChecklistItem(7, 100, pm, { na_reason: 'Revised rationale' });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_checklist',
        entity_id: '100',
        action: 'update',
        before: expect.objectContaining({ na_reason: 'Out of scope' }),
        after: expect.objectContaining({ na_reason: 'Revised rationale' }),
      }),
    );
  });

  it('calls auditLog action update when only notes change (D-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      notes: 'old note',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      notes: 'new note',
    });
    await patchChecklistItem(7, 100, pm, { notes: 'new note' });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_checklist',
        action: 'update',
        before: expect.objectContaining({ notes: 'old note' }),
        after: expect.objectContaining({ notes: 'new note' }),
      }),
    );
  });

  it('does not call auditLog when none of the six tracked fields change (D-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      notes: 'same',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      notes: 'same',
    });
    await patchChecklistItem(7, 100, pm, { notes: 'same' });
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('clears approval metadata when downgrading from approved (WR-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'approved',
      confluence_url: 'https://conf.example.com/x',
      approved_at: '2026-01-15',
      approved_by: '42',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      approved_at: null,
      approved_by: null,
    });
    await patchChecklistItem(7, 100, pm, { status: 'drafting' });
    expect(updateChecklistItemRepo).toHaveBeenCalledWith(
      7,
      100,
      expect.objectContaining({
        status: 'drafting',
        approved_at: null,
        approved_by: null,
      }),
    );
  });

  it('clears na_reason when leaving not_applicable (WR-02)', async () => {
    getChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'not_applicable',
      na_reason: 'Out of scope',
    });
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'none',
      na_reason: null,
    });
    await patchChecklistItem(7, 100, pm, { status: 'none' });
    expect(updateChecklistItemRepo).toHaveBeenCalledWith(
      7,
      100,
      expect.objectContaining({
        status: 'none',
        na_reason: null,
      }),
    );
  });

  it('calls auditLog on status change (D-14)', async () => {
    updateChecklistItemRepo.mockResolvedValue({
      ...existingItem,
      status: 'drafting',
      confluence_url: 'https://conf.example.com/x',
    });
    await patchChecklistItem(7, 100, pm, {
      status: 'drafting',
      confluence_url: 'https://conf.example.com/x',
    });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'document_checklist',
        action: 'status_change',
      }),
    );
  });
});
