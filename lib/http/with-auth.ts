import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getSessionFromRequest, type SessionUser } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';

/** Plain actor fields peeled off the session — matches lib/services/access.ts's AccessActor. */
export type AccessActor = {
  company_id: number | null;
  is_admin: number | boolean;
};

export type HandlerContext<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = unknown,
> = {
  user: SessionUser;
  actor: AccessActor;
  params: TParams;
  body: TBody;
};

export type RouteHandler<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = unknown,
> = (req: NextRequest, ctx: HandlerContext<TParams, TBody>) => Promise<NextResponse>;

export type WrapperOptions<TBody = unknown> = {
  /** Zod schema validated at the boundary. On safeParse failure, returns the
   *  route's pre-existing 400 shape (behavior freeze) — either via `badRequest`
   *  or the first issue message. */
  schema?: z.ZodType<TBody>;
  badRequest?: (error: z.ZodError<TBody>) => NextResponse;
};

/**
 * Absorbs the boilerplate duplicated in 31 route files: session resolution
 * (401 on missing), `actorOf` derivation, `await params` (Next 16 async
 * params), request body parsing, and the unified error-mapping catch tail.
 *
 * The ONE sanctioned freeze exception (WR-05/HYG-02): malformed JSON on a
 * POST/PUT/PATCH body now returns 400 { error: 'Invalid JSON' } instead of
 * falling through to a generic 500 — a strictly-better behavior already
 * shipped on the 3 report routes.
 */
export function withAuth<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = unknown,
>(
  handler: RouteHandler<TParams, TBody>,
  opts?: WrapperOptions<TBody>,
) {
  return async (req: NextRequest, rawCtx: { params: Promise<TParams> }): Promise<NextResponse> => {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = await rawCtx.params;
    const actor: AccessActor = { company_id: user.company_id, is_admin: user.is_admin };

    let body: unknown;
    if (opts?.schema) {
      try {
        const raw = await req.json();
        const parsed = opts.schema.safeParse(raw);
        if (!parsed.success) {
          if (opts.badRequest) return opts.badRequest(parsed.error);
          return NextResponse.json(
            { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
            { status: 400 },
          );
        }
        body = parsed.data;
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    } else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }
    }

    try {
      return await handler(req, { user, actor, params, body: body as TBody });
    } catch (e) {
      // T-04-25 freeze: a rejected column stays a 400 naming the column.
      // Routes that never throw UnknownColumnError pass straight to serviceErrorResponse.
      if (e instanceof UnknownColumnError) return repoErrorResponse(e);
      return serviceErrorResponse(e);
    }
  };
}
