import { getDocumentCatalog } from '@/modules/documents/backend/repositories/document-catalog.repo';
import {
  getDocumentTemplate,
  getMaxVersion,
  insertDocumentTemplate,
  listEffectiveTemplates as listEffectiveTemplatesRepo,
  retireCurrentTemplate,
  retireTemplateById,
} from '@/modules/documents/backend/repositories/document-templates.repo';
import { parseHttpsUrl } from '@/lib/documents/https-url';
import { parseIsoDate } from '@/lib/fiscal/iso-date';
import type { AccessActor } from '@/lib/services/access';
import { assertCompanyWrite, hasRole } from '@/lib/services/access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/services/errors';

function assertTemplateRead(actor: AccessActor): void {
  if (actor.company_id === null) throw new ForbiddenError();
  if (hasRole(actor, 'viewer') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'pm')) {
    throw new ForbiddenError();
  }
}

export async function createTemplateVersion(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const catalogId = body.catalog_id;
  if (typeof catalogId !== 'number' || !Number.isInteger(catalogId)) {
    throw new ValidationError('catalog_id is required', 'catalog_id');
  }

  const catalog = await getDocumentCatalog(catalogId);
  if (!catalog || catalog.company_id !== actor.company_id) {
    throw new NotFoundError('Not found', 'document_catalog');
  }

  const templateUrl = parseHttpsUrl(body.template_url, 'template_url');
  if (!templateUrl) throw new ValidationError('template_url is required', 'template_url');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new ValidationError('name is required', 'name');

  const documentType = typeof body.document_type === 'string' ? body.document_type.trim() : '';
  if (!documentType) throw new ValidationError('document_type is required', 'document_type');

  const effectiveDate = parseIsoDate(body.effective_date, 'effective_date');
  const guidance = typeof body.guidance === 'string' ? body.guidance : '';

  await retireCurrentTemplate(catalogId, actor.company_id!);
  const nextVersion = (await getMaxVersion(catalogId)) + 1;

  const row = await insertDocumentTemplate({
    catalog_id: catalogId,
    company_id: actor.company_id!,
    name,
    document_type: documentType,
    version: nextVersion,
    effective_date: effectiveDate,
    guidance,
    template_url: templateUrl,
  });

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'document_template',
    entity_id: String(row.id),
    action: 'version_insert',
    before: null,
    after: row,
  });

  return row;
}

export async function listEffectiveTemplates(actor: AccessActor, catalogId?: number) {
  assertTemplateRead(actor);
  return listEffectiveTemplatesRepo(actor.company_id!, catalogId);
}

export async function getTemplate(actor: AccessActor, templateId: number | string) {
  assertTemplateRead(actor);
  const row = await getDocumentTemplate(templateId);
  if (!row) throw new NotFoundError('Not found', 'document_template');
  if (row.company_id !== actor.company_id) throw new ForbiddenError();
  return row;
}

export async function retireTemplate(actor: AccessActor, templateId: number | string) {
  assertCompanyWrite(actor);
  const existing = await getDocumentTemplate(templateId);
  if (!existing) throw new NotFoundError('Not found', 'document_template');
  if (existing.company_id !== actor.company_id) throw new ForbiddenError();

  const row = await retireTemplateById(templateId);

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'document_template',
    entity_id: String(row.id),
    action: 'retire',
    before: existing,
    after: row,
  });

  return row;
}
