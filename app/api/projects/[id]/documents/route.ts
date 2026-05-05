import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json(await db.all('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC', id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();

  // Weekly reports always create a new row (diary style — no upsert)
  if (body.type === 'status_report') {
    const r = await db.run('INSERT INTO documents (project_id, type, title, content_json) VALUES (?,?,?,?)',
      id, 'status_report', body.title ?? 'Weekly Report', JSON.stringify(body.content ?? {}));
    return NextResponse.json(await db.get('SELECT * FROM documents WHERE id = ?', r.lastInsertRowid), { status: 201 });
  }

  // All other types: upsert (one per type per project)
  const existing = await db.get('SELECT id FROM documents WHERE project_id = ? AND type = ?', id, body.type);
  if (existing) {
    await db.run("UPDATE documents SET content_json = ?, title = ?, updated_at = datetime('now') WHERE id = ?",
      JSON.stringify(body.content), body.title ?? body.type, (existing as { id: number }).id);
    return NextResponse.json(await db.get('SELECT * FROM documents WHERE id = ?', (existing as { id: number }).id));
  }
  const r = await db.run('INSERT INTO documents (project_id, type, title, content_json) VALUES (?,?,?,?)',
    id, body.type, body.title ?? body.type, JSON.stringify(body.content ?? {}));
  return NextResponse.json(await db.get('SELECT * FROM documents WHERE id = ?', r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  const doc = await db.get('SELECT id FROM documents WHERE id = ? AND project_id = ?', body.id, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.run("UPDATE documents SET content_json = ?, title = ?, updated_at = datetime('now') WHERE id = ?",
    JSON.stringify(body.content), body.title, body.id);
  return NextResponse.json(await db.get('SELECT * FROM documents WHERE id = ?', body.id));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const docId = new URL(req.url).searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
  const db = await getDb();
  const doc = await db.get('SELECT id FROM documents WHERE id = ? AND project_id = ?', docId, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.run('DELETE FROM documents WHERE id = ?', docId);
  return NextResponse.json({ ok: true });
}
