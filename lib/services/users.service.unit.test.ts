import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listUsersRepo,
  findUserById,
  findUserByUsername,
  findUserByEmailLower,
  insertUser,
  updateUserRow,
  replaceUserRoles,
  lockUserRow,
  unlockUserRow,
  deactivateUserRow,
  deleteSessionsForUser,
} = vi.hoisted(() => ({
  listUsersRepo: vi.fn(),
  findUserById: vi.fn(),
  findUserByUsername: vi.fn(),
  findUserByEmailLower: vi.fn(),
  insertUser: vi.fn(),
  updateUserRow: vi.fn(),
  replaceUserRoles: vi.fn(),
  lockUserRow: vi.fn(),
  unlockUserRow: vi.fn(),
  deactivateUserRow: vi.fn(),
  deleteSessionsForUser: vi.fn(),
}));

const { auditLogFn } = vi.hoisted(() => ({
  auditLogFn: vi.fn(),
}));

vi.mock('@/lib/repositories/users.repo', () => ({
  listUsers: listUsersRepo,
  findUserById,
  findUserByUsername,
  findUserByEmailLower,
  insertUser,
  updateUserRow,
  replaceUserRoles,
  lockUserRow,
  unlockUserRow,
  deactivateUserRow,
  deleteSessionsForUser,
}));
vi.mock('@/lib/services/audit.service', () => ({ auditLog: auditLogFn }));
vi.mock('@/lib/auth', () => ({ hashPassword: vi.fn((p: string) => `hashed:${p}`) }));

import { createUser, listUsers, updateUser, lockUser, unlockUser, deactivateUser } from './users.service';
import { ConflictError, ForbiddenError, ValidationError } from './errors';
import type { AccessActor } from './access';

const cpmoActor: AccessActor = {
  company_id: 5,
  is_admin: 0,
  roles: ['cpmo'],
  status: 'active',
  user_id: 1,
  username: 'cpmo',
  display_name: 'CPMO',
  email: 'cpmo@example.com',
};

const pmActor: AccessActor = {
  ...cpmoActor,
  roles: ['pm'],
  user_id: 2,
  username: 'pm',
};

beforeEach(() => {
  vi.clearAllMocks();
  listUsersRepo.mockResolvedValue([]);
  findUserByUsername.mockResolvedValue(undefined);
  findUserByEmailLower.mockResolvedValue(undefined);
  insertUser.mockResolvedValue({ id: 10, username: 'new', company_id: 5 });
  findUserById.mockResolvedValue({
    id: 10,
    username: 'new',
    company_id: 5,
    status: 'active',
    email: 'new@example.com',
    display_name: 'New',
    roles: ['pm'],
  });
});

describe('users.service listUsers', () => {
  it('scopes list to the actor company (D-21, USER-01)', async () => {
    listUsersRepo.mockResolvedValue([{ id: 1, company_id: 5 }]);
    await listUsers(cpmoActor, {});
    expect(listUsersRepo).toHaveBeenCalledWith(5, {});
  });

  it('throws ForbiddenError for non-cpmo actors (D-21)', async () => {
    await expect(listUsers(pmActor, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(listUsersRepo).not.toHaveBeenCalled();
  });

  it('passes status, role, and q filters (USER-01, D-20)', async () => {
    await listUsers(cpmoActor, { q: 'ava', status: 'active', role: 'pm' });
    expect(listUsersRepo).toHaveBeenCalledWith(5, { q: 'ava', status: 'active', role: 'pm' });
  });
});

describe('users.service createUser', () => {
  const input = {
    username: 'newuser',
    password: 'password1',
    display_name: 'New User',
    email: 'new@example.com',
    roles: ['pm'] as const,
    status: 'active' as const,
  };

  it('throws ForbiddenError for non-cpmo (D-21)', async () => {
    await expect(createUser(pmActor, input)).rejects.toBeInstanceOf(ForbiddenError);
    expect(insertUser).not.toHaveBeenCalled();
  });

  it('throws ValidationError when roles are empty (D-04, USER-03)', async () => {
    await expect(createUser(cpmoActor, { ...input, roles: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(insertUser).not.toHaveBeenCalled();
  });

  it('throws ConflictError on duplicate username (D-12, USER-02)', async () => {
    findUserByUsername.mockResolvedValue({ id: 99, username: 'newuser' });
    await expect(createUser(cpmoActor, input)).rejects.toBeInstanceOf(ConflictError);
    expect(insertUser).not.toHaveBeenCalled();
  });

  it('throws ConflictError on duplicate lower(email) (D-12, USER-02)', async () => {
    findUserByEmailLower.mockResolvedValue({ id: 99, email: 'new@example.com' });
    await expect(createUser(cpmoActor, input)).rejects.toBeInstanceOf(ConflictError);
    expect(insertUser).not.toHaveBeenCalled();
  });

  it('stamps company_id from actor, not body (D-21)', async () => {
    findUserById.mockResolvedValue({
      id: 10,
      username: 'newuser',
      company_id: 5,
      status: 'active',
      email: 'new@example.com',
      display_name: 'New User',
      roles: ['pm'],
    });
    await createUser(cpmoActor, input);
    expect(insertUser).toHaveBeenCalledWith(
      expect.objectContaining({ company_id: 5, username: 'newuser', password_hash: 'hashed:password1' }),
    );
    expect(replaceUserRoles).toHaveBeenCalledWith(10, 5, ['pm']);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entity_type: 'user', actor_id: 1, company_id: 5 }),
    );
  });
});

describe('users.service updateUser audit', () => {
  it('calls auditLog with before/after on update (D-08)', async () => {
    findUserById
      .mockResolvedValueOnce({
        id: 10,
        username: 'new',
        company_id: 5,
        status: 'active',
        email: 'new@example.com',
        display_name: 'New',
        roles: ['pm'],
      })
      .mockResolvedValueOnce({
        id: 10,
        username: 'new',
        company_id: 5,
        status: 'active',
        email: 'new@example.com',
        display_name: 'Updated',
        roles: ['pm'],
      });
    await updateUser(cpmoActor, 10, { display_name: 'Updated' });
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entity_type: 'user',
        before: expect.objectContaining({ display_name: 'New' }),
        after: expect.objectContaining({ display_name: 'Updated' }),
      }),
    );
  });
});

describe('users.service lock/unlock/deactivate', () => {
  const target = {
    id: 10,
    username: 'locked-user',
    company_id: 5,
    status: 'active' as const,
    email: 'locked@example.com',
    display_name: 'Locked',
    roles: ['pm'] as const,
  };

  beforeEach(() => {
    findUserById.mockResolvedValue(target);
  });

  it('lockUser sets locked state, clears sessions, and audits (D-05, D-08, D-10)', async () => {
    await lockUser(cpmoActor, 10);
    expect(lockUserRow).toHaveBeenCalledWith(10, cpmoActor.user_id);
    expect(deleteSessionsForUser).toHaveBeenCalledWith(10);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'lock', entity_type: 'user' }),
    );
  });

  it('unlockUser clears lock and audits (USER-05)', async () => {
    await unlockUser(cpmoActor, 10);
    expect(unlockUserRow).toHaveBeenCalledWith(10);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unlock', entity_type: 'user' }),
    );
  });

  it('deactivateUser soft-deletes without physical DELETE (D-07, USER-06)', async () => {
    await deactivateUser(cpmoActor, 10);
    expect(deactivateUserRow).toHaveBeenCalledWith(10);
    expect(auditLogFn).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'deactivate', entity_type: 'user' }),
    );
  });

  it('deactivateUser rejects self-deactivate', async () => {
    await expect(deactivateUser({ ...cpmoActor, user_id: 10 }, 10)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(deactivateUserRow).not.toHaveBeenCalled();
  });

  it('createUser rejects locked user username reuse (D-06, USER-02)', async () => {
    findUserByUsername.mockResolvedValue({ id: 99, username: 'locked-user' });
    await expect(
      createUser(cpmoActor, {
        username: 'locked-user',
        password: 'password1',
        email: 'other@example.com',
        roles: ['pm'],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('createUser rejects locked user email reuse (D-06, USER-02)', async () => {
    findUserByEmailLower.mockResolvedValue({ id: 99, email: 'locked@example.com' });
    await expect(
      createUser(cpmoActor, {
        username: 'other-user',
        password: 'password1',
        email: 'locked@example.com',
        roles: ['pm'],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
