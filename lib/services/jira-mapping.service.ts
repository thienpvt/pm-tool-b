import {
  createJqlPreset as createJqlPresetRepo,
  deleteJqlPreset as deleteJqlPresetRepo,
  findJqlPresetByName,
  getJqlPresetById,
  listJqlPresets as listJqlPresetsRepo,
  listRecentJiraSyncMappings as listRecentJiraSyncMappingsRepo,
  saveJiraSyncMapping as saveJiraSyncMappingRepo,
} from '@/lib/repositories/jira-config.repo';
import type { AccessActor } from './access';
import { ConflictError, ForbiddenError, NotFoundError } from './errors';

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

export async function listJqlPresets(actor: AccessActor, context: string) {
  const companyId = requireCompanyId(actor);
  return listJqlPresetsRepo(companyId, context);
}

export async function createJqlPreset(
  actor: AccessActor,
  name: string,
  jql: string,
  context: string,
  maxPresets = 10,
) {
  const companyId = requireCompanyId(actor);
  if (await findJqlPresetByName(companyId, name, context)) {
    throw new ConflictError('Preset name already exists');
  }
  return createJqlPresetRepo(companyId, name, jql, context, maxPresets);
}

export async function deleteJqlPreset(id: number | string, actor: AccessActor) {
  const row = await getJqlPresetById(id);
  assertCompanyRow(actor, row);
  return deleteJqlPresetRepo(actor.company_id!, id);
}

export async function listRecentJiraSyncMappings(actor: AccessActor) {
  const companyId = requireCompanyId(actor);
  return listRecentJiraSyncMappingsRepo(companyId);
}

export async function saveJiraSyncMapping(actor: AccessActor, mappingsJson: string) {
  const companyId = requireCompanyId(actor);
  return saveJiraSyncMappingRepo(companyId, mappingsJson);
}
