import {
  createIssue as createIssueRepo,
  deactivateIssue as deactivateIssueRepo,
  findIssueByCode,
  getIssue as getIssueRepo,
  listIssues as listIssuesRepo,
  updateIssue as updateIssueRepo,
} from '@/lib/repositories/issues.repo';
import { appendDueDateHistory } from '@/lib/repositories/raid-due-date-history.repo';
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

export async function listIssues(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listIssuesRepo(projectId);
}

export async function createIssue(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (code) {
    assertUniqueCode(await findIssueByCode(projectId, code), 'Issue code already exists');
  }
  try {
    return await createIssueRepo(projectId, body);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError('Issue code already exists');
    throw err;
  }
}

export async function updateIssue(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const code = typeof fields.code === 'string' ? fields.code.trim() : '';
  if (code) {
    assertUniqueCode(
      await findIssueByCode(projectId, code, rowId),
      'Issue code already exists',
    );
  }
  const prior = fields.due_date !== undefined ? await getIssueRepo(projectId, rowId) : null;
  const updated = await updateIssueRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'issue');
  if (
    fields.due_date !== undefined
    && prior
    && String(fields.due_date) !== String(prior.due_date ?? '')
  ) {
    await appendDueDateHistory({
      entity_type: 'issue',
      entity_id: String(rowId),
      old_due: prior.due_date != null ? String(prior.due_date) : null,
      new_due: fields.due_date != null ? String(fields.due_date) : null,
      changed_by: actor.user_id,
    });
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'issue',
      entity_id: String(rowId),
      action: 'due_date_change',
      before: { due_date: prior.due_date ?? null },
      after: { due_date: fields.due_date ?? null },
    });
  }
  return updated;
}

export async function deactivateIssue(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getIssueRepo(projectId, rowId);
  const updated = await deactivateIssueRepo(projectId, rowId);
  if (!updated) throw new NotFoundError('Not found', 'issue');
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'issue',
    entity_id: String(rowId),
    action: 'deactivate',
    before: { status: prior?.status ?? null },
    after: { status: 'deactivated' },
  });
  return updated;
}
