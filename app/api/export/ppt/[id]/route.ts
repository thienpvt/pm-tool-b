import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { generateKickoffPPT } from '@/lib/export/ppt';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const buf = await generateKickoffPPT(Number(id), {
      company_id: user.company_id,
      is_admin: user.is_admin,
    }, body);

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="kickoff-presentation.pptx"`,
      },
    });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
