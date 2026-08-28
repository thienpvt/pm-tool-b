import type { WeeklyPeriodRow } from '@/modules/weekly/backend/repositories/weekly-periods.repo';

function addUtcDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function resolveCurrentPeriod(
  periods: WeeklyPeriodRow[],
  todayIsoDate: string,
): WeeklyPeriodRow | null {
  if (periods.length === 0) return null;

  const containing = periods.find(
    (p) => p.start_date <= todayIsoDate && todayIsoDate <= p.end_date,
  );
  if (containing) return containing;

  return periods.reduce((latest, p) =>
    p.start_date > latest.start_date ? p : latest,
  );
}

export function isDueInUpcomingOrOverdue(
  dueDate: string | null | undefined,
  todayIsoDate: string,
): boolean {
  if (!dueDate) return false;
  if (dueDate < todayIsoDate) return true;
  const windowEnd = addUtcDays(todayIsoDate, 7);
  return dueDate >= todayIsoDate && dueDate <= windowEnd;
}
