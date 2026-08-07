import { NextResponse } from 'next/server';
import { UnknownColumnError } from '@/lib/repositories/_helpers';

/**
 * Map a repository error to a response.
 *
 * A rejected column is a client mistake, not a server fault: it returns 400 naming the
 * offending columns so the caller can see which key was refused. Anything else keeps the
 * existing `String(e)` 500 shape that routes already return.
 *
 * This lives outside `lib/repositories/` on purpose — repository modules must not import
 * `next/server` (REPO-06).
 */
export function repoErrorResponse(e: unknown) {
  if (e instanceof UnknownColumnError) {
    return NextResponse.json({ error: e.message, columns: e.columns }, { status: 400 });
  }
  return NextResponse.json({ error: String(e) }, { status: 500 });
}
