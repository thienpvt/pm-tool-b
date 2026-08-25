import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { generateWordDoc } from '@/lib/export/word';

// generateWordDoc(id, actor, type, docId) self-asserts project access (Phase 4
// SVC-06); withProjectAccess adds a second, redundant-but-idempotent assert.
export const GET = withProjectAccess<{ id: string; type: string }>(async (req, { params, actor }) => {
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
});
