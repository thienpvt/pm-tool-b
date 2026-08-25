import type { Activity, Holiday, DateMode } from '../types';
import { MO_FULL, MO_SHORT, rd } from './RoadmapHelpers';

export type WeekCell = { label: string; sx: number; w: number };
export type MonthCell = { label: string; fullLabel: string; year: number; sx: number; totalW: number; weeks: WeekCell[] };

export type RoadmapLayout = {
  emptyLabel: string;
  rangeStart: Date;
  rangeEnd: Date;
  totalDays: number;
  ppd: number;
  totalW: number;
  showWeekLabel: boolean;
  months: MonthCell[];
  multiYear: boolean;
  yearGroups: { year: number; w: number }[];
  today: Date;
  todayX: number;
  showToday: boolean;
  weekendBands: { x: number; w: number }[];
  holidayMarkers: { x: number; name: string }[];
  pBar: (a: Activity) => { lx: number; w: number } | null;
  aBar: (a: Activity) => { lx: number; w: number } | null;
  ROW: number;
  LEFT: number;
  HDR: number;
  totalBodyH: number;
};

export function computeRoadmapLayout(
  phaseGroups: { phase: string; acts: Activity[] }[],
  holidays: Holiday[],
  dateMode: DateMode,
  viewYear: number | null,
  viewPeriod: string,
  collapsedPhases: Set<string>,
  collapsedParents: Set<number>,
): { empty: true; emptyLabel: string } | { empty: false; layout: RoadmapLayout } {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const allMs: number[] = [];
  for (const { acts } of phaseGroups)
    for (const a of acts) {
      if (dateMode !== 'actual') {
        const s = rd(a.plan_start), e = rd(a.plan_end);
        if (s) allMs.push(s.getTime());
        if (e) allMs.push(e.getTime());
      }
      if (dateMode !== 'plan') {
        const s = rd(a.actual_start);
        const e = rd(a.actual_end) ?? (a.actual_start ? today : null);
        if (s) allMs.push(s.getTime());
        if (e) allMs.push(e.getTime());
      }
    }

  const emptyLabel = dateMode === 'actual'
    ? 'Chưa có Actual Start/End để hiển thị'
    : 'Điền Plan Start và Plan End cho các activity trước.';

  let rangeStart: Date, rangeEnd: Date;
  if (viewYear !== null) {
    if (viewPeriod === 'q1')           { rangeStart = new Date(viewYear, 0, 1);  rangeEnd = new Date(viewYear, 2, 31); }
    else if (viewPeriod === 'q2')      { rangeStart = new Date(viewYear, 3, 1);  rangeEnd = new Date(viewYear, 5, 30); }
    else if (viewPeriod === 'q3')      { rangeStart = new Date(viewYear, 6, 1);  rangeEnd = new Date(viewYear, 8, 30); }
    else if (viewPeriod === 'q4')      { rangeStart = new Date(viewYear, 9, 1);  rangeEnd = new Date(viewYear, 11, 31); }
    else if (viewPeriod.startsWith('m')) {
      const mo = parseInt(viewPeriod.slice(1));
      rangeStart = new Date(viewYear, mo, 1);
      rangeEnd   = new Date(viewYear, mo + 1, 0);
    } else {
      rangeStart = new Date(viewYear, 0, 1);
      rangeEnd   = new Date(viewYear, 11, 31);
    }
  } else {
    if (!allMs.length) return { empty: true, emptyLabel };
    const minMs = Math.min(...allMs), maxMs = Math.max(...allMs);
    rangeStart = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1);
    rangeEnd   = new Date(new Date(maxMs).getFullYear(), new Date(maxMs).getMonth() + 1, 0);
  }

  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
  const ppd = Math.max(3, Math.min(32, Math.round(1100 / totalDays)));
  const totalW  = totalDays * ppd;
  const weekW   = 7 * ppd;
  const showWeekLabel = weekW >= 18;

  const months: MonthCell[] = [];
  {
    let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd) {
      const yr = cur.getFullYear(), mo = cur.getMonth();
      const lastDay = new Date(yr, mo + 1, 0).getDate();
      const mStartPx = Math.max(0, Math.round((cur.getTime() - rangeStart.getTime()) / 86_400_000) * ppd);
      const mEndPx   = Math.min(totalW, (Math.round((new Date(yr, mo, lastDay).getTime() - rangeStart.getTime()) / 86_400_000) + 1) * ppd);
      const wDefs = [
        { label: 'W1', d0: 1, d1: 7 }, { label: 'W2', d0: 8, d1: 14 },
        { label: 'W3', d0: 15, d1: 21 }, { label: 'W4', d0: 22, d1: lastDay },
      ];
      const weeks: WeekCell[] = wDefs.map(({ label, d0, d1 }) => {
        const wsx = Math.max(0, Math.round((new Date(yr, mo, d0).getTime() - rangeStart.getTime()) / 86_400_000) * ppd);
        const wex = Math.min(totalW, (Math.round((new Date(yr, mo, Math.min(d1, lastDay)).getTime() - rangeStart.getTime()) / 86_400_000) + 1) * ppd);
        return { label, sx: wsx, w: Math.max(0, wex - wsx) };
      }).filter(w => w.w > 0);
      months.push({ label: MO_SHORT[mo], fullLabel: MO_FULL[mo], year: yr, sx: mStartPx, totalW: Math.max(0, mEndPx - mStartPx), weeks });
      cur = new Date(yr, mo + 1, 1);
    }
  }
  const multiYear = new Set(months.map(m => m.year)).size > 1;
  const yearGroups: { year: number; w: number }[] = [];
  for (const m of months) {
    if (yearGroups.length && yearGroups[yearGroups.length - 1].year === m.year)
      yearGroups[yearGroups.length - 1].w += m.totalW;
    else yearGroups.push({ year: m.year, w: m.totalW });
  }

  const todayX    = Math.round((today.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
  const showToday = todayX > 0 && todayX < totalW;

  const weekendBands: { x: number; w: number }[] = [];
  {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    while (d <= rangeEnd) {
      const sx = Math.round((d.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
      const bw = Math.min(2 * ppd, totalW - sx);
      if (bw > 0) weekendBands.push({ x: sx, w: bw });
      d.setDate(d.getDate() + 7);
    }
  }

  const holidayMarkers: { x: number; name: string }[] = holidays
    .map(h => ({ d: rd(h.date), name: h.name }))
    .filter(h => h.d !== null)
    .map(h => ({ x: Math.round((h.d!.getTime() - rangeStart.getTime()) / 86_400_000) * ppd, name: h.name }))
    .filter(h => h.x >= 0 && h.x < totalW);

  function pBar(a: Activity) {
    const s = rd(a.plan_start), e = rd(a.plan_end);
    if (!s || !e) return null;
    const sx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const ex = Math.round((e.getTime() - rangeStart.getTime()) / 86_400_000) * ppd + ppd;
    const lx = Math.max(0, sx), rx = Math.min(totalW, ex);
    if (rx <= lx) return null;
    return { lx, w: rx - lx };
  }
  function aBar(a: Activity) {
    const s = rd(a.actual_start);
    if (!s) return null;
    const e = rd(a.actual_end) ?? today;
    const sx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const ex = Math.round((e.getTime() - rangeStart.getTime()) / 86_400_000) * ppd + ppd;
    const lx = Math.max(0, sx), rx = Math.min(totalW, ex);
    if (rx <= lx) return null;
    return { lx, w: rx - lx };
  }

  const ROW   = dateMode === 'both' ? 58 : 50;
  const LEFT  = 268;
  const HDR   = (multiYear ? 22 : 0) + 26 + 22;
  const totalBodyH = phaseGroups.reduce((h, { phase, acts }) => {
    if (collapsedPhases.has(phase)) return h + 30;
    const parents = acts.filter(a => !a.parent_id);
    let visRows = 0;
    for (const p of parents) {
      visRows++;
      if (!collapsedParents.has(p.id)) visRows += acts.filter(c => c.parent_id === p.id).length;
    }
    return h + 30 + visRows * ROW;
  }, 0);

  return {
    empty: false,
    layout: {
      emptyLabel, rangeStart, rangeEnd, totalDays, ppd, totalW, showWeekLabel,
      months, multiYear, yearGroups, today, todayX, showToday,
      weekendBands, holidayMarkers, pBar, aBar, ROW, LEFT, HDR, totalBodyH,
    },
  };
}
