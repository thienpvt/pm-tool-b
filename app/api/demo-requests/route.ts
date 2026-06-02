import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { full_name, phone, email, company_name } = await req.json();
  if (!full_name?.trim() || !phone?.trim() || !email?.trim() || !company_name?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  const db = await getDb();
  const r = await db.run(
    'INSERT INTO demo_requests (full_name, phone, email, company_name) VALUES (?, ?, ?, ?)',
    full_name.trim(), phone.trim(), email.trim(), company_name.trim()
  );
  return NextResponse.json({ id: r.lastInsertRowid }, { status: 201 });
}
