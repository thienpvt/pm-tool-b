import { NextResponse } from 'next/server';

/**
 * Structured stdout/stderr logging for backend calls.
 *
 * Transport is plain `console` on purpose: Railway and K8s collect the
 * container's stdout/stderr, so that IS the log pipeline. A log library would
 * add a dependency, and `output: 'standalone'` would have to trace it, to
 * produce the same lines.
 *
 * Metadata only — never request/response bodies. `/api/auth/login` bodies carry
 * plaintext passwords and the Jira/Anthropic routes carry tokens, so bodies are
 * a standing leak risk that a redaction list will eventually miss.
 */

export const REQUEST_ID_HEADER = 'x-request-id';

/** Short correlation id — long enough to disambiguate concurrent requests. */
export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Read the id stamped by proxy.ts. `-` when called outside a proxied request. */
export function requestId(req: Request): string {
  return req.headers.get(REQUEST_ID_HEADER) ?? '-';
}

function line(tag: string, parts: (string | undefined)[]): string {
  return `${new Date().toISOString()} ${tag} ${parts.filter(Boolean).join(' ')}`;
}

/** One line per inbound backend call. Called from proxy.ts. */
export function logRequest(id: string, method: string, path: string, hasSession: boolean): void {
  console.log(line('[req]', [id, method, path, `sess=${hasSession ? 'y' : 'n'}`]));
}

/**
 * Log a failing backend call and build its response.
 *
 * `body` and `status` are passed through untouched so each call site keeps the
 * exact response shape it had before — this adds logging, it does not change
 * any API contract.
 */
export function serverError(
  req: Request,
  e: unknown,
  body: unknown,
  status = 500,
): NextResponse {
  logError(req, e, status);
  return NextResponse.json(body, { status });
}

/** Log a failing backend call without building a response. */
export function logError(req: Request, e: unknown, status: number): void {
  const method = req.method;
  const path = safePath(req.url);
  const message = e instanceof Error ? e.message : String(e);

  console.error(line('[err]', [requestId(req), method, path, String(status), message]));
  if (e instanceof Error && e.stack) console.error(e.stack);
}

/** Path only — query strings carry ids and search terms we do not want in logs. */
function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
