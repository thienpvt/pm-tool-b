import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertProjectAccess } from '@/lib/services/access';
import type { ProjectAccessRow } from '@/modules/projects/backend/repositories/projects.repo';
import { ForbiddenError, NotFoundError } from '@/lib/services/errors';
import {
  isAccessShadowMode,
  logAccessShadowDenial,
  withAuth,
  type HandlerContext,
  type WrapperOptions,
} from './with-auth';

/**
 * Composes withAuth with the project ownership assert (SVC-04). The assert
 * runs inside withAuth's try, so ForbiddenError/NotFoundError map to 403/404
 * through the existing catch tail — same wire behavior as the service-level
 * assert today. The resolved row is handed to the handler as ctx.project so
 * callers that need it (e.g. projects/[id]/route.ts GET) don't re-fetch.
 *
 * ROUTE-08 shadow re-entry: the try/catch wraps ONLY the assert call, never
 * the handler call. When shadow mode is on and the assert throws
 * ForbiddenError/NotFoundError, we log and invoke the handler with
 * `project: undefined` (no authorized resource) instead of re-throwing to
 * withAuth's 403/404 tail. Any other error — including one the handler itself
 * throws — is untouched by this catch and follows its normal path (shadow
 * off: assert errors propagate to withAuth's tail unchanged; handler errors
 * always propagate to withAuth's tail, never softened here).
 */
export function withProjectAccess<
  TParams extends { id: string } & Record<string, string> = { id: string },
  TBody = unknown,
>(
  handler: (
    req: NextRequest,
    ctx: HandlerContext<TParams, TBody> & { project: ProjectAccessRow },
  ) => Promise<NextResponse>,
  opts?: WrapperOptions<TBody>,
) {
  return withAuth<TParams, TBody>(
    async (req, ctx) => {
      let project: ProjectAccessRow | undefined;
      try {
        project = await assertProjectAccess(ctx.params.id, ctx.actor);
      } catch (e) {
        if (isAccessShadowMode() && (e instanceof ForbiddenError || e instanceof NotFoundError)) {
          logAccessShadowDenial(req, ctx.user, e, ctx.params.id);
        } else {
          throw e;
        }
      }
      return handler(req, { ...ctx, project: project as ProjectAccessRow });
    },
    opts,
  );
}
