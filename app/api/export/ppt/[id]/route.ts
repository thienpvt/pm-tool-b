import { NextRequest, NextResponse } from 'next/server';
import { generateKickoffPPT } from '@/lib/export/ppt';
import { serverError } from '@/lib/log';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const buf = await generateKickoffPPT(Number(id), body);

    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="kickoff-presentation.pptx"`,
      },
    });
  } catch (e) {
    return serverError(req, e, { error: String(e) });
  }
}
