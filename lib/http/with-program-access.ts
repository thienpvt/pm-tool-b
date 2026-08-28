import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertProgramAccess } from '@/modules/portfolio/backend/services/programs.service';
import { ForbiddenError, NotFoundError } from '@/lib/services/errors';
import {
  isAccessShadowMode,
  logAccessShadowDenial,
  withAuth,
  type HandlerContext,
  type WrapperOptions,
} from './with-auth';

/**
 * Composes withAuth with the program/customer ownership assert. Program scope
 * has one company_id column (vs project's company_id OR customer_company_id),
 * so this is a separate wrapper rather than a parameterized one (CONTEXT:
 * "Two wrappers, not a parameterized one").
 *
 * `assertProgramAccess` already returns the row (no flip needed) — this
 * wrapper hands it to the handler as ctx.program. Zero Phase 5 route
 * consumers (Phase 6 converts programs/[id]/**), built now per locked
 * decision so the substrate ships complete.
 *
 * ROUTE-08 shadow re-entry: mirrors withProjectAccess — the try/catch wraps
 * ONLY the assert call. Shadow-on + ForbiddenError/NotFoundError logs and
 * invokes the handler with `program: undefined`; any other error (including
 * one the handler itself throws) is untouched by this catch.
 */
export function withProgramAccess<
  TParams extends { id: string } & Record<string, string> = { id: string },
  TBody = unknown,
  TProgram = Awaited<ReturnType<typeof assertProgramAccess>>,
>(
  handler: (
    req: NextRequest,
    ctx: HandlerContext<TParams, TBody> & { program: TProgram },
  ) => Promise<NextResponse>,
  opts?: WrapperOptions<TBody>,
) {
  return withAuth<TParams, TBody>(
    async (req, ctx) => {
      let program: TProgram | undefined;
      try {
        program = (await assertProgramAccess(ctx.params.id, ctx.actor)) as TProgram;
      } catch (e) {
        if (isAccessShadowMode() && (e instanceof ForbiddenError || e instanceof NotFoundError)) {
          logAccessShadowDenial(req, ctx.user, e, ctx.params.id);
        } else {
          throw e;
        }
      }
      return handler(req, { ...ctx, program: program as TProgram });
    },
    opts,
  );
}
