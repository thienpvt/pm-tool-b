import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { getSessionFromRequest, type SessionUser } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { toAccessActor, type AccessActor } from '@/lib/services/access';
import { ForbiddenError, NotFoundError } from '@/lib/services/errors';

export type { AccessActor };

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

/**
 * ROUTE-08 shadow-mode gate. Read per-request (never hoisted to module scope)
 * so an operator can flip `ACCESS_ENFORCEMENT=shadow` at deploy time without a
 * rebuild (T-06-04). NEVER defaults on — absent/any-other-value is enforcing.
 */
export function isAccessShadowMode(): boolean {
  return process.env.ACCESS_ENFORCEMENT === 'shadow';
}

/**
 * Structured '[ACCESS-SHADOW]' log line for a would-be denial that shadow mode
 * allowed through. Shared by withAuth's own catch tail and the access
 * wrappers (withProjectAccess/withProgramAccess), which soften only their
 * ownership assert via this same helper (T-06-01/T-06-02).
 */
export function logAccessShadowDenial(
  req: NextRequest,
  user: SessionUser,
  error: ForbiddenError | NotFoundError,
  targetId?: string,
): void {
  console.error(
    '[ACCESS-SHADOW]',
    JSON.stringify({
      method: req.method,
      path: req.nextUrl.pathname,
      userId: user.id,
      companyId: user.company_id,
      errorKind: error.constructor.name,
      targetId,
    }),
  );
}

export type WrapperOptions<TBody = unknown> = {
  /** Zod schema validated at the boundary. On safeParse failure, returns the
   *  route's pre-existing 400 shape (behavior freeze) — either via `badRequest`
   *  or the first issue message. */
  schema?: z.ZodType<TBody>;
  badRequest?: (error: z.ZodError<TBody>) => NextResponse;
  /** Skip the wrapper's auto `req.json()` on POST/PUT/PATCH so the handler can
   *  consume the request itself (formData/multipart routes). Only affects the
   *  no-schema path — a schema set alongside rawBody still parses/validates. */
  rawBody?: boolean;
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
    const actor: AccessActor = toAccessActor(user);

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
    } else if (!opts?.rawBody && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
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
      // ROUTE-08 shadow mode: ONLY ForbiddenError/NotFoundError are softened,
      // and only when the operator has explicitly set the env flag for this
      // deploy. Every other error kind (UnknownColumnError above, any generic
      // Error below via serviceErrorResponse) is NEVER allowed through — the
      // flag must never swallow an arbitrary handler bug (T-06-02).
      if (isAccessShadowMode() && (e instanceof ForbiddenError || e instanceof NotFoundError)) {
        logAccessShadowDenial(req, user, e, (params as Record<string, string>).id);
        return handler(req, { user, actor, params, body: body as TBody });
      }
      return serviceErrorResponse(e);
    }
  };
}
