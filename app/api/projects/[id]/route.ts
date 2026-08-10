import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { serverError } from '@/lib/log';

type Params = { params: Promise<{ id: string }> };

async function checkAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (user.is_admin) return { error: null, user };

  const db = await getDb();
  const project = await db.get<{ company_id: number | null; customer_company_id: number | null }>(
    `SELECT p.company_id, c.company_id AS customer_company_id
     FROM projects p LEFT JOIN customers c ON p.customer_id = c.id
     WHERE p.id = ?`,
    Number(projectId)
  );
  if (!project) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null };
  const allowed = project.company_id === user.company_id || project.customer_company_id === user.company_id;
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
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
    return serverError(req, e, { error: String(e) });
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
    return serverError(req, e, { error: String(e) });
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
    return serverError(req, e, { error: String(e) });
  }
}
