import {
  deleteProject as deleteProjectRepo,
  getProject as getProjectRepo,
  updateProject as updateProjectRepo,
} from '@/lib/repositories/projects.repo';
import { assertProjectAccess, type AccessActor } from './access';
import { NotFoundError } from './errors';

/**
 * Owner-scoped project CRUD for `app/api/projects/[id]/route.ts` — the canonical
 * home for the ownership check that route used to keep as a file-local `checkAccess`.
 *
 * `updateProject` deliberately does NOT catch `UnknownColumnError` — it must propagate
 * to the route's catch chain so `repoErrorResponse` can map it to the REPO-03
 * 400-with-columns contract (T-04-25). Wrapping or swallowing it here would turn a
 * rejected `company_id` into a 500.
 */

export async function getProject(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const project = await getProjectRepo(projectId);
  if (!project) throw new NotFoundError('Not found', 'project');
  return project;
}

export async function updateProject(
  projectId: number | string,
  actor: AccessActor,
  fields: Record<string, unknown>,
) {
  await assertProjectAccess(projectId, actor);
  return updateProjectRepo(projectId, fields);
}

export async function deleteProject(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  return deleteProjectRepo(projectId);
}
