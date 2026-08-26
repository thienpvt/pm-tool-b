import {
  assertChecklistPatchRules,
  rejectBinaryFields,
} from '@/lib/documents/checklist-status';
import { parseHttpsUrl } from '@/lib/documents/https-url';
import { parseIsoDate } from '@/lib/fiscal/iso-date';
import {
  getChecklistItem as getChecklistItemRepo,
  listChecklistByProject,
  updateChecklistItem as updateChecklistItemRepo,
} from '@/lib/repositories/project-document-checklist.repo';
import type { AccessActor } from './access';
import { assertProjectAccess, assertProjectWriteAccess } from './access';
import { auditLog } from './audit.service';
import { NotFoundError } from './errors';

function buildUpdateFields(
  body: Record<string, unknown>,
  status: string,
  existing: {
    status: string;
    confluence_url: string | null;
    approved_at: string | null;
    approved_by: string | null;
    na_reason: string | null;
  },
): {
  status: string;
  confluence_url?: string | null;
  approved_at?: string | null;
  approved_by?: string | number | null;
  na_reason?: string | null;
  notes?: string | null;
} {
  const fields: {
    status: string;
    confluence_url?: string | null;
    approved_at?: string | null;
    approved_by?: string | number | null;
    na_reason?: string | null;
    notes?: string | null;
  } = { status };

  if (Object.prototype.hasOwnProperty.call(body, 'confluence_url')) {
    fields.confluence_url = parseHttpsUrl(body.confluence_url, 'confluence_url', {
      allowEmpty: status === 'none' || status === 'drafting',
    });
  }

  if (status === 'approved') {
    const approvedAt = Object.prototype.hasOwnProperty.call(body, 'approved_at')
      ? body.approved_at
      : existing.approved_at;
    fields.approved_at = parseIsoDate(approvedAt, 'approved_at');
    const by = Object.prototype.hasOwnProperty.call(body, 'approved_by')
      ? body.approved_by
      : existing.approved_by;
    if (typeof by === 'number' && Number.isFinite(by)) {
      fields.approved_by = by;
    } else if (typeof by === 'string' && by.trim()) {
      fields.approved_by = by.trim();
    }
  }

  if (status === 'not_applicable' && typeof body.na_reason === 'string') {
    fields.na_reason = body.na_reason.trim();
  }

  if (status !== existing.status) {
    if (existing.status === 'approved' && status !== 'approved') {
      fields.approved_at = null;
      fields.approved_by = null;
    }
    if (existing.status === 'not_applicable' && status !== 'not_applicable') {
      fields.na_reason = null;
    }
  }

  if (typeof body.notes === 'string') {
    fields.notes = body.notes;
  } else if (body.notes === null) {
    fields.notes = null;
  }

  return fields;
}

export async function listProjectDocumentChecklist(
  projectId: number | string,
  actor: AccessActor,
) {
  await assertProjectAccess(projectId, actor);
  return listChecklistByProject(Number(projectId));
}

export async function getChecklistItem(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
) {
  await assertProjectAccess(projectId, actor);
  const row = await getChecklistItemRepo(Number(projectId), Number(itemId));
  if (!row) throw new NotFoundError('Not found', 'document_checklist');
  return row;
}

export async function patchChecklistItem(
  projectId: number | string,
  itemId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  rejectBinaryFields(body);

  const existing = await getChecklistItemRepo(Number(projectId), Number(itemId));
  if (!existing) throw new NotFoundError('Not found', 'document_checklist');

  const status =
    typeof body.status === 'string' && body.status ? body.status : existing.status;

  const mergedForValidation = {
    status,
    confluence_url: existing.confluence_url,
    approved_at: existing.approved_at,
    approved_by: existing.approved_by,
    na_reason: existing.na_reason,
    notes: existing.notes,
    ...body,
  };
  assertChecklistPatchRules(mergedForValidation, status);

  const fields = buildUpdateFields(body, status, existing);
  const updated = await updateChecklistItemRepo(Number(projectId), Number(itemId), fields);
  if (!updated) throw new NotFoundError('Not found', 'document_checklist');

  if (updated.status !== existing.status || updated.confluence_url !== existing.confluence_url) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'document_checklist',
      entity_id: String(updated.id),
      action: 'status_change',
      before: { status: existing.status, confluence_url: existing.confluence_url },
      after: { status: updated.status, confluence_url: updated.confluence_url },
    });
  }

  return updated;
}
