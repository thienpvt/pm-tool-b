import {
  deleteProgram as deleteProgramRepo,
  getProgram as getProgramRepo,
  listProgramProjects,
  updateProgram as updateProgramRepo,
} from '@/lib/repositories/programs.repo';
import type { AccessActor } from './access';
import { ForbiddenError, NotFoundError } from './errors';

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
