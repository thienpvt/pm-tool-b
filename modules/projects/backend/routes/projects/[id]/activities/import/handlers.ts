import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { importActivities, listActivityJiraKeys } from '@/modules/projects/backend/services/activities.service';

export async function getActivitiesImportHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listActivityJiraKeys(params.id, actor)); }

export async function postActivitiesImportHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const { activities } = body as { activities: Record<string, unknown>[] };
  return NextResponse.json(await importActivities(params.id, actor, activities));
}
