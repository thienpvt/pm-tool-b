import { NextResponse } from 'next/server';
import { IntegrationError } from '@/lib/integrations/errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';

/**
 * Map a repository error to a response.
 *
 * A rejected column is a client mistake, not a server fault: it returns 400 naming the
 * offending columns so the caller can see which key was refused. Unexpected failures are
 * logged server-side without exposing database details in the response.
 *
 * This lives outside `lib/repositories/` on purpose — repository modules must not import
 * `next/server` (REPO-06).
 */
export function repoErrorResponse(e: unknown) {
  if (e instanceof UnknownColumnError) {
    return NextResponse.json({ error: e.message, columns: e.columns }, { status: 400 });
  }
  console.error('Unexpected repository error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** Maps normalized integration failures without exposing raw upstream bodies. */
export function integrationErrorResponse(e: unknown) {
  if (!(e instanceof IntegrationError)) {
    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (e.service !== 'resend') {
    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 502 });
  }

  if (e.kind === 'upstream') {
    const data = e.cause as { message?: unknown; name?: unknown } | undefined;
    const error = typeof data?.message === 'string'
      ? data.message
      : typeof data?.name === 'string'
        ? data.name
        : 'Resend API error';
    return NextResponse.json({ error }, { status: e.status ?? 502 });
  }

  if (e.kind === 'network' || e.kind === 'timeout') {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }

  if (e.kind === 'validation') {
    return NextResponse.json({ error: 'Resend API error' }, { status: 502 });
  }

  console.error('Unexpected integration error', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 502 });
}
