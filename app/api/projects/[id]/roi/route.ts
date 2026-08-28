import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { parseFiscalYear } from '@/lib/fiscal/vnd';
import { getProjectRoi } from '@/modules/projects/backend/services/roi.service';
import { ValidationError } from '@/lib/services/errors';
import { serviceErrorResponse } from '@/lib/api-errors';

export const GET = withProjectAccess(async (req, { params, actor }) => {
  const { searchParams } = new URL(req.url);
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
});
