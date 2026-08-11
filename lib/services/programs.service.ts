import {
  createProgram as createProgramRepo,
  deleteProgram as deleteProgramRepo,
  getProgram as getProgramRepo,
  listPrograms as listProgramsRepo,
  listProgramProjects,
  projectCountsByProgram,
  updateProgram as updateProgramRepo,
} from '@/lib/repositories/programs.repo';
import type { AccessActor } from './access';
import { ForbiddenError, NotFoundError, ValidationError } from './errors';

/**
 * Programs map to the customers table. Ownership is company_id on the program row,
 * not a project id — do not call assertProjectAccess here.
 *
 * Exported (not just used internally) so `app/api/programs/[id]/project-allocations/route.ts`
 * can assert program-side ownership with the same logic this service already uses for
 * GET/PATCH/DELETE on `/api/programs/[id]`, rather than re-deriving it (T-04-22).
 */
export async function assertProgramAccess(programId: number | string, actor: AccessActor) {
  if (actor.is_admin) {
    const row = await getProgramRepo(programId);
    if (!row) throw new NotFoundError('Not found', 'program');
    return row;
  }

  const row = await getProgramRepo(programId);
  if (!row) throw new NotFoundError('Not found', 'program');

  const companyId = (row as { company_id: number | null }).company_id;
  if (actor.company_id !== null) {
    if (companyId !== actor.company_id) throw new ForbiddenError();
    return row;
  }

  // Null-company actor: only fully unassigned programs.
  if (companyId === null) return row;
  throw new ForbiddenError();
}

export async function getProgramDetail(programId: number | string, actor: AccessActor) {
  const program = await assertProgramAccess(programId, actor);
  const projects = await listProgramProjects(programId);
  return { program, projects };
}

export async function updateProgram(
  programId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProgramAccess(programId, actor);
  return updateProgramRepo(programId, body);
}

export async function deleteProgram(programId: number | string, actor: AccessActor) {
  await assertProgramAccess(programId, actor);
  await deleteProgramRepo(programId);
  return { ok: true as const };
}

/**
 * Company-scoped program list with project_count merged on, for
 * `app/api/programs/route.ts` GET (SVC-01). Moves the whole
 * `Promise.all` + `countMap` merge out of the route — it must not
 * re-assemble it.
 */
export async function listProgramsWithCounts(actor: AccessActor) {
  const isAdmin = Boolean(actor.is_admin);
  const [programs, projectCounts] = await Promise.all([
    listProgramsRepo(actor.company_id, isAdmin),
    projectCountsByProgram(actor.company_id, isAdmin),
  ]);
  const countMap = Object.fromEntries(projectCounts.map(r => [r.customer_id, r.count]));
  return (programs as Array<{ id: number }>).map(c => ({
    ...c,
    project_count: countMap[c.id] ?? 0,
  }));
}

/**
 * Create a program for `app/api/programs/route.ts` POST (SVC-01/SVC-04).
 *
 * Same tenant-placement resolution as `createProject` (T-04-30): admin may
 * supply `body.company_id`, everyone else is placed in their session
 * company regardless of the body. Blank/whitespace name is a
 * ValidationError → 400 'Name required' (preserves the route's exact
 * message, T-04-32).
 */
export async function createProgram(actor: AccessActor, body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new ValidationError('Name required');

  const companyId = actor.is_admin ? ((body.company_id as number | null | undefined) ?? null) : actor.company_id;
  return createProgramRepo(companyId, body);
}
