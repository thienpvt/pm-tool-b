import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const MAX_TEMPLATES = 5;

export async function GET() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM bug_import_mappings ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { name, mappings_json } = await req.json();
  if (!name || !mappings_json) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = await getDb();
  const existing = await db.all<{ id: number }>('SELECT id FROM bug_import_mappings ORDER BY created_at DESC');

  if (existing.length >= MAX_TEMPLATES) {
    const oldest = existing[existing.length - 1];
    await db.run('DELETE FROM bug_import_mappings WHERE id = ?', oldest.id);
  }

  const r = await db.run(
    'INSERT INTO bug_import_mappings (name, mappings_json) VALUES (?, ?)',
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  const row = await db.get('SELECT * FROM bug_import_mappings WHERE id = ?', r.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
