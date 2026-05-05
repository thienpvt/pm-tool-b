import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const rows = await db.all('SELECT * FROM project_holidays WHERE project_id = ? ORDER BY date ASC', Number(id));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, name } = await req.json();
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  const db = await getDb();
  // Prevent duplicate dates
  const existing = await db.get('SELECT id FROM project_holidays WHERE project_id = ? AND date = ?', Number(id), date);
  if (existing) return NextResponse.json({ error: 'date already exists' }, { status: 409 });
  const result = await db.run('INSERT INTO project_holidays (project_id, date, name) VALUES (?, ?, ?)', Number(id), date, name ?? '');
  const row = await db.get('SELECT * FROM project_holidays WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hid = new URL(req.url).searchParams.get('hid');
  if (!hid) return NextResponse.json({ error: 'hid required' }, { status: 400 });
  const db = await getDb();
  await db.run('DELETE FROM project_holidays WHERE id = ? AND project_id = ?', Number(hid), Number(id));
  return NextResponse.json({ ok: true });
}
