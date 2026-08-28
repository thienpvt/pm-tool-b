import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { listAuditLogs } from '@/modules/audit/backend/services/audit.service';

export const GET = withCpmo(async (req, { actor }) => {
  const { searchParams } = new URL(req.url);
  const entity_type = searchParams.get('entity_type') ?? undefined;
  const entity_id = searchParams.get('entity_id') ?? undefined;
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw != null ? Number(limitRaw) : undefined;
  const rows = await listAuditLogs(actor, {
    entity_type,
    entity_id,
    from,
    to,
    limit,
  });
  return NextResponse.json(rows);
});
