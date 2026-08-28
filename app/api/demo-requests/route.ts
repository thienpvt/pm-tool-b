import { NextRequest, NextResponse } from 'next/server';
import { createDemoRequest } from '@/modules/admin/backend/repositories/demo-requests.repo';
import { demoRequestSchema } from './schema';

export async function POST(req: NextRequest) {
  const parsed = demoRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }
  const { full_name, phone, email, company_name } = parsed.data;
  const id = await createDemoRequest(full_name, phone, email, company_name);
  return NextResponse.json({ id }, { status: 201 });
}
