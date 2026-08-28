import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listRisksRepo,
  createRiskRepo,
  updateRiskRepo,
  findRiskByCode,
  getRiskRepo,
  deactivateRiskRepo,
  auditLog,
  appendDueDateHistory,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listRisksRepo: vi.fn(),
  createRiskRepo: vi.fn(),
  updateRiskRepo: vi.fn(),
  findRiskByCode: vi.fn(),
  getRiskRepo: vi.fn(),
  deactivateRiskRepo: vi.fn(),
  auditLog: vi.fn(),
  appendDueDateHistory: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/modules/audit/backend/services/audit.service', () => ({ auditLog }));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: listRisksRepo,
  createRisk: createRiskRepo,
  updateRisk: updateRiskRepo,
  findRiskByCode,
  getRisk: getRiskRepo,
  deactivateRisk: deactivateRiskRepo,
}));
vi.mock('@/lib/repositories/raid-due-date-history.repo', () => ({
  appendDueDateHistory,
}));

import { createRisk, deactivateRisk, listRisks, updateRisk } from './risks.service';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  findRiskByCode.mockResolvedValue(undefined);
  auditLog.mockResolvedValue(undefined);
  appendDueDateHistory.mockResolvedValue(undefined);
});

const owner = {
  company_id: 5 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'],
  status: 'active',
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};
const foreign = {
  company_id: 9 as number | null,
  is_admin: 0 as number | boolean,
  roles: ['pm'],
  status: 'active',
  user_id: 3,
  username: 'bob',
  display_name: 'Bob',
  email: 'bob@example.com',
};

describe('risks.service', () => {
  describe('listRisks', () => {
    it('asserts access before calling the repository', async () => {
      listRisksRepo.mockResolvedValue([{ id: 1 }]);
      await expect(listRisks(7, owner)).resolves.toEqual([{ id: 1 }]);
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(listRisksRepo).toHaveBeenCalledWith(7);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(listRisks(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
      expect(listRisksRepo).not.toHaveBeenCalled();
    });
  });

  describe('createRisk', () => {
    it('asserts write access before inserting', async () => {
      const body = { description: 'x' };
      createRiskRepo.mockResolvedValue({ id: 2, description: 'x', code: 'R-001' });
      await expect(createRisk(7, owner, body)).resolves.toEqual({
        id: 2,
        description: 'x',
        code: 'R-001',
      });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(createRiskRepo).toHaveBeenCalledWith(7, body);
    });

    it('throws ConflictError when code duplicates an existing row (case-insensitive)', async () => {
      findRiskByCode.mockResolvedValue({ id: 5 });
      await expect(createRisk(7, owner, { code: 'R-001', description: 'dup' })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(createRiskRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });

    it('calls auditLog action create after successful insert (D-02, D-03)', async () => {
      const created = {
        id: 2,
        code: 'R-001',
        description: 'x',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-03-01',
        owner: 'Ava',
      };
      createRiskRepo.mockResolvedValue(created);

      await createRisk(7, owner, { description: 'x' });

      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'risk',
        entity_id: '2',
        action: 'create',
        before: null,
        after: {
          id: 2,
          code: 'R-001',
          description: 'x',
          status: 'Open',
          priority: 'Medium',
          due_date: '2026-03-01',
          owner: 'Ava',
        },
      });
    });

    it('maps SQLSTATE 23505 from the repository to ConflictError', async () => {
      createRiskRepo.mockRejectedValue({ code: '23505' });
      await expect(createRisk(7, owner, { code: 'R-002' })).rejects.toBeInstanceOf(ConflictError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(createRisk(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(createRiskRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });
  });

  describe('updateRisk', () => {
    it('asserts write access before updating', async () => {
      updateRiskRepo.mockResolvedValue({ id: 3, status: 'Closed' });
      await expect(updateRisk(7, owner, 3, { status: 'Closed' })).resolves.toEqual({
        id: 3,
        status: 'Closed',
      });
      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(updateRiskRepo).toHaveBeenCalledWith(7, 3, { status: 'Closed' });
    });

    it('throws ConflictError when changing code to a sibling row code', async () => {
      findRiskByCode.mockResolvedValue({ id: 9 });
      await expect(updateRisk(7, owner, 3, { code: 'R-009' })).rejects.toBeInstanceOf(ConflictError);
      expect(updateRiskRepo).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when the repository returns undefined', async () => {
      updateRiskRepo.mockResolvedValue(undefined);
      await expect(updateRisk(7, owner, 99, { status: 'Closed' })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateRisk(7, foreign, 3, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateRiskRepo).not.toHaveBeenCalled();
    });

    it('appends due-date history and auditLog when due_date changes', async () => {
      getRiskRepo.mockResolvedValue({
        id: 3,
        code: 'R-003',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      });
      updateRiskRepo.mockResolvedValue({
        id: 3,
        code: 'R-003',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-02-01',
        owner: 'Ava',
      });

      await updateRisk(7, owner, 3, { due_date: '2026-02-01' });

      expect(appendDueDateHistory).toHaveBeenCalledWith({
        entity_type: 'risk',
        entity_id: '3',
        old_due: '2026-01-01',
        new_due: '2026-02-01',
        changed_by: owner.user_id,
      });
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'risk',
        entity_id: '3',
        action: 'due_date_change',
        before: { due_date: '2026-01-01' },
        after: { due_date: '2026-02-01' },
      });
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
    });

    it('calls auditLog action update for status-only field changes (D-02)', async () => {
      const prior = {
        id: 3,
        code: 'R-003',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      };
      const updated = { ...prior, status: 'Closed' };
      getRiskRepo.mockResolvedValue(prior);
      updateRiskRepo.mockResolvedValue(updated);

      await updateRisk(7, owner, 3, { status: 'Closed' });

      expect(getRiskRepo).toHaveBeenCalledWith(7, 3);
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'risk',
        entity_id: '3',
        action: 'update',
        before: {
          id: 3,
          code: 'R-003',
          description: 'd',
          status: 'Open',
          priority: 'Medium',
          due_date: '2026-01-01',
          owner: 'Ava',
        },
        after: {
          id: 3,
          code: 'R-003',
          description: 'd',
          status: 'Closed',
          priority: 'Medium',
          due_date: '2026-01-01',
          owner: 'Ava',
        },
      });
    });

    it('does not append due-date history when due_date is unchanged', async () => {
      getRiskRepo.mockResolvedValue({ id: 3, due_date: '2026-01-01' });
      updateRiskRepo.mockResolvedValue({ id: 3, due_date: '2026-01-01' });

      await updateRisk(7, owner, 3, { due_date: '2026-01-01' });

      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'due_date_change' }));
    });

    it('does not append due-date history when due_date is omitted', async () => {
      const prior = {
        id: 3,
        code: 'R-003',
        description: 'd',
        status: 'Open',
        priority: 'Medium',
        due_date: '2026-01-01',
        owner: 'Ava',
      };
      getRiskRepo.mockResolvedValue(prior);
      updateRiskRepo.mockResolvedValue({ ...prior, status: 'Closed' });

      await updateRisk(7, owner, 3, { status: 'Closed' });

      expect(getRiskRepo).toHaveBeenCalledWith(7, 3);
      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'due_date_change' }));
      expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: 'update' }));
    });

    it('does not append history when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateRisk(7, foreign, 3, { due_date: '2026-02-01' })).rejects.toBeInstanceOf(ForbiddenError);
      expect(appendDueDateHistory).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });
  });

  describe('deactivateRisk', () => {
    it('sets status deactivated, writes auditLog action deactivate, and does not delete the row', async () => {
      getRiskRepo.mockResolvedValue({ id: 3, status: 'Open' });
      deactivateRiskRepo.mockResolvedValue({ id: 3, status: 'deactivated', deactivated_at: '2026-01-01' });

      await expect(deactivateRisk(7, owner, 3)).resolves.toMatchObject({
        id: 3,
        status: 'deactivated',
      });

      expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
      expect(getRiskRepo).toHaveBeenCalledWith(7, 3);
      expect(deactivateRiskRepo).toHaveBeenCalledWith(7, 3);
      expect(auditLog).toHaveBeenCalledWith({
        actor_id: owner.user_id,
        company_id: owner.company_id,
        entity_type: 'risk',
        entity_id: '3',
        action: 'deactivate',
        before: { status: 'Open' },
        after: { status: 'deactivated' },
      });
    });

    it('throws NotFoundError when zero rows match', async () => {
      getRiskRepo.mockResolvedValue({ id: 99, status: 'Open' });
      deactivateRiskRepo.mockResolvedValue(undefined);
      await expect(deactivateRisk(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when write access is denied', async () => {
      assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
      await expect(deactivateRisk(7, foreign, 3)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deactivateRiskRepo).not.toHaveBeenCalled();
      expect(auditLog).not.toHaveBeenCalled();
    });
  });
});
