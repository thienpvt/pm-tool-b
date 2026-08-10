export type IntegrationErrorKind = 'timeout' | 'auth' | 'upstream' | 'validation' | 'network';

/**
 * Normalized integration error. Carries a machine-readable `kind` plus the
 * service name and (for upstream/auth failures) the HTTP status. Never embeds
 * a secret value — `cause` stays server-side only (T-03-01).
 */
export class IntegrationError extends Error {
  readonly kind: IntegrationErrorKind;
  readonly service: string;
  /** Upstream HTTP status when kind === 'upstream' | 'auth'. */
  readonly status?: number;
  readonly cause?: unknown;

  constructor(opts: {
    kind: IntegrationErrorKind;
    service: string;
    status?: number;
    cause?: unknown;
    message?: string;
  }) {
    super(opts.message ?? `IntegrationError[${opts.service}:${opts.kind}]`);
    this.name = 'IntegrationError';
    this.kind = opts.kind;
    this.service = opts.service;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

/**
 * Runs `promise` under a timer. A timeout and a caller abort both surface as
 * `AbortError`, so a `timedOut` flag records which one fired: timeout maps to
 * kind 'timeout', caller abort and generic rejection map to 'network' (Pitfall
 * 6). The wrapper races the promise against its own abort signal so a timeout
 * resolves at `ms` even when the promise ignores the signal; the timer is
 * cleared in `finally` so the process never hangs (INTG-04, T-03-05). The
 * `service` label defaults to 'jira' for backward compatibility; callers pass
 * their own service name ('resend', 'anthropic', ...) so normalized errors
 * carry the right identity.
 */
export async function withFetchTimeout<T>(
  promise: Promise<T>,
  ms: number,
  callerSignal?: AbortSignal,
  service = 'jira',
): Promise<{ value: T; error: null } | { value: null; error: IntegrationError }> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  if (callerSignal?.aborted) controller.abort();
  else if (callerSignal) callerSignal.addEventListener('abort', onCallerAbort, { once: true });

  const abortPromise = new Promise<never>((_, reject) => {
    if (controller.signal.aborted) reject(controller.signal.reason ?? new DOMException('Aborted', 'AbortError'));
    else controller.signal.addEventListener('abort', () => reject(controller.signal.reason ?? new DOMException('Aborted', 'AbortError')), { once: true });
  });

  try {
    const value = await Promise.race([promise, abortPromise]);
    return { value, error: null };
  } catch (e) {
    if (timedOut) return { value: null, error: new IntegrationError({ kind: 'timeout', service, cause: e }) };
    return { value: null, error: new IntegrationError({ kind: 'network', service, cause: e }) };
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}
