import {
  bugMappingIds as bugMappingIdsRepo,
  createBugMapping as createBugMappingRepo,
  createTimelineMapping as createTimelineMappingRepo,
  deleteBugMapping as deleteBugMappingRepo,
  deleteTimelineMapping as deleteTimelineMappingRepo,
  findBugMappingByName,
  findTimelineMappingByName,
  getBugMappingById,
  getTimelineMappingById,
  listBugMappings as listBugMappingsRepo,
  listTimelineMappings as listTimelineMappingsRepo,
  updateTimelineMapping as updateTimelineMappingRepo,
} from '@/modules/jira/backend/repositories/import-mapping.repo';
import type { AccessActor } from '@/lib/services/access';
import { assertCompanyWrite } from '@/lib/services/access';
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/services/errors';

const MAX_BUG_TEMPLATES = 5;

type CompanyRow = { company_id: number };

function requireCompanyId(actor: AccessActor): number {
  if (actor.company_id === null) throw new ForbiddenError();
  return actor.company_id;
}

function assertCompanyRow(actor: AccessActor, row: CompanyRow | undefined) {
  if (!row) throw new NotFoundError('Not found');
  if (actor.company_id === null || row.company_id !== actor.company_id) {
    throw new ForbiddenError();
  }
}

export async function listTimelineMappings(actor: AccessActor) {
  const companyId = requireCompanyId(actor);
  return listTimelineMappingsRepo(companyId);
}

export async function createTimelineMapping(
  actor: AccessActor,
  name: string,
  mappingsJson: string,
) {
  const companyId = requireCompanyId(actor);
  assertCompanyWrite(actor);
  if (await findTimelineMappingByName(companyId, name)) {
    throw new ConflictError('Template name already exists');
  }
  return createTimelineMappingRepo(companyId, name, mappingsJson);
}

export async function updateTimelineMapping(
  id: number | string,
  actor: AccessActor,
  name: string,
  mappingsJson: string,
) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  assertCompanyWrite(actor);
  const companyId = requireCompanyId(actor);
  const existing = await findTimelineMappingByName(companyId, name);
  if (existing && existing.id !== Number(id)) {
    throw new ConflictError('Template name already exists');
  }
  return updateTimelineMappingRepo(companyId, id, name, mappingsJson);
}

export async function deleteTimelineMapping(id: number | string, actor: AccessActor) {
  const row = await getTimelineMappingById(id);
  assertCompanyRow(actor, row);
  assertCompanyWrite(actor);
  return deleteTimelineMappingRepo(actor.company_id!, id);
}

export async function listBugMappings(actor: AccessActor) {
  const companyId = requireCompanyId(actor);
  return listBugMappingsRepo(companyId);
}

export async function createBugMapping(
  actor: AccessActor,
  name: string,
  mappingsJson: string,
) {
  const companyId = requireCompanyId(actor);
  assertCompanyWrite(actor);
  if (await findBugMappingByName(companyId, name)) {
    throw new ConflictError('Template name already exists');
  }
  const existing = await bugMappingIdsRepo(companyId);
  if (existing.length >= MAX_BUG_TEMPLATES) {
    const oldest = existing[existing.length - 1];
    await deleteBugMappingRepo(companyId, oldest.id);
  }
  return createBugMappingRepo(companyId, name, mappingsJson);
}

export async function deleteBugMapping(id: number | string, actor: AccessActor) {
  const row = await getBugMappingById(id);
  assertCompanyRow(actor, row);
  assertCompanyWrite(actor);
  return deleteBugMappingRepo(actor.company_id!, id);
}
