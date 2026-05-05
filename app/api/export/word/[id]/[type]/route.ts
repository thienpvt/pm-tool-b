import { NextRequest, NextResponse } from 'next/server';
import { generateWordDoc } from '@/lib/export/word';

type Params = { params: Promise<{ id: string; type: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id, type } = await params;
  const docId = new URL(req.url).searchParams.get('docId');
  try {
    const buf = await generateWordDoc(Number(id), type, docId ? Number(docId) : undefined);
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${type}-${id}.docx"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
