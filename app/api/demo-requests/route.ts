import { NextRequest, NextResponse } from 'next/server';
import { createDemoRequest } from '@/lib/repositories/demo-requests.repo';

export async function POST(req: NextRequest) {
  const { full_name, phone, email, company_name } = await req.json();
  if (!full_name?.trim() || !phone?.trim() || !email?.trim() || !company_name?.trim()) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  const id = await createDemoRequest(full_name.trim(), phone.trim(), email.trim(), company_name.trim());
  return NextResponse.json({ id }, { status: 201 });
}
