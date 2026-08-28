import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { generateKickoffPPT } from '@/lib/export/ppt';

export async function postExportPptHandler(
  req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const body = await req.json().catch(() => ({}));
  const buf = await generateKickoffPPT(Number(params.id), actor, body);

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="kickoff-presentation.pptx"`,
    },
  });
}
