import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  await db.run('DELETE FROM timeline_import_mappings WHERE id = ?', id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { name, mappings_json } = await req.json();
  const db = await getDb();
  await db.run(
    'UPDATE timeline_import_mappings SET name = ?, mappings_json = ? WHERE id = ?',
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
    id,
  );
  return NextResponse.json(await db.get('SELECT * FROM timeline_import_mappings WHERE id = ?', id));
}
