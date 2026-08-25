import {
  createProject as createProjectRepo,
  deleteProject as deleteProjectRepo,
  findProjectByCompanyCode,
  getProject as getProjectRepo,
  listProjects as listProjectsRepo,
  updateProject as updateProjectRepo,
} from '@/lib/repositories/projects.repo';
import { getProgram } from '@/lib/repositories/programs.repo';
import {
  assertProjectAccess,
  assertProjectWriteAccess,
  hasRole,
  isCpmo,
  type AccessActor,
} from './access';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from './errors';

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
  const pmOnly =
    hasRole(actor, 'pm') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'viewer');
  if (pmOnly) {
    return listProjectsRepo(actor.company_id, {
      pmEmail: actor.email,
      pmName: actor.display_name,
      username: actor.username,
    });
  }
  return listProjectsRepo(actor.company_id);
}

/**
 * Create a project for `app/api/projects/route.ts` POST (SVC-01/SVC-04).
 *
 * CPMO-only: stamps the session company and ignores body.company_id (D-13).
 *
 * `createProject` deliberately does NOT catch `UnknownColumnError` — same
 * propagation contract as `updateProject` above.
 */
export async function createProject(actor: AccessActor, body: Record<string, unknown>) {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();

  const projectCode = typeof body.project_code === 'string' ? body.project_code.trim() : '';
  if (!projectCode) throw new ValidationError('project_code is required', 'project_code');

  const portfolioYear = body.portfolio_year;
  if (
    portfolioYear === undefined ||
    portfolioYear === null ||
    portfolioYear === '' ||
    !Number.isInteger(Number(portfolioYear))
  ) {
    throw new ValidationError('portfolio_year is required', 'portfolio_year');
  }

  const customerId = body.customer_id;
  if (customerId === undefined || customerId === null || customerId === '') {
    throw new ValidationError('customer_id is required', 'customer_id');
  }

  const program = await getProgram(Number(customerId));
  if (!program) throw new NotFoundError('Program not found', 'program');
  if (program.company_id !== actor.company_id) throw new ForbiddenError();

  if (await findProjectByCompanyCode(actor.company_id, projectCode)) {
    throw new ConflictError('Project code already exists');
  }

  return createProjectRepo(actor.company_id, {
    ...body,
    project_code: projectCode,
    portfolio_year: Number(portfolioYear),
    customer_id: Number(customerId),
  });
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
  await assertProjectWriteAccess(projectId, actor);
  return updateProjectRepo(projectId, fields);
}

export async function deleteProject(projectId: number | string, actor: AccessActor) {
  await assertProjectWriteAccess(projectId, actor);
  return deleteProjectRepo(projectId);
}
