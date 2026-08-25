import {
  createRisk as createRiskRepo,
  deleteRisk as deleteRiskRepo,
  listRisks as listRisksRepo,
  updateRisk as updateRiskRepo,
} from '@/lib/repositories/risks.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listRisks(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listRisksRepo(projectId);
}

export async function createRisk(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return createRiskRepo(projectId, body);
}

export async function updateRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  const updated = await updateRiskRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'risk');
  return updated;
}

export async function deleteRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  const result = await deleteRiskRepo(projectId, rowId);
  // Phase 2 scoped-delete: zero-row match → NotFound rather than 200-with-undefined.
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'risk');
  }
  return result;
}
