import {
  getDependencyInFromProject,
  hasOverlappingEquivalentDependency,
  insertProjectDependency,
  listProjectDependencies as listProjectDependenciesRepo,
  softEndDependency,
  type DependencyType,
  type ProjectDependencyRow,
} from '@/lib/repositories/project-dependencies.repo';
import { parseIsoDate } from '@/lib/fiscal/iso-date';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { ConflictError, NotFoundError, ValidationError } from './errors';

const DEPENDENCY_TYPES: DependencyType[] = [
  'FINISH_TO_START',
  'START_TO_START',
  'FINISH_TO_FINISH',
  'START_TO_FINISH',
  'BLOCKS',
];

function auditSnapshot(row: ProjectDependencyRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    from_project_id: row.from_project_id,
    to_project_id: row.to_project_id,
    dependency_type: row.dependency_type,
    need_by: row.need_by,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    notes: row.notes,
  };
}

function parseDependencyType(value: unknown): DependencyType {
  if (typeof value !== 'string' || !DEPENDENCY_TYPES.includes(value as DependencyType)) {
    throw new ValidationError('dependency_type is invalid', 'dependency_type');
  }
  return value as DependencyType;
}

export async function listProjectDependenciesForProject(
  projectId: number | string,
  actor: AccessActor,
) {
  await assertProjectAccess(projectId, actor);
  const rows = await listProjectDependenciesRepo(projectId);
  return rows.map((row) => ({
    ...row,
    peer_project_id: row.direction === 'outgoing' ? row.to_project_id : row.from_project_id,
  }));
}

export async function createProjectDependency(
  fromProjectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(fromProjectId, actor);

  const toId = Number(body.to_project_id);
  if (!Number.isFinite(toId)) {
    throw new ValidationError('to_project_id is required', 'to_project_id');
  }
  if (Number(fromProjectId) === toId) {
    throw new ValidationError('to_project_id cannot equal from project', 'to_project_id');
  }

  await assertProjectAccess(toId, actor);

  const dependencyType = parseDependencyType(body.dependency_type);

  const needByRaw = body.need_by;
  if (needByRaw === undefined || needByRaw === null || needByRaw === '') {
    throw new ValidationError('need_by is required', 'need_by');
  }
  const needBy = parseIsoDate(needByRaw, 'need_by');
  const effectiveFrom = parseIsoDate(body.effective_from, 'effective_from');
  const effectiveTo =
    body.effective_to === undefined || body.effective_to === null || body.effective_to === ''
      ? null
      : parseIsoDate(body.effective_to, 'effective_to');

  if (effectiveTo !== null && effectiveTo < effectiveFrom) {
    throw new ValidationError('effective_to must be on or after effective_from', 'effective_to');
  }

  if (
    await hasOverlappingEquivalentDependency(
      Number(fromProjectId),
      toId,
      dependencyType,
      effectiveFrom,
      effectiveTo,
    )
  ) {
    throw new ConflictError('An equivalent dependency already exists for this window');
  }

  const notes = typeof body.notes === 'string' ? body.notes : null;

  const created = await insertProjectDependency({
    fromProjectId: Number(fromProjectId),
    toProjectId: toId,
    dependencyType,
    needBy,
    effectiveFrom,
    effectiveTo,
    notes,
    createdBy: actor.user_id,
  });
  if (!created) {
    throw new ValidationError('Failed to create dependency', 'dependency_type');
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project_dependency',
    entity_id: String(created.id),
    action: 'create',
    before: null,
    after: auditSnapshot(created),
  });

  return created;
}

export async function endProjectDependency(
  projectId: number | string,
  actor: AccessActor,
  dependencyId: number | string,
  body?: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);

  const before = await getDependencyInFromProject(projectId, dependencyId);
  if (!before || before.effective_to !== null) {
    throw new NotFoundError('Not found', 'project_dependency');
  }

  const effectiveTo =
    typeof body?.effective_to === 'string' && body.effective_to.trim()
      ? parseIsoDate(body.effective_to.trim(), 'effective_to')
      : undefined;

  if (effectiveTo !== undefined && effectiveTo < before.effective_from) {
    throw new ValidationError('effective_to must be on or after effective_from', 'effective_to');
  }

  const after = await softEndDependency(projectId, dependencyId, effectiveTo);
  if (!after) throw new NotFoundError('Not found', 'project_dependency');

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project_dependency',
    entity_id: String(dependencyId),
    action: 'end',
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });

  return after;
}
