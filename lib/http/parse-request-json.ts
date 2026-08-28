import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export type ParseRequestJsonResult =
  | { ok: true; data: unknown }
  | { ok: false; response: NextResponse };

/** Standardized malformed-JSON handling for D-23 session-gated routes (Phase 20 WR-02). */
export async function parseRequestJson(req: NextRequest): Promise<ParseRequestJsonResult> {
  try {
    return { ok: true, data: await req.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }
}
