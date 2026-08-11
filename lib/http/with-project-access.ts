import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertProjectAccess } from '@/lib/services/access';
import type { ProjectAccessRow } from '@/lib/repositories/projects.repo';
import { withAuth, type HandlerContext, type WrapperOptions } from './with-auth';

/**
 * Composes withAuth with the project ownership assert (SVC-04). The assert
 * runs inside withAuth's try, so ForbiddenError/NotFoundError map to 403/404
 * through the existing catch tail — same wire behavior as the service-level
 * assert today. The resolved row is handed to the handler as ctx.project so
 * callers that need it (e.g. projects/[id]/route.ts GET) don't re-fetch.
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
      const project = await assertProjectAccess(ctx.params.id, ctx.actor);
      return handler(req, { ...ctx, project });
    },
    opts,
  );
}
