export const LABEL_W = 220;
export const BAR_H   = 24;
export const BAR_GAP = 5;
export const ROW_PAD = 6;
export const MIN_M_W = 72; // min width per month column

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  if (!day) return d;
  return `${day}/${m}/${y}`;
}

export function buildYearTimeline(year: number, startMonth = 0, endMonth = 11) {
  const rStart  = new Date(year, startMonth, 1, 0, 0, 0);
  const rEnd    = new Date(year, endMonth + 1, 0, 23, 59, 59);
  const totalMs = rEnd.getTime() - rStart.getTime();
  const months  = MONTH_NAMES
    .map((label, m) => ({
      label,
      quarter: `Q${Math.floor(m / 3) + 1}`,
      start: new Date(year, m, 1),
      end:   new Date(year, m + 1, 0, 23, 59, 59),
    }))
    .filter((_, m) => m >= startMonth && m <= endMonth);
  const todayPct = Math.max(0, Math.min(100, (Date.now() - rStart.getTime()) / totalMs * 100));
  return { rStart, rEnd, totalMs, months, todayPct };
}
