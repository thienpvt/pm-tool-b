import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const db = await getDb();
  const rows = await db.all('SELECT * FROM demo_requests ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { id, status, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  await db.run(
    'UPDATE demo_requests SET status = COALESCE(?, status), notes = COALESCE(?, notes) WHERE id = ?',
    status ?? null, notes ?? null, id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  await db.run('DELETE FROM demo_requests WHERE id = ?', Number(id));
  return NextResponse.json({ ok: true });
}
