import {
  createRisk as createRiskRepo,
  deactivateRisk as deactivateRiskRepo,
  findRiskByCode,
  getRisk as getRiskRepo,
  listRisks as listRisksRepo,
  updateRisk as updateRiskRepo,
} from '@/lib/repositories/risks.repo';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { ConflictError, NotFoundError } from './errors';

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
    return await createRiskRepo(projectId, body);
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
  const updated = await updateRiskRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'risk');
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
