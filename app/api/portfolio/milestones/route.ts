import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { listPortfolioMilestones } from '@/lib/repositories/portfolio.repo';

// Danh sách milestone của toàn bộ project mà user xem được (kèm tên project).
// Dùng cho selector "Theo Milestone" trong Portfolio Roadmap.
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const milestones = await listPortfolioMilestones(user.company_id, Boolean(user.is_admin));

  return NextResponse.json(milestones);
}
