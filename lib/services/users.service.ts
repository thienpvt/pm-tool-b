import { hashPassword } from '@/lib/auth';
import {
  deactivateUserRow,
  deleteSessionsForUser,
  findUserByEmailLower,
  findUserById,
  findUserByUsername,
  insertUser,
  listUsers as listUsersRepo,
  lockUserRow,
  replaceUserRoles,
  unlockUserRow,
  updateUserRow,
  type UserListFilters,
  type UserRow,
} from '@/lib/repositories/users.repo';
import { hasRole, isCpmo, type AccessActor, type AppRole, type UserStatus } from './access';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';

export type { UserListFilters, UserRow };

export type CreateUserInput = {
  username: string;
  password: string;
  display_name?: string;
  email: string;
  roles: AppRole[];
  status?: UserStatus;
};

export type UpdateUserInput = {
  display_name?: string;
  email?: string;
  roles?: AppRole[];
  status?: UserStatus;
  password?: string;
};

function assertCpmoCompany(actor: AccessActor): void {
  if (!isCpmo(actor) || actor.company_id === null) {
    throw new ForbiddenError();
  }
}

async function assertUniqueCredentials(
  username: string,
  email: string,
  excludeUserId?: number,
): Promise<void> {
  const byUsername = await findUserByUsername(username);
  if (byUsername && byUsername.id !== excludeUserId) {
    throw new ConflictError('Username already exists');
  }
  const byEmail = await findUserByEmailLower(email);
  if (byEmail && byEmail.id !== excludeUserId) {
    throw new ConflictError('Email already exists');
  }
}

function assertRoles(roles: AppRole[] | undefined): AppRole[] {
  if (!roles?.length) throw new ValidationError('At least one role required', 'roles');
  return roles;
}

async function loadUserInCompany(
  actor: AccessActor,
  userId: number | string,
): Promise<UserRow> {
  const row = await findUserById(userId);
  if (!row) throw new NotFoundError('Not found', 'user');
  if (row.company_id !== actor.company_id) throw new ForbiddenError();
  return row;
}

export async function listUsers(actor: AccessActor, filters: UserListFilters = {}) {
  assertCpmoCompany(actor);
  return listUsersRepo(actor.company_id!, filters);
}

export async function createUser(actor: AccessActor, input: CreateUserInput) {
  assertCpmoCompany(actor);
  const roles = assertRoles(input.roles);
  const username = input.username.trim();
  const email = input.email.trim();
  await assertUniqueCredentials(username, email);

  const created = await insertUser({
    username,
    password_hash: hashPassword(input.password),
    display_name: input.display_name?.trim() ?? '',
    email,
    company_id: actor.company_id!,
    status: input.status ?? 'active',
  });
  await replaceUserRoles(created.id, actor.company_id!, roles);
  return findUserById(created.id);
}

export async function updateUser(
  actor: AccessActor,
  userId: number | string,
  input: UpdateUserInput,
) {
  assertCpmoCompany(actor);
  const existing = await loadUserInCompany(actor, userId);

  const username = existing.username;
  const email = input.email?.trim() ?? existing.email;
  if (input.email !== undefined) {
    await assertUniqueCredentials(username, email, existing.id);
  }

  const patch: Parameters<typeof updateUserRow>[1] = {};
  if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
  if (input.email !== undefined) patch.email = email;
  if (input.status !== undefined) patch.status = input.status;
  if (input.password) patch.password_hash = hashPassword(input.password);

  if (Object.keys(patch).length) {
    await updateUserRow(userId, patch);
  }

  if (input.roles !== undefined) {
    const roles = assertRoles(input.roles);
    await replaceUserRoles(userId, actor.company_id!, roles);
  }

  return findUserById(userId);
}

export async function lockUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  const existing = await loadUserInCompany(actor, userId);
  await lockUserRow(userId, actor.user_id);
  await deleteSessionsForUser(userId);
  return findUserById(existing.id);
}

export async function unlockUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  const existing = await loadUserInCompany(actor, userId);
  await unlockUserRow(userId);
  return findUserById(existing.id);
}

export async function deactivateUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  if (Number(userId) === actor.user_id) {
    throw new ValidationError('Cannot deactivate yourself');
  }
  await loadUserInCompany(actor, userId);
  await deactivateUserRow(userId);
  return findUserById(userId);
}
