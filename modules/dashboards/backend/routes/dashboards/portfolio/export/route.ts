import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { exportPortfolioDashboard } from '@/modules/dashboards/backend/services/spec-dashboards.service';
import { portfolioExportSchema } from './schema';

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const result = await exportPortfolioDashboard(
      actor,
      body as { format: 'xlsx' | 'pdf'; filters?: Record<string, unknown> },
    );
    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  },
  { schema: portfolioExportSchema },
);
