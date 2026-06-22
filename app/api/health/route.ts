import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// TEMP DIAGNOSTIC — reverted after troubleshooting DB connection.
export async function GET() {
  const url = process.env.DATABASE_URL || '';
  let host = '';
  try {
    host = new URL(url).host;
  } catch {
    /* unparseable */
  }
  const info: Record<string, unknown> = {
    ok: true,
    hasDbUrl: !!url,
    host,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
  };
  try {
    const db = await getDb();
    const tables = await db.all<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    );
    info.db = 'connected';
    info.tableCount = tables.length;
  } catch (e) {
    const err = e as { message?: string; code?: string; stack?: string };
    info.db = 'error';
    info.dbErrorCode = err?.code ?? null;
    info.dbError = String(err?.message ?? e);
    info.stack = String(err?.stack ?? '').split('\n').slice(0, 5);
  }
  return NextResponse.json(info);
}
