import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { importActivities, listActivityJiraKeys } from '@/lib/services/activities.service';

export const POST = withProjectAccess(async (_req, { params, actor, body }) => {
  const { activities } = body as { activities: Record<string, unknown>[] };
  return NextResponse.json(await importActivities(params.id, actor, activities));
});

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listActivityJiraKeys(params.id, actor)),
);
