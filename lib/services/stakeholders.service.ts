import {
  endStakeholder as endStakeholderRepo,
  getStakeholder as getStakeholderRepo,
  hasActiveStakeholderForRole,
  insertStakeholder as insertStakeholderRepo,
  listStakeholders as listStakeholdersRepo,
  type StakeholderRole,
} from '@/lib/repositories/stakeholders.repo';
import { findUserById } from '@/lib/repositories/users.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { NotFoundError, ValidationError } from './errors';

type StakeholderRow = {
  id: number;
  project_id: number;
  stakeholder_role: StakeholderRole;
  user_id: number | null;
  external_name: string | null;
  external_email: string | null;
  effective_from: string;
  effective_to: string | null;
};

function auditSnapshot(row: StakeholderRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    stakeholder_role: row.stakeholder_role,
    user_id: row.user_id,
    external_name: row.external_name,
    external_email: row.external_email,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
  };
}

const STAKEHOLDER_ROLES: StakeholderRole[] = [
  'sponsor',
  'psc_chair',
  'psc_member',
  'project_director',
  'key_stakeholder',
];

const SINGLETON_ROLES: StakeholderRole[] = ['sponsor', 'psc_chair', 'project_director'];

function isSingletonStakeholderRole(role: StakeholderRole): boolean {
  return SINGLETON_ROLES.includes(role);
}

function parseStakeholderRole(value: unknown): StakeholderRole {
  if (typeof value !== 'string' || !STAKEHOLDER_ROLES.includes(value as StakeholderRole)) {
    throw new ValidationError('stakeholder_role is required', 'stakeholder_role');
  }
  return value as StakeholderRole;
}

export async function listProjectStakeholders(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listStakeholdersRepo(projectId);
}

export async function createProjectStakeholder(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const stakeholderRole = parseStakeholderRole(body.stakeholder_role);

  const rawUserId = body.user_id;
  const userId =
    rawUserId === undefined || rawUserId === null || rawUserId === ''
      ? null
      : Number(rawUserId);

  let externalName: string | null = null;
  let externalEmail: string | null = null;

  if (userId !== null) {
    if (!Number.isFinite(userId)) {
      throw new ValidationError('user_id must be a number', 'user_id');
    }
    const user = await findUserById(userId);
    if (!user || user.company_id !== actor.company_id) {
      throw new ValidationError('user_id must belong to your company', 'user_id');
    }
  } else {
    externalName = typeof body.external_name === 'string' ? body.external_name.trim() : '';
    externalEmail = typeof body.external_email === 'string' ? body.external_email.trim() : '';
    if (!externalName || !externalEmail) {
      throw new ValidationError(
        'external_name and external_email are required when user_id is omitted',
        'external_name',
      );
    }
  }

  if (isSingletonStakeholderRole(stakeholderRole)) {
    const active = await hasActiveStakeholderForRole(projectId, stakeholderRole);
    if (active) {
      throw new ValidationError(
        `An active ${stakeholderRole} already exists; end the previous window first`,
        'stakeholder_role',
      );
    }
  }

  const created = (await insertStakeholderRepo(projectId, {
    stakeholder_role: stakeholderRole,
    user_id: userId,
    external_name: externalName,
    external_email: externalEmail,
  })) as StakeholderRow;

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project_stakeholder',
    entity_id: String(created.id),
    action: 'create',
    before: null,
    after: auditSnapshot(created),
  });

  return created;
}

export async function endProjectStakeholder(
  projectId: number | string,
  actor: AccessActor,
  stakeholderId: number | string,
  body?: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const before = (await getStakeholderRepo(projectId, stakeholderId)) as StakeholderRow | undefined;
  if (!before || before.effective_to !== null) {
    throw new NotFoundError('Not found', 'project_stakeholder');
  }

  const effectiveTo =
    typeof body?.effective_to === 'string' && body.effective_to.trim()
      ? body.effective_to.trim()
      : undefined;

  const after = (await endStakeholderRepo(projectId, stakeholderId, effectiveTo)) as
    | StakeholderRow
    | undefined;
  if (!after) throw new NotFoundError('Not found', 'project_stakeholder');

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project_stakeholder',
    entity_id: String(stakeholderId),
    action: 'end',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });

  return after;
}
