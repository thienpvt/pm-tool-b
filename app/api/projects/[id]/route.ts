import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

async function checkAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (user.is_admin) return { error: null, user };

  const db = await getDb();
  const project = await db.get('SELECT company_id FROM projects WHERE id = ?', Number(projectId)) as { company_id: number } | undefined;
  if (!project) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null };
  if (project.company_id !== user.company_id) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  return { error: null, user };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    const db = await getDb();
    const project = await db.get('SELECT * FROM projects WHERE id = ?', id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    const body = await req.json();
    const db = await getDb();
    const fields = Object.keys(body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(body), id];
    await db.run(`UPDATE projects SET ${fields} WHERE id = ?`, ...values);
    return NextResponse.json(await db.get('SELECT * FROM projects WHERE id = ?', id));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    const db = await getDb();
    await db.run('DELETE FROM projects WHERE id = ?', id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
