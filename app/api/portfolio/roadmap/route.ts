import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { getRoadmap } from '@/lib/services/roadmap.service';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(
      await getRoadmap(toAccessActor(user)),
    );
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
