import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { generateWordDoc } from '@/lib/export/word';

export async function getExportWordHandler(
  req: NextRequest,
  { params, actor }: HandlerContext<{ id: string; type: string }>,
) {
  const { id, type } = params;
  const docId = new URL(req.url).searchParams.get('docId');
  const buf = await generateWordDoc(
    Number(id),
    actor,
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
}
