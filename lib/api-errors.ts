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

/**
 * Maps normalized integration failures without exposing raw upstream bodies.
 *
 * Anthropic failures map to 502 by default; the two report routes (500 today)
 * pass `force500: true` to keep the orchestrator-locked 500/502 status split.
 * Only `e.message` crosses to the client — `e.cause` (raw SDK/upstream errors)
 * stays server-side.
 */
export function integrationErrorResponse(e: unknown, opts?: { force500?: boolean }) {
  if (!(e instanceof IntegrationError)) {
    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (e.service !== 'resend' && e.service !== 'anthropic' && e.service !== 'jira') {
    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 502 });
  }

  if (e.service === 'jira') {
    // Behavior freeze: Jira upstream errors pass through the upstream status
    // (a Jira 401/429 reaches the client as that status), with the message the
    // routes already extract from the upstream body. Timeout/network → the
    // search route's 500 string; validation → fixed 502 string, schema detail
    // never leaks (T-03-19).
    if (e.kind === 'upstream' || e.kind === 'auth') {
      const data = e.cause as { message?: unknown } | undefined;
      const error = typeof data?.message === 'string' ? data.message : e.message;
      return NextResponse.json({ error }, { status: e.status ?? 500 });
    }

    if (e.kind === 'timeout' || e.kind === 'network') {
      return NextResponse.json({ error: `Lỗi kết nối Jira: ${e.message}` }, { status: 500 });
    }

    if (e.kind === 'validation') {
      console.error('Integration response failed validation', { service: e.service, cause: e.cause });
      return NextResponse.json({ error: 'Jira trả về dữ liệu không hợp lệ' }, { status: 502 });
    }

    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (e.service === 'resend') {
    if (e.kind === 'upstream') {
      const data = e.cause as { message?: unknown; name?: unknown } | undefined;
      const error = typeof data?.message === 'string'
        ? data.message
        : typeof data?.name === 'string'
          ? data.name
          : 'Resend API error';
      // Behavior freeze (Pitfall 5): the old route returned 502 for every
      // non-ok Resend response, regardless of the upstream status.
      return NextResponse.json({ error }, { status: 502 });
    }

    if (e.kind === 'network' || e.kind === 'timeout') {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }

    if (e.kind === 'validation') {
      console.error('Integration response failed validation', { service: e.service, cause: e.cause });
      return NextResponse.json({ error: 'Resend API error' }, { status: 502 });
    }

    console.error('Unexpected integration error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 502 });
  }

  // Anthropic — behavior freeze (Pitfall 5): report routes return 500 today,
  // generate-email routes 502. The split is preserved via force500.
  //
  // `validation` escapes force500 on purpose: it is an error kind this phase
  // introduced (the client now checks Anthropic output against a schema before
  // any caller sees it), so it has no pre-phase behavior to freeze. INTG-06
  // requires a shape mismatch not to surface as a 500 — the frozen split still
  // governs upstream/timeout/network/auth.
  if (e.kind === 'validation') {
    console.error('Integration response failed validation', { service: e.service, cause: e.cause });
    return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status: 502 });
  }

  const status = opts?.force500 ? 500 : 502;
  return NextResponse.json({ error: e.message ?? 'AI generation failed' }, { status });
}
