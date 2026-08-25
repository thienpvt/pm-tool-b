import { projectAccessRow, type ProjectAccessRow } from '@/lib/repositories/projects.repo';
import { ForbiddenError, NotFoundError } from './errors';

export type AppRole = 'cpmo' | 'pm' | 'viewer';
export type UserStatus = 'active' | 'inactive' | 'locked';

/** Plain actor fields the route peels off the session before calling a service. */
export type AccessActor = {
  company_id: number | null;
  is_admin: number | boolean;
  roles: AppRole[];
  status: UserStatus;
  user_id: number;
  username: string;
  display_name: string;
  email: string;
};

/** Session fields required to build an AccessActor (avoids auth ↔ access circular import). */
export type AccessActorSource = {
  id: number;
  username: string;
  display_name: string;
  company_id: number | null;
  is_admin: number;
  roles: AppRole[];
  status: UserStatus;
  email: string;
};

export function hasRole(actor: AccessActor, role: AppRole): boolean {
  return actor.roles.includes(role);
}

export function isCpmo(actor: AccessActor): boolean {
  return hasRole(actor, 'cpmo');
}

export function toAccessActor(user: AccessActorSource): AccessActor {
  return {
    company_id: user.company_id,
    is_admin: user.is_admin,
    roles: user.roles ?? [],
    status: user.status,
    user_id: user.id,
    username: user.username,
    display_name: user.display_name,
    email: user.email ?? '',
  };
}

/** Viewer-only actors cannot mutate; cpmo/pm union grants write (D-01, D-15). */
export function assertCanMutate(actor: AccessActor): void {
  if (hasRole(actor, 'viewer') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'pm')) {
    throw new ForbiddenError();
  }
}

/**
 * Tenant-ownership assert for project-scoped services (SVC-04).
 *
 * Returns the project's tenancy row on success and throws on denial — never a
 * boolean. A forgotten `if` on a boolean return is the failure mode this phase
 * exists to prevent. Mirrors `assertProgramAccess`'s return-the-row idiom, so
 * `withProjectAccess` can hand the authorized row to the handler without a
 * second query.
 *
 * Order is fixed (T-04-03 existence oracle contract):
 * 1. missing project → NotFoundError
 * 2. CPMO company match (D-13) or tenant owner via company_id / customer_company_id
 * 3. null-company actor allowed ONLY when BOTH tenancy columns are null (CR-01)
 */
export async function assertProjectAccess(
  projectId: number | string,
  actor: AccessActor,
): Promise<ProjectAccessRow> {
  const row = await projectAccessRow(projectId);
  if (!row) throw new NotFoundError('Not found', 'project');

  if (isCpmo(actor)) {
    if (actor.company_id === null) {
      if (row.company_id === null && row.customer_company_id === null) return row;
      throw new ForbiddenError();
    }
    const allowed =
      row.company_id === actor.company_id || row.customer_company_id === actor.company_id;
    if (!allowed) throw new ForbiddenError();
    return row;
  }

  if (actor.company_id !== null) {
    const allowed =
      row.company_id === actor.company_id || row.customer_company_id === actor.company_id;
    if (!allowed) throw new ForbiddenError();
    return row;
  }

  // Null-company actor: only fully unassigned projects (mirrors listProjects CR-01).
  if (row.company_id === null && row.customer_company_id === null) return row;
  throw new ForbiddenError();
}
