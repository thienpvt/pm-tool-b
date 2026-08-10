/**
 * Typed service-layer errors. HTTP-code-free by design (SVC-03) — mapping to
 * responses lives in `serviceErrorResponse` in `lib/api-errors.ts` so this
 * layer stays free of framework HTTP types.
 *
 * Shape mirrors `UnknownColumnError` (bare `extends Error`, `this.name`,
 * structured payload). Do NOT add an HTTP code field — that is what forbids
 * basing these on `IntegrationError`.
 */

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  readonly resource?: string;

  constructor(message = 'Not found', resource?: string) {
    super(message);
    this.name = 'NotFoundError';
    this.resource = resource;
  }
}

export class ValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/** Resource-state conflict (e.g. duplicate holiday date). Maps to 409. */
export class ConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}
