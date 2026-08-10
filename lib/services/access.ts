import { projectAccessRow } from '@/lib/repositories/projects.repo';
import { ForbiddenError, NotFoundError } from './errors';

/** Plain actor fields the route peels off the session before calling a service. */
export type AccessActor = {
  company_id: number | null;
  is_admin: number | boolean;
};

/**
 * Tenant-ownership assert for project-scoped services (SVC-04).
 *
 * Returns void on success and throws on denial — never a boolean. A forgotten
 * `if` on a boolean return is the failure mode this phase exists to prevent.
 *
 * Order is fixed (T-04-03 existence oracle contract):
 * 1. admin bypass (no ownership query)
 * 2. missing project → NotFoundError
 * 3. owner via company_id OR customer_company_id
 * 4. null-company actor allowed ONLY when BOTH tenancy columns are null (CR-01)
 */
export async function assertProjectAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<void> {
  if (actor.is_admin) return;

  const row = await projectAccessRow(projectId);
  if (!row) throw new NotFoundError('Not found', 'project');

  if (actor.company_id !== null) {
    const allowed =
      row.company_id === actor.company_id || row.customer_company_id === actor.company_id;
    if (!allowed) throw new ForbiddenError();
    return;
  }

  // Null-company actor: only fully unassigned projects (mirrors listProjects CR-01).
  if (row.company_id === null && row.customer_company_id === null) return;
  throw new ForbiddenError();
}
