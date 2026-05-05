import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const rows = db.prepare('SELECT * FROM project_holidays WHERE project_id = ? ORDER BY date ASC').all(Number(id));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { date, name } = await req.json();
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });
  const db = getDb();
  // Prevent duplicate dates
  const existing = db.prepare('SELECT id FROM project_holidays WHERE project_id = ? AND date = ?').get(Number(id), date);
  if (existing) return NextResponse.json({ error: 'date already exists' }, { status: 409 });
  const result = db.prepare('INSERT INTO project_holidays (project_id, date, name) VALUES (?, ?, ?)').run(Number(id), date, name ?? '');
  const row = db.prepare('SELECT * FROM project_holidays WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hid = new URL(req.url).searchParams.get('hid');
  if (!hid) return NextResponse.json({ error: 'hid required' }, { status: 400 });
  const db = getDb();
  db.prepare('DELETE FROM project_holidays WHERE id = ? AND project_id = ?').run(Number(hid), Number(id));
  return NextResponse.json({ ok: true });
}
