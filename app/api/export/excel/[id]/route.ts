import { NextRequest, NextResponse } from 'next/server';
import { generateProjectPlan } from '@/lib/export/excel';
import { serverError } from '@/lib/log';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const buf = await generateProjectPlan(Number(id));
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="project-plan-${id}.xlsx"`,
      },
    });
  } catch (e) {
    return serverError(req, e, { error: String(e) });
  }
}
