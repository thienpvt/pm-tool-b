import {
  listEscalations as listEscalationsRepo,
  updateEscalation as updateEscalationRepo,
} from '@/modules/projects/backend/repositories/escalations.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from '@/lib/services/access';
import { NotFoundError } from '@/lib/services/errors';

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
  await assertProjectWriteAccess(projectId, actor);
  const updated = await updateEscalationRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'escalation');
  return updated;
}
