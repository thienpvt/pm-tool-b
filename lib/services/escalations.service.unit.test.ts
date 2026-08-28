import { beforeEach, describe, expect, it, vi } from 'vitest';

const { assertProjectAccess, assertProjectWriteAccess, listEscalationsRepo, updateEscalationRepo } = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listEscalationsRepo: vi.fn(),
  updateEscalationRepo: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/escalations.repo', () => ({
  listEscalations: listEscalationsRepo,
  updateEscalation: updateEscalationRepo,
}));

import { listEscalations, updateEscalation } from './escalations.service';
import { ForbiddenError, NotFoundError } from './errors';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
});

const owner = { company_id: 5 as number | null, is_admin: 0 as number | boolean };
const foreign = { company_id: 9 as number | null, is_admin: 0 as number | boolean };

describe('escalations.service', () => {
  it('listEscalations asserts access before the repository', async () => {
    listEscalationsRepo.mockResolvedValue([{ id: 1 }]);
    await expect(listEscalations(7, owner)).resolves.toEqual([{ id: 1 }]);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
  });

  it('listEscalations does not call the repository when access is denied', async () => {
    assertProjectAccess.mockRejectedValue(new ForbiddenError());
    await expect(listEscalations(7, foreign)).rejects.toBeInstanceOf(ForbiddenError);
    expect(listEscalationsRepo).not.toHaveBeenCalled();
  });

  it('updateEscalation throws NotFoundError when no row matches', async () => {
    updateEscalationRepo.mockResolvedValue(undefined);
    await expect(updateEscalation(7, owner, 99, {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updateEscalation does not call the repository when write access is denied', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(updateEscalation(7, foreign, 1, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(updateEscalationRepo).not.toHaveBeenCalled();
  });
});
