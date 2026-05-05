import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  return NextResponse.json(getDb().prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC').all(id));
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  // Weekly reports always create a new row (diary style — no upsert)
  if (body.type === 'status_report') {
    const r = db.prepare('INSERT INTO documents (project_id, type, title, content_json) VALUES (?,?,?,?)')
      .run(id, 'status_report', body.title ?? 'Weekly Report', JSON.stringify(body.content ?? {}));
    return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
  }

  // All other types: upsert (one per type per project)
  const existing = db.prepare('SELECT id FROM documents WHERE project_id = ? AND type = ?').get(id, body.type);
  if (existing) {
    db.prepare("UPDATE documents SET content_json = ?, title = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(body.content), body.title ?? body.type, (existing as { id: number }).id);
    return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get((existing as { id: number }).id));
  }
  const r = db.prepare('INSERT INTO documents (project_id, type, title, content_json) VALUES (?,?,?,?)')
    .run(id, body.type, body.title ?? body.type, JSON.stringify(body.content ?? {}));
  return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND project_id = ?').get(body.id, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare("UPDATE documents SET content_json = ?, title = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(body.content), body.title, body.id);
  return NextResponse.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(body.id));
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const docId = new URL(req.url).searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
  const db = getDb();
  const doc = db.prepare('SELECT id FROM documents WHERE id = ? AND project_id = ?').get(docId, id);
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
  return NextResponse.json({ ok: true });
}
