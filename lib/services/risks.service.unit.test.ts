import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertProjectAccess, listRisksRepo, createRiskRepo, updateRiskRepo, deleteRiskRepo } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  listRisksRepo: vi.fn(),
  createRiskRepo: vi.fn(),
  updateRiskRepo: vi.fn(),
  deleteRiskRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess }));
vi.mock('@/lib/repositories/risks.repo', () => ({
  listRisks: listRisksRepo,
  createRisk: createRiskRepo,
  updateRisk: updateRiskRepo,
  deleteRisk: deleteRiskRepo,
}));

import { createRisk, deleteRisk, listRisks, updateRisk } from './risks.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

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

    it('propagates ForbiddenError for a cross-company actor', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(listRisks(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('createRisk', () => {
    it('asserts access before inserting', async () => {
      const body = { description: 'x' };
      createRiskRepo.mockResolvedValue({ id: 2, description: 'x' });
      await expect(createRisk(7, owner, body)).resolves.toEqual({ id: 2, description: 'x' });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(createRiskRepo).toHaveBeenCalledWith(7, body);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(createRisk(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(createRiskRepo).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenError for a cross-company actor', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(createRisk(7, foreign, {})).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('updateRisk', () => {
    it('asserts access before updating', async () => {
      updateRiskRepo.mockResolvedValue({ id: 3, status: 'Closed' });
      await expect(updateRisk(7, owner, 3, { status: 'Closed' })).resolves.toEqual({
        id: 3,
        status: 'Closed',
      });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(updateRiskRepo).toHaveBeenCalledWith(7, 3, { status: 'Closed' });
    });

    it('throws NotFoundError when the repository returns undefined', async () => {
      updateRiskRepo.mockResolvedValue(undefined);
      await expect(updateRisk(7, owner, 99, { status: 'Closed' })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateRisk(7, foreign, 3, {})).rejects.toBeInstanceOf(ForbiddenError);
      expect(updateRiskRepo).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenError for a cross-company actor', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(updateRisk(7, foreign, 3, {})).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('deleteRisk', () => {
    it('asserts access before deleting', async () => {
      deleteRiskRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 1 });
      await expect(deleteRisk(7, owner, 3)).resolves.toEqual({ lastInsertRowid: 0, changes: 1 });
      expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
      expect(deleteRiskRepo).toHaveBeenCalledWith(7, 3);
    });

    it('throws NotFoundError when zero rows match', async () => {
      deleteRiskRepo.mockResolvedValue({ lastInsertRowid: 0, changes: 0 });
      await expect(deleteRisk(7, owner, 99)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('does not call the repository when access is denied', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteRisk(7, foreign, 3)).rejects.toBeInstanceOf(ForbiddenError);
      expect(deleteRiskRepo).not.toHaveBeenCalled();
    });

    it('propagates ForbiddenError for a cross-company actor', async () => {
      assertProjectAccess.mockRejectedValue(new ForbiddenError());
      await expect(deleteRisk(7, foreign, 3)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
