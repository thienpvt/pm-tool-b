import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string; expId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, expId } = await params;
  const db = await getDb();

  const sys = await db.get('SELECT id FROM operations_systems WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.run('DELETE FROM operations_expenses WHERE id = ? AND operations_system_id = ?', expId, id);
  return NextResponse.json({ ok: true });
}
