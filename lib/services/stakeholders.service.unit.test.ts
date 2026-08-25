import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertProjectAccess,
  assertProjectWriteAccess,
  listStakeholdersRepo,
  hasActiveStakeholderForRole,
  insertStakeholderRepo,
  endStakeholderRepo,
  findUserById,
  auditLogFn,
} = vi.hoisted(() => ({
  assertProjectAccess: vi.fn(),
  assertProjectWriteAccess: vi.fn(),
  listStakeholdersRepo: vi.fn(),
  hasActiveStakeholderForRole: vi.fn(),
  insertStakeholderRepo: vi.fn(),
  endStakeholderRepo: vi.fn(),
  findUserById: vi.fn(),
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/services/access', () => ({ assertProjectAccess, assertProjectWriteAccess }));
vi.mock('@/lib/repositories/stakeholders.repo', () => ({
  listStakeholders: listStakeholdersRepo,
  hasActiveStakeholderForRole,
  insertStakeholder: insertStakeholderRepo,
  endStakeholder: endStakeholderRepo,
}));
vi.mock('@/lib/repositories/users.repo', () => ({ findUserById }));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));

import {
  createProjectStakeholder,
  endProjectStakeholder,
  listProjectStakeholders,
} from './stakeholders.service';
import { ForbiddenError, ValidationError } from './errors';
import type { AccessActor } from './access';

beforeEach(() => {
  vi.clearAllMocks();
  assertProjectAccess.mockResolvedValue(undefined);
  assertProjectWriteAccess.mockResolvedValue(undefined);
  hasActiveStakeholderForRole.mockResolvedValue(false);
  auditLogFn.mockResolvedValue(undefined);
});

const owner: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['pm'],
  status: 'active',
  user_id: 2,
  username: 'ava',
  display_name: 'Ava',
  email: 'ava@example.com',
};

const viewer: AccessActor = {
  ...owner,
  roles: ['viewer'],
};

describe('stakeholders.service', () => {
  it('listProjectStakeholders asserts access then returns history including ended rows', async () => {
    const rows = [
      { id: 2, stakeholder_role: 'sponsor', effective_to: '2026-01-01' },
      { id: 1, stakeholder_role: 'sponsor', effective_to: null },
    ];
    listStakeholdersRepo.mockResolvedValue(rows);
    await expect(listProjectStakeholders(7, owner)).resolves.toEqual(rows);
    expect(assertProjectAccess).toHaveBeenCalledWith(7, owner);
    expect(listStakeholdersRepo).toHaveBeenCalledWith(7);
  });

  it('create with in-company user_id succeeds for key_stakeholder', async () => {
    findUserById.mockResolvedValue({ id: 10, company_id: 5 });
    insertStakeholderRepo.mockResolvedValue({
      id: 1,
      project_id: 7,
      stakeholder_role: 'key_stakeholder',
      user_id: 10,
    });
    await expect(
      createProjectStakeholder(7, owner, {
        stakeholder_role: 'key_stakeholder',
        user_id: 10,
      }),
    ).resolves.toMatchObject({ id: 1, user_id: 10 });
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(insertStakeholderRepo).toHaveBeenCalled();
    expect(auditLogFn).toHaveBeenCalled();
  });

  it('create with external_name and external_email and no user_id succeeds', async () => {
    insertStakeholderRepo.mockResolvedValue({
      id: 2,
      stakeholder_role: 'key_stakeholder',
      external_name: 'Pat',
      external_email: 'pat@example.com',
    });
    await expect(
      createProjectStakeholder(7, owner, {
        stakeholder_role: 'key_stakeholder',
        external_name: 'Pat',
        external_email: 'pat@example.com',
      }),
    ).resolves.toMatchObject({ external_email: 'pat@example.com' });
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('create sponsor while another sponsor window is active throws ValidationError', async () => {
    hasActiveStakeholderForRole.mockResolvedValue(true);
    await expect(
      createProjectStakeholder(7, owner, { stakeholder_role: 'sponsor', user_id: 10 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(insertStakeholderRepo).not.toHaveBeenCalled();
  });

  it('second active psc_member does not throw', async () => {
    insertStakeholderRepo.mockResolvedValue({ id: 3, stakeholder_role: 'psc_member' });
    await expect(
      createProjectStakeholder(7, owner, {
        stakeholder_role: 'psc_member',
        external_name: 'Member B',
        external_email: 'b@example.com',
      }),
    ).resolves.toMatchObject({ stakeholder_role: 'psc_member' });
    expect(hasActiveStakeholderForRole).not.toHaveBeenCalled();
  });

  it('end sets effective_to via repo soft-end and does not delete', async () => {
    const before = {
      id: 4,
      project_id: 7,
      stakeholder_role: 'key_stakeholder',
      effective_to: null,
    };
    endStakeholderRepo.mockResolvedValue({ ...before, effective_to: '2026-08-26' });
    await expect(endProjectStakeholder(7, owner, 4)).resolves.toMatchObject({
      effective_to: '2026-08-26',
    });
    expect(endStakeholderRepo).toHaveBeenCalledWith(7, 4, undefined);
    expect(assertProjectWriteAccess).toHaveBeenCalledWith(7, owner);
    expect(auditLogFn).toHaveBeenCalled();
  });

  it('viewer-only write access failure prevents create', async () => {
    assertProjectWriteAccess.mockRejectedValue(new ForbiddenError());
    await expect(
      createProjectStakeholder(7, viewer, {
        stakeholder_role: 'key_stakeholder',
        external_name: 'X',
        external_email: 'x@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertStakeholderRepo).not.toHaveBeenCalled();
  });
});
