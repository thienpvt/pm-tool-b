import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM jira_sync_mappings ORDER BY created_at DESC LIMIT 5');
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { mappings_json } = await req.json();
  if (!mappings_json) return NextResponse.json({ error: 'Missing mappings_json' }, { status: 400 });
  const db = await getDb();
  await db.run(
    'INSERT INTO jira_sync_mappings (mappings_json) VALUES (?)',
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  // Keep only the 5 most recent
  await db.run(
    'DELETE FROM jira_sync_mappings WHERE id NOT IN (SELECT id FROM jira_sync_mappings ORDER BY created_at DESC LIMIT 5)',
  );
  return NextResponse.json({ ok: true });
}
