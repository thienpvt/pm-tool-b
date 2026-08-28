import {
  createRisk as createRiskRepo,
  deactivateRisk as deactivateRiskRepo,
  findRiskByCode,
  getRisk as getRiskRepo,
  listRisks as listRisksRepo,
  updateRisk as updateRiskRepo,
} from '@/modules/projects/backend/repositories/risks.repo';
import { appendDueDateHistory } from '@/modules/projects/backend/repositories/raid-due-date-history.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from '@/lib/services/access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { ConflictError, NotFoundError } from '@/lib/services/errors';

type RiskRow = {
  id: number;
  code: string;
  description: string;
  status: string;
  priority: string;
  due_date?: string | null;
  owner: string;
};

function auditSnapshot(row: RiskRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date ?? null,
    owner: row.owner,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: string }).code === '23505'
  );
}

function assertUniqueCode(
  hit: { id: number } | undefined,
  message: string,
): void {
  if (hit) throw new ConflictError(message);
}

export async function listRisks(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listRisksRepo(projectId);
}

export async function createRisk(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code) {
    assertUniqueCode(await findRiskByCode(projectId, code), 'Risk code already exists');
  }
  try {
    const created = await createRiskRepo(projectId, body);
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'risk',
      entity_id: String(created.id),
      action: 'create',
      before: null,
      after: auditSnapshot(created as RiskRow),
    });
    return created;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Risk code already exists');
    throw err;
  }
}

export async function updateRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const code = typeof fields.code === 'string' ? fields.code.trim() : '';
  if (code) {
    assertUniqueCode(
      await findRiskByCode(projectId, code, rowId),
      'Risk code already exists',
    );
  }
  const prior = await getRiskRepo(projectId, rowId);
  const updated = await updateRiskRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'risk');
  const hasNonDueDateFields = Object.keys(fields).some((k) => k !== 'due_date');
  if (
    fields.due_date !== undefined
    && prior
    && String(fields.due_date) !== String(prior.due_date ?? '')
  ) {
    await appendDueDateHistory({
      entity_type: 'risk',
      entity_id: String(rowId),
      old_due: prior.due_date != null ? String(prior.due_date) : null,
      new_due: fields.due_date != null ? String(fields.due_date) : null,
      changed_by: actor.user_id,
    });
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'risk',
      entity_id: String(rowId),
      action: 'due_date_change',
      before: { due_date: prior.due_date ?? null },
      after: { due_date: fields.due_date ?? null },
    });
  }
  if (hasNonDueDateFields) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'risk',
      entity_id: String(rowId),
      action: 'update',
      before: auditSnapshot(prior as RiskRow | null | undefined),
      after: auditSnapshot(updated as RiskRow),
    });
  }
  return updated;
}

export async function deactivateRisk(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getRiskRepo(projectId, rowId);
  const updated = await deactivateRiskRepo(projectId, rowId);
  if (!updated) throw new NotFoundError('Not found', 'risk');
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'risk',
    entity_id: String(rowId),
    action: 'deactivate',
    before: { status: prior?.status ?? null },
    after: { status: 'deactivated' },
  });
  return updated;
}
