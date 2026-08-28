import {
  insertDocumentCatalog,
  listDocumentCatalog as listDocumentCatalogRepo,
  getDocumentCatalog,
  updateDocumentCatalog as updateDocumentCatalogRepo,
} from '@/lib/repositories/document-catalog.repo';
import { insertChecklistRowIfMissing } from '@/lib/repositories/project-document-checklist.repo';
import { listProjects } from '@/lib/repositories/projects.repo';
import type { AccessActor } from './access';
import { assertCompanyWrite, hasRole } from './access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

const VALID_STAGES = new Set(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'ALL']);

function validateStage(stage: unknown): string {
  if (typeof stage !== 'string' || !VALID_STAGES.has(stage)) {
    throw new ValidationError('Invalid stage', 'stage');
  }
  return stage;
}

function validateName(name: unknown): string {
  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('Name is required', 'name');
  }
  return name.trim();
}

export async function applyCatalogToInFlightProjects(
  companyId: number,
  catalogId: number,
  catalogStage: string,
): Promise<void> {
  const projects = await listProjects(companyId);
  for (const project of projects as Array<{ id: number; status: string; stage?: string | null }>) {
    if (String(project.status).toLowerCase() !== 'active') continue;
    const projectStage = project.stage ?? null;
    const stageMatch =
      catalogStage === 'ALL' ||
      (projectStage !== null && catalogStage === projectStage);
    if (!stageMatch) continue;
    await insertChecklistRowIfMissing(project.id, catalogId);
  }
}

export async function createDocumentCatalogItem(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const name = validateName(body.name);
  const stage = validateStage(body.stage);
  const purpose = typeof body.purpose === 'string' ? body.purpose : '';
  const mandatory = body.mandatory === true;
  const active = body.active !== false;
  const applyToInFlight = body.apply_to_in_flight === true;

  const row = await insertDocumentCatalog({
    company_id: actor.company_id!,
    name,
    purpose,
    stage,
    mandatory,
    active,
  });

  if (applyToInFlight) {
    await applyCatalogToInFlightProjects(actor.company_id!, row.id, stage);
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'document_catalog',
    entity_id: String(row.id),
    action: 'create',
    before: null,
    after: row,
  });

  return row;
}

export async function updateDocumentCatalogItem(
  actor: AccessActor,
  catalogId: number | string,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const existing = await getDocumentCatalog(catalogId);
  if (!existing) throw new NotFoundError('Not found', 'document_catalog');
  if (existing.company_id !== actor.company_id) throw new ForbiddenError();

  const name = body.name !== undefined ? validateName(body.name) : existing.name;
  const stage = body.stage !== undefined ? validateStage(body.stage) : existing.stage;
  const purpose = typeof body.purpose === 'string' ? body.purpose : existing.purpose;
  const mandatory = body.mandatory !== undefined ? body.mandatory === true : existing.mandatory;
  const active = body.active !== undefined ? body.active !== false : existing.active;
  const applyToInFlight = body.apply_to_in_flight === true;

  const row = await updateDocumentCatalogRepo(catalogId, {
    name,
    purpose,
    stage,
    mandatory,
    active,
  });

  if (applyToInFlight) {
    await applyCatalogToInFlightProjects(actor.company_id!, row.id, stage);
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'document_catalog',
    entity_id: String(row.id),
    action: 'update',
    before: existing,
    after: row,
  });

  return row;
}

export async function listDocumentCatalog(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  if (hasRole(actor, 'viewer') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'pm')) {
    throw new ForbiddenError();
  }
  return listDocumentCatalogRepo(actor.company_id);
}

export async function getDocumentCatalogItem(actor: AccessActor, catalogId: number | string) {
  const row = await getDocumentCatalog(catalogId);
  if (!row) throw new NotFoundError('Not found', 'document_catalog');
  if (actor.company_id === null || row.company_id !== actor.company_id) {
    throw new ForbiddenError();
  }
  if (hasRole(actor, 'viewer') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'pm')) {
    throw new ForbiddenError();
  }
  return row;
}
