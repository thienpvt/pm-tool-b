import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { generateProjectPlan } from '@/lib/export/excel';

// generateProjectPlan(id, actor) self-asserts project access (Phase 4 SVC-06);
// withProjectAccess adds a second, redundant-but-idempotent assert. Kept for
// the uniform wrapper model — documented in 06-04-SUMMARY.md.
export const GET = withProjectAccess(async (_req, { params, actor }) => {
  const buf = await generateProjectPlan(Number(params.id), actor);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="project-plan-${params.id}.xlsx"`,
    },
  });
});
