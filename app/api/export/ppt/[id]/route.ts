import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { generateKickoffPPT } from '@/lib/export/ppt';

// generateKickoffPPT(id, actor, body) self-asserts project access (Phase 4
// SVC-06); withProjectAccess adds a second, redundant-but-idempotent assert.
// rawBody: true — the handler parses its own body (preserves the
// req.json().catch(() => ({})) passthrough verbatim).
export const POST = withProjectAccess(async (req, { params, actor }) => {
  const body = await req.json().catch(() => ({}));
  const buf = await generateKickoffPPT(Number(params.id), actor, body);

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="kickoff-presentation.pptx"`,
    },
  });
}, { rawBody: true });
