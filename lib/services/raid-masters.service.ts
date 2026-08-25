import {
  listOverdueMilestones as listOverdueMilestonesRepo,
  listUpcomingMilestones as listUpcomingMilestonesRepo,
} from '@/lib/repositories/milestones.repo';

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function listUpcomingMilestones(companyId: number | null) {
  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = addUtcDays(today, 7);
  return listUpcomingMilestonesRepo(companyId, today, windowEnd);
}

export async function listOverdueMilestones(companyId: number | null) {
  const today = new Date().toISOString().slice(0, 10);
  return listOverdueMilestonesRepo(companyId, today);
}
