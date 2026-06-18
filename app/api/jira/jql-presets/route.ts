import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const MAX_PRESETS = 10;

export async function GET() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM jira_jql_presets ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { name, jql } = await req.json();
  if (!name || !jql) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const db = await getDb();
  const existing = await db.all<{ id: number }>('SELECT id FROM jira_jql_presets ORDER BY created_at DESC');

  if (existing.length >= MAX_PRESETS) {
    const oldest = existing[existing.length - 1];
    await db.run('DELETE FROM jira_jql_presets WHERE id = ?', oldest.id);
  }

  const r = await db.run(
    'INSERT INTO jira_jql_presets (name, jql) VALUES (?, ?)',
    name,
    jql,
  );
  const row = await db.get('SELECT * FROM jira_jql_presets WHERE id = ?', r.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
