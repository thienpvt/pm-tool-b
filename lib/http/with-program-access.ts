import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { assertProgramAccess } from '@/lib/services/programs.service';
import { withAuth, type HandlerContext, type WrapperOptions } from './with-auth';

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
      const program = (await assertProgramAccess(ctx.params.id, ctx.actor)) as TProgram;
      return handler(req, { ...ctx, program });
    },
    opts,
  );
}
