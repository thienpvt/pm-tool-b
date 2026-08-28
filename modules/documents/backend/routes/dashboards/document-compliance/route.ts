import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getDocumentCompliance } from '@/modules/documents/backend/services/document-compliance.service';

export const GET = withCpmo(async (req, { actor }) => {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  return NextResponse.json(await getDocumentCompliance(actor, query));
});
