import type { Instrumentation } from 'next';
import { REQUEST_ID_HEADER } from '@/lib/log';

/**
 * Catches server errors Next.js would otherwise swallow into a bare 500.
 *
 * Most route handlers have no try/catch, so their throws never reach a
 * `console.error` at the call site. `onRequestError` is the framework-level
 * hook that sees them, which is why deploys showed no log on failure.
 *
 * Note: `error` is typed `unknown` here (not `{ digest } & Error` as the docs
 * suggest), and headers may be `string[]` — both are narrowed below.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const rawId = request.headers[REQUEST_ID_HEADER];
  const id = (Array.isArray(rawId) ? rawId[0] : rawId) ?? '-';
  const message = err instanceof Error ? err.message : String(err);

  console.error(
    `${new Date().toISOString()} [err] ${id} ${request.method} ${request.path} ` +
      `uncaught route=${context.routePath} type=${context.routeType} ${message}`,
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
};
