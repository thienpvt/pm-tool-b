import {
  createProject as createProjectRepo,
  deleteProject as deleteProjectRepo,
  getProject as getProjectRepo,
  listProjects as listProjectsRepo,
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

/** Company-scoped list for `app/api/projects/route.ts` GET (SVC-01). */
export async function listProjects(actor: AccessActor) {
  return listProjectsRepo(actor.company_id, Boolean(actor.is_admin));
}

/**
 * Create a project for `app/api/projects/route.ts` POST (SVC-01/SVC-04).
 *
 * Resolves the target company here, not in the route: an admin may place the
 * project in an arbitrary company via `body.company_id`; everyone else is
 * silently placed in their own session company regardless of what the body
 * says (T-04-30 — preserve, do not add a new 403).
 *
 * `createProject` deliberately does NOT catch `UnknownColumnError` — same
 * propagation contract as `updateProject` above.
 */
export async function createProject(actor: AccessActor, body: Record<string, unknown>) {
  const companyId = actor.is_admin ? ((body.company_id as number | null | undefined) ?? null) : actor.company_id;
  return createProjectRepo(companyId, body);
}

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
