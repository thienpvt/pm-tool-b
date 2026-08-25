import {
  endPrimaryWithCollaboratorCascade,
  getActivePrimaryAssignment,
  getPmAssignmentById,
  hasOverlappingPmAssignment,
  insertPmAssignment,
  listPmAssignments as listPmAssignmentsRepo,
  softEndActivePrimary,
  softEndPmAssignment,
  syncProjectPmDisplay,
  type PmAssignmentRole,
  type PmAssignmentRow,
} from '@/lib/repositories/pm-assignments.repo';
import { findUserById } from '@/lib/repositories/users.repo';
import {
  assertCompanyWrite,
  assertProjectAccess,
  type AccessActor,
} from './access';
import { auditLog } from './audit.service';
import { NotFoundError, ValidationError } from './errors';

function auditSnapshot(row: PmAssignmentRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    user_id: row.user_id,
    role: row.role,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
  };
}

function parseRole(value: unknown): PmAssignmentRole {
  if (value !== 'primary' && value !== 'collaborator') {
    throw new ValidationError('role must be primary or collaborator', 'role');
  }
  return value;
}

export async function listPmAssignments(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listPmAssignmentsRepo(projectId);
}

export async function createPmAssignment(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  assertCompanyWrite(actor);

  const userId = Number(body.user_id);
  if (!Number.isFinite(userId)) {
    throw new ValidationError('user_id is required', 'user_id');
  }
  const role = parseRole(body.role);

  const user = await findUserById(userId);
  if (!user || user.company_id !== actor.company_id) {
    throw new ValidationError('user_id must belong to your company', 'user_id');
  }

  if (role === 'collaborator') {
    const activePrimary = await getActivePrimaryAssignment(projectId);
    if (!activePrimary) {
      throw new ValidationError(
        'A collaborator requires an active primary PM',
        'role',
      );
    }
    if (await hasOverlappingPmAssignment(projectId, userId, role)) {
      throw new ValidationError(
        'User already holds the other PM role on this project',
        'user_id',
      );
    }
  } else {
    const activePrimary = await getActivePrimaryAssignment(projectId);
    if (activePrimary) {
      await softEndActivePrimary(projectId);
    }
  }

  const created = (await insertPmAssignment(projectId, userId, role)) as PmAssignmentRow;
  if (role === 'primary') {
    await syncProjectPmDisplay(projectId);
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'pm_assignment',
    entity_id: String(created.id),
    action: 'create',
    before: null,
    after: auditSnapshot(created),
  });

  return created;
}

export async function endPmAssignment(
  projectId: number | string,
  actor: AccessActor,
  assignmentId: number | string,
  body?: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  assertCompanyWrite(actor);

  const before = await getPmAssignmentById(projectId, assignmentId);
  if (!before || before.effective_to !== null) {
    throw new NotFoundError('Not found', 'pm_assignment');
  }

  const effectiveTo =
    typeof body?.effective_to === 'string' && body.effective_to.trim()
      ? body.effective_to.trim()
      : undefined;

  const activePrimary = await getActivePrimaryAssignment(projectId);
  const isLastPrimary =
    before.role === 'primary' &&
    activePrimary?.id === before.id;

  let after: PmAssignmentRow | undefined;
  if (isLastPrimary) {
    after = await endPrimaryWithCollaboratorCascade(projectId, assignmentId, effectiveTo);
  } else {
    after = await softEndPmAssignment(projectId, assignmentId, effectiveTo);
  }

  if (!after) throw new NotFoundError('Not found', 'pm_assignment');

  if (before.role === 'primary') {
    await syncProjectPmDisplay(projectId);
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'pm_assignment',
    entity_id: String(assignmentId),
    action: 'end',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });

  return after;
}
