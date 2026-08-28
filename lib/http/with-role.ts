import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { hasRole, type AccessActor, type AppRole } from '@/lib/services/access';
import { ForbiddenError } from '@/lib/services/errors';
import { withAuth, type HandlerContext, type RouteHandler, type WrapperOptions } from './with-auth';

function requireRole(actor: AccessActor, role: AppRole): void {
  if (!hasRole(actor, role)) throw new ForbiddenError();
}

export function withRole<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = unknown,
>(
  role: AppRole,
  handler: RouteHandler<TParams, TBody>,
  opts?: WrapperOptions<TBody>,
) {
  return withAuth<TParams, TBody>(async (req, ctx) => {
    requireRole(ctx.actor, role);
    return handler(req, ctx);
  }, opts);
}

export function withCpmo<
  TParams extends Record<string, string> = Record<string, string>,
  TBody = unknown,
>(
  handler: RouteHandler<TParams, TBody>,
  opts?: WrapperOptions<TBody>,
) {
  return withRole('cpmo', handler, opts);
}

export type { HandlerContext, RouteHandler, WrapperOptions };
