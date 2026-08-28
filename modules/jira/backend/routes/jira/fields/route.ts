import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { companyJiraConfig } from '@/modules/admin/backend/repositories/jira-config.repo';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { listFields } from '@/lib/integrations/jira/client';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Distinguish the two 503 cases the route emits today: no saved config vs
  // config saved but env values missing. The resolver collapses both to null,
  // so the config-row presence check lives here (no credential resolution).
  const cfg = await companyJiraConfig(user.company_id);
  if (!cfg?.base_url_var) return NextResponse.json({ error: 'Jira chưa cấu hình' }, { status: 503 });

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) return NextResponse.json({ error: 'Thiếu env vars' }, { status: 503 });

  try {
    const customFields = await listFields(creds);
    return NextResponse.json(customFields);
  } catch (err) {
    return integrationErrorResponse(err);
  }
}
