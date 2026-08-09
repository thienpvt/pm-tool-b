import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createProgram, listPrograms, projectCountsByProgram } from '@/lib/repositories/programs.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json([], { status: 401 });

  const [programs, projectCounts] = await Promise.all([
    listPrograms(user.company_id, Boolean(user.is_admin)),
    projectCountsByProgram(user.company_id, Boolean(user.is_admin)),
  ]);
  const countMap = Object.fromEntries(projectCounts.map(r => [r.customer_id, r.count]));
  return NextResponse.json(programs.map((c: any) => ({ ...c, project_count: countMap[c.id] ?? 0 })));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const companyId = user.is_admin ? (body.company_id ?? null) : user.company_id;
  return NextResponse.json(await createProgram(companyId, body), { status: 201 });
}
