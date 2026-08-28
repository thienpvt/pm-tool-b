import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { generateProjectPlan } from '@/lib/export/excel';

export async function getExportExcelHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const buf = await generateProjectPlan(Number(params.id), actor);
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="project-plan-${params.id}.xlsx"`,
    },
  });
}
