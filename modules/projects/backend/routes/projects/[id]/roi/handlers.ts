import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { parseFiscalYear } from '@/lib/fiscal/vnd';
import { getProjectRoi } from '@/modules/projects/backend/services/roi.service';
import { ValidationError } from '@/modules/projects/backend/services/errors';
import { serviceErrorResponse } from '@/lib/api-errors';

export async function getRoiHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const { searchParams } = new URL(_req.url);
  const rawYear = searchParams.get('fiscal_year');
  if (rawYear === null || rawYear === '') {
    return serviceErrorResponse(new ValidationError('fiscal_year is required', 'fiscal_year'));
  }

  let fiscalYear: number;
  try {
    fiscalYear = parseFiscalYear(rawYear);
  } catch (e) {
    return serviceErrorResponse(e);
  }

  return NextResponse.json(await getProjectRoi(params.id, actor, fiscalYear));
}
