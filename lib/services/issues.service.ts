import {
  createIssue as createIssueRepo,
  deleteIssue as deleteIssueRepo,
  listIssues as listIssuesRepo,
  updateIssue as updateIssueRepo,
} from '@/lib/repositories/issues.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

export async function listIssues(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return listIssuesRepo(projectId);
}

export async function createIssue(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return createIssueRepo(projectId, body);
}

export async function updateIssue(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  const updated = await updateIssueRepo(projectId, rowId, fields);
  if (!updated) throw new NotFoundError('Not found', 'issue');
  return updated;
}

export async function deleteIssue(
  projectId: number | string,
  actor: AccessActor,
  rowId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  const result = await deleteIssueRepo(projectId, rowId);
  if (!result || Number(result.changes ?? 0) === 0) {
    throw new NotFoundError('Not found', 'issue');
  }
  return result;
}
