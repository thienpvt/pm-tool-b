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
import { auditLog } from '@/lib/services/audit.service';
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

function auditSnapshot(row: UserRow | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    status: row.status,
    roles: row.roles,
    company_id: row.company_id,
  };
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
  const after = await findUserById(created.id);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'user',
    entity_id: String(created.id),
    action: 'create',
    before: null,
    after: auditSnapshot(after),
  });
  return after;
}

export async function updateUser(
  actor: AccessActor,
  userId: number | string,
  input: UpdateUserInput,
) {
  assertCpmoCompany(actor);
  const before = await loadUserInCompany(actor, userId);

  const username = before.username;
  const email = input.email?.trim() ?? before.email;
  if (input.email !== undefined) {
    await assertUniqueCredentials(username, email, before.id);
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

  const after = await findUserById(userId);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'user',
    entity_id: String(userId),
    action: 'update',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });
  return after;
}

export async function lockUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  const before = await loadUserInCompany(actor, userId);
  await lockUserRow(userId, actor.user_id);
  await deleteSessionsForUser(userId);
  const after = await findUserById(userId);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'user',
    entity_id: String(userId),
    action: 'lock',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });
  return after;
}

export async function unlockUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  const before = await loadUserInCompany(actor, userId);
  await unlockUserRow(userId);
  const after = await findUserById(userId);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'user',
    entity_id: String(userId),
    action: 'unlock',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });
  return after;
}

export async function deactivateUser(actor: AccessActor, userId: number | string) {
  assertCpmoCompany(actor);
  if (Number(userId) === actor.user_id) {
    throw new ValidationError('Cannot deactivate yourself');
  }
  const before = await loadUserInCompany(actor, userId);
  await deactivateUserRow(userId);
  const after = await findUserById(userId);
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'user',
    entity_id: String(userId),
    action: 'deactivate',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });
  return after;
}
