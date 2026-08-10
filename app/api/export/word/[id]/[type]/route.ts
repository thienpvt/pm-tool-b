import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { generateWordDoc } from '@/lib/export/word';

type Params = { params: Promise<{ id: string; type: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, type } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const docId = new URL(req.url).searchParams.get('docId');
  try {
    const buf = await generateWordDoc(
      Number(id),
      { company_id: user.company_id, is_admin: user.is_admin },
      type,
      docId ? Number(docId) : undefined,
    );
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${type}-${id}.docx"`,
      },
    });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
