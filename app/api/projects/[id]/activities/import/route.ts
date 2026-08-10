import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { importActivities, listActivityJiraKeys } from '@/lib/services/activities.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { activities } = (await req.json()) as { activities: Record<string, unknown>[] };
    return NextResponse.json(await importActivities(id, actorOf(user), activities));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listActivityJiraKeys(id, actorOf(user)));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
