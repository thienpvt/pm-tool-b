import {
  deleteTimelineMapping as deleteTimelineMappingRepo,
  getTimelineMappingById,
  updateTimelineMapping as updateTimelineMappingRepo,
} from '@/lib/repositories/import-mapping.repo';
import type { AccessActor } from './access';
import { ForbiddenError, NotFoundError } from './errors';

type CompanyRow = { company_id: number };

function assertCompanyRow(actor: AccessActor, row: CompanyRow | undefined) {
  if (!row) throw new NotFoundError('Not found');
  if (actor.company_id === null || row.company_id !== actor.company_id) {
    throw new ForbiddenError();
  }
}

export async function updateTimelineMapping(
  id: number | string,
  actor: AccessActor,
  name: string,
  mappingsJson: string,
) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  return updateTimelineMappingRepo(actor.company_id!, id, name, mappingsJson);
}

export async function deleteTimelineMapping(id: number | string, actor: AccessActor) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  return deleteTimelineMappingRepo(actor.company_id!, id);
}
