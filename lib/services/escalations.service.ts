import {
  listEscalations as listEscalationsRepo,
  updateEscalation as updateEscalationRepo,
} from '@/lib/repositories/escalations.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listEscalations(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listEscalationsRepo(projectId);
}

export async function updateEscalation(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  const updated = await updateEscalationRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'escalation');
  return updated;
}
