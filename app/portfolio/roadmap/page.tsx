'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { ChevronDown, ChevronRight, ChevronLeft, Building2, Map, CalendarDays } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type PhaseInfo = {
  phase: string;
  start_date: string | null;
  end_date:   string | null;
  total:      number;
  done:       number;
  completion_pct: number;
};
type ProjectRow = {
  id: number; name: string; pm_name: string;
  customer_id: number | null;
  start_date: string; end_date: string;
  current_phase: string; completion_pct: number;
  rag: 'red' | 'amber' | 'green';
  phases: PhaseInfo[];
};
type CustomerGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type RoadmapData = { customers: CustomerGroup[]; noCustomerProjects: ProjectRow[] };

// ─── Phase colours (vivid, clearly distinct) ──────────────────────────────────
type PhaseStyle = { labelBg: string; bg: string; border: string; fill: string; textColor: string };

const PS: Record<string, PhaseStyle> = {
  Initiation: { labelBg: 'bg-purple-100 text-purple-700', bg: '#f3e8ff', border: '#9333ea', fill: '#c084fc', textColor: '#6b21a8' },
  Planning:   { labelBg: 'bg-blue-100 text-blue-700',     bg: '#dbeafe', border: '#2563eb', fill: '#60a5fa', textColor: '#1e40af' },
  Execution:  { labelBg: 'bg-amber-100 text-amber-700',   bg: '#fef3c7', border: '#d97706', fill: '#fbbf24', textColor: '#92400e' },
  Closing:    { labelBg: 'bg-green-100 text-green-700',   bg: '#dcfce7', border: '#16a34a', fill: '#4ade80', textColor: '#14532d' },
};
const PHASES = ['Initiation', 'Planning', 'Execution', 'Closing'] as const;

const RAG_COLOR: Record<string, string> = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };

// ─── Layout ───────────────────────────────────────────────────────────────────
const LABEL_W = 220;
const BAR_H   = 24;
const BAR_GAP = 5;
const ROW_PAD = 6;
const MIN_Q_W = 120;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildYearTimeline(year: number) {
  const rStart = new Date(year, 0, 1, 0, 0, 0);
  const rEnd   = new Date(year, 11, 31, 23, 59, 59);
  const totalMs = rEnd.getTime() - rStart.getTime();
  const qs = [
    { label: `Q1 ${year}`, start: new Date(year, 0, 1),  end: new Date(year, 2, 31, 23, 59, 59) },
    { label: `Q2 ${year}`, start: new Date(year, 3, 1),  end: new Date(year, 5, 30, 23, 59, 59) },
    { label: `Q3 ${year}`, start: new Date(year, 6, 1),  end: new Date(year, 8, 30, 23, 59, 59) },
    { label: `Q4 ${year}`, start: new Date(year, 9, 1),  end: new Date(year, 11, 31, 23, 59, 59) },
  ];
  const todayPct = Math.max(0, Math.min(100, (Date.now() - rStart.getTime()) / totalMs * 100));
  return { rStart, rEnd, totalMs, qs, todayPct };
}

// ─── Project-in-year check ────────────────────────────────────────────────────
function projectInYear(p: ProjectRow, year: number): boolean {
  const yStart = new Date(year, 0, 1).getTime();
  const yEnd   = new Date(year, 11, 31, 23, 59, 59).getTime();

  if (p.start_date || p.end_date) {
    const s = p.start_date ? new Date(p.start_date + 'T00:00:00').getTime() : -Infinity;
    const e = p.end_date   ? new Date(p.end_date   + 'T23:59:59').getTime() :  Infinity;
    return s <= yEnd && e >= yStart;
  }

  // Fall back to min/max of phase activity dates
  const times: number[] = [];
  for (const ph of p.phases) {
    if (ph.start_date) times.push(new Date(ph.start_date + 'T00:00:00').getTime());
    if (ph.end_date)   times.push(new Date(ph.end_date   + 'T23:59:59').getTime());
  }
  if (!times.length) return false;
  return Math.min(...times) <= yEnd && Math.max(...times) >= yStart;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioRoadmap() {
  const [data, setData]         = useState<RoadmapData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [openSet, setOpenSet]   = useState<Set<number>>(new Set());
  const [selectedYear, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    fetch('/api/portfolio/roadmap').then(r => r.json()).then((d: RoadmapData) => {
      setData(d);
      setOpenSet(new Set([...d.customers.map(c => c.id), 0]));
      setLoading(false);
    });
  }, []);

  // Available years: range from (min project year - 1) to (max project year + 1),
  // always including at least currentYear-1 .. currentYear+2
  const availableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    let minY = cur - 1;
    let maxY = cur + 2;

    if (data) {
      const all = [...data.customers.flatMap((c: CustomerGroup) => c.projects), ...data.noCustomerProjects];
      for (const p of all) {
        const toY = (s: string) => new Date(s + 'T00:00:00').getFullYear();
        if (p.start_date) { minY = Math.min(minY, toY(p.start_date) - 1); maxY = Math.max(maxY, toY(p.start_date) + 1); }
        if (p.end_date)   { minY = Math.min(minY, toY(p.end_date)   - 1); maxY = Math.max(maxY, toY(p.end_date)   + 1); }
        for (const ph of p.phases) {
          if (ph.start_date) { minY = Math.min(minY, toY(ph.start_date) - 1); maxY = Math.max(maxY, toY(ph.start_date) + 1); }
          if (ph.end_date)   { minY = Math.min(minY, toY(ph.end_date)   - 1); maxY = Math.max(maxY, toY(ph.end_date)   + 1); }
        }
      }
    }

    const years: number[] = [];
    for (let y = minY; y <= maxY; y++) years.push(y);
    return years;
  }, [data]);

  const tl = useMemo(() => buildYearTimeline(selectedYear), [selectedYear]);

  // Convert date string → unclamped % within selected year
  const rawPct = useCallback((dateStr: string, eod = false) => {
    const ms = new Date(dateStr + (eod ? 'T23:59:59' : 'T00:00:00')).getTime();
    return (ms - tl.rStart.getTime()) / tl.totalMs * 100;
  }, [tl]);

  const groups = useMemo((): CustomerGroup[] => {
    if (!data) return [];
    const filter = (ps: ProjectRow[]) => ps.filter(p => projectInYear(p, selectedYear));
    return [
      ...data.customers
        .map((c: CustomerGroup) => ({ ...c, projects: filter(c.projects) }))
        .filter((c: CustomerGroup) => c.projects.length > 0),
      ...((() => {
        const ps = filter(data.noCustomerProjects);
        return ps.length ? [{ id: 0, name: 'Unassigned', industry: '', projects: ps }] : [];
      })()),
    ];
  }, [data, selectedYear]);

  const toggleCustomer = useCallback((id: number) => {
    setOpenSet((prev: Set<number>) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading roadmap…</p>
          </div>
        </main>
      </div>
    );
  }

  const totalProjects = groups.reduce((s, g) => s + g.projects.length, 0);
  const curYearIdx = availableYears.indexOf(selectedYear);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-3 bg-white border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Map className="h-5 w-5 text-blue-500" />
              Portfolio Roadmap
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalProjects} project{totalProjects !== 1 ? 's' : ''} · phase bars from activity dates
            </p>
          </div>

          {/* Year selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => curYearIdx > 0 && setYear(availableYears[curYearIdx - 1])}
              disabled={curYearIdx <= 0}
              className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    y === selectedYear
                      ? 'bg-white shadow-sm text-blue-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={() => curYearIdx < availableYears.length - 1 && setYear(availableYears[curYearIdx + 1])}
              disabled={curYearIdx >= availableYears.length - 1}
              className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          <Link href="/" className="text-sm text-blue-600 hover:underline shrink-0">← Dashboard</Link>
        </div>

        {/* ── Legend ── */}
        <div className="shrink-0 px-6 py-2 bg-white border-b flex items-center gap-4 text-xs flex-wrap">
          <span className="font-semibold text-slate-600">Phase:</span>
          {PHASES.map(ph => {
            const s = PS[ph];
            return (
              <span
                key={ph}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px]"
                style={{ backgroundColor: s.bg, color: s.textColor, border: `1px solid ${s.border}` }}
              >
                <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: s.fill }} />
                {ph}
              </span>
            );
          })}
          <span className="text-slate-300 mx-1">|</span>
          <span className="text-slate-500">Bar fill = completion %</span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-0.5 h-4 bg-blue-400 rounded" />Today
          </span>
        </div>

        {/* ── Roadmap ── */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
            style={{ minWidth: LABEL_W + 4 * MIN_Q_W }}
          >

            {/* Quarter header */}
            <div className="flex border-b bg-slate-50" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
              <div
                className="shrink-0 bg-slate-50 border-r flex items-end px-4 pb-2 pt-3"
                style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 30 }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer / Project</span>
              </div>
              <div className="flex flex-1">
                {tl.qs.map(q => (
                  <div
                    key={q.label}
                    className="flex-1 border-r last:border-r-0 py-2 px-2 text-center"
                    style={{ minWidth: MIN_Q_W }}
                  >
                    <p className="text-xs font-bold text-slate-600">{q.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {q.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {q.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty */}
            {groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-300">
                <CalendarDays className="h-10 w-10" />
                <p className="text-sm">No projects found.</p>
                <Link href="/projects/new" className="text-sm text-blue-500 hover:underline mt-1">Create a project →</Link>
              </div>
            )}

            {/* Customer groups */}
            {groups.map(customer => {
              const isOpen = openSet.has(customer.id);
              return (
                <div key={customer.id} className="border-b last:border-b-0">

                  {/* Customer header */}
                  <button
                    onClick={() => toggleCustomer(customer.id)}
                    className="w-full flex items-stretch border-b bg-slate-50/90 hover:bg-slate-100/80 transition-colors text-left"
                  >
                    <div
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50/90"
                      style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                    >
                      {isOpen
                        ? <ChevronDown  className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                      <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{customer.name}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3 px-4 py-2.5 text-xs text-slate-400 flex-wrap">
                      <span>{customer.projects.length} project{customer.projects.length !== 1 ? 's' : ''}</span>
                      {PHASES.map(ph => {
                        const cnt = customer.projects.filter(p => p.current_phase === ph).length;
                        if (!cnt) return null;
                        return (
                          <span
                            key={ph}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: PS[ph].bg, color: PS[ph].textColor }}
                          >
                            {cnt} {ph}
                          </span>
                        );
                      })}
                    </div>
                  </button>

                  {/* Project rows */}
                  {isOpen && customer.projects.map((project, pIdx) => {
                    // Determine which phase bars overlap with selected year
                    const barsToShow = project.phases
                      .filter(ph => {
                        if (!ph.start_date && !ph.end_date) return false;
                        const r0 = ph.start_date ? rawPct(ph.start_date) : -Infinity;
                        const r1 = ph.end_date   ? rawPct(ph.end_date, true) : Infinity;
                        return r1 > 0 && r0 < 100;
                      });

                    // Fallback: use project-level dates if no phase activity dates
                    const fallbackR0 = project.start_date ? rawPct(project.start_date) : -Infinity;
                    const fallbackR1 = project.end_date   ? rawPct(project.end_date, true) : Infinity;
                    const showFallback = barsToShow.length === 0 &&
                      (project.start_date || project.end_date) &&
                      fallbackR1 > 0 && fallbackR0 < 100;

                    const numBars = barsToShow.length + (showFallback ? 1 : 0);
                    const rowH = Math.max(
                      (numBars || 1) * (BAR_H + BAR_GAP) + ROW_PAD * 2,
                      BAR_H + ROW_PAD * 2,
                    );

                    return (
                      <div
                        key={project.id}
                        className={`flex border-b last:border-b-0 ${pIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                      >
                        {/* Label (sticky) */}
                        <div
                          className={`shrink-0 flex flex-col justify-center gap-0.5 px-4 border-r ${pIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                          style={{ width: LABEL_W, minWidth: LABEL_W, minHeight: rowH, position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          <Link href={`/projects/${project.id}`} className="group">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: RAG_COLOR[project.rag] }}
                              />
                              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-600">
                                {project.name}
                              </span>
                            </div>
                          </Link>
                          {project.pm_name && (
                            <p className="text-[10px] text-slate-400 truncate pl-3">{project.pm_name}</p>
                          )}
                          <div className="pl-3">
                            <span
                              className="text-[9px] font-semibold px-1 py-0.5 rounded"
                              style={{
                                backgroundColor: PS[project.current_phase]?.bg ?? '#f1f5f9',
                                color: PS[project.current_phase]?.textColor ?? '#475569',
                              }}
                            >
                              {project.current_phase}
                            </span>
                          </div>
                        </div>

                        {/* Timeline canvas */}
                        <div
                          className="flex-1 relative overflow-hidden"
                          style={{ height: rowH, minHeight: rowH }}
                        >
                          {/* Quarter grid lines */}
                          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                            {tl.qs.map(q => (
                              <div
                                key={q.label}
                                className="flex-1 border-r border-slate-100 last:border-r-0"
                                style={{ minWidth: MIN_Q_W }}
                              />
                            ))}
                          </div>

                          {/* Today line (only if current year) */}
                          {tl.todayPct > 0 && tl.todayPct < 100 && (
                            <div
                              aria-hidden
                              className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
                              style={{ left: `${tl.todayPct}%`, backgroundColor: '#60a5fa', opacity: 0.7 }}
                            />
                          )}

                          {/* Phase bars */}
                          {barsToShow.map((ph, barIdx) => {
                            const s = PS[ph.phase] ?? PS['Execution'];
                            const r0 = ph.start_date ? rawPct(ph.start_date) : 0;
                            const r1 = ph.end_date   ? rawPct(ph.end_date, true) : 100;
                            const startPct = Math.max(0, r0);
                            const endPct   = Math.min(100, r1);
                            const widthPct = Math.max(endPct - startPct, 0.4);
                            const top = ROW_PAD + barIdx * (BAR_H + BAR_GAP);

                            return (
                              <Link key={ph.phase} href={`/projects/${project.id}`} className="block">
                                <div
                                  className="absolute group cursor-pointer"
                                  style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                                    title={`${ph.phase}: ${ph.done}/${ph.total} done · ${ph.completion_pct}%`}
                                  >
                                    {/* Completion fill */}
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0"
                                      style={{ width: `${ph.completion_pct}%`, backgroundColor: s.fill }}
                                    />
                                    {/* Label */}
                                    <div
                                      className="relative z-10 flex items-center gap-1.5 px-2 min-w-0 w-full"
                                      style={{ color: s.textColor }}
                                    >
                                      <span className="text-[10px] font-bold shrink-0">
                                        {ph.phase.slice(0, 4).toUpperCase()}
                                      </span>
                                      <span className="text-[10px] truncate flex-1 opacity-80">
                                        {ph.done}/{ph.total}
                                      </span>
                                      <span className="text-[10px] font-bold shrink-0">
                                        {ph.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}

                          {/* Fallback bar (project-level dates) */}
                          {showFallback && (() => {
                            const s = PS[project.current_phase] ?? PS['Execution'];
                            const startPct = Math.max(0, fallbackR0);
                            const endPct   = Math.min(100, fallbackR1);
                            const widthPct = Math.max(endPct - startPct, 0.4);
                            return (
                              <Link href={`/projects/${project.id}`} className="block">
                                <div
                                  className="absolute group cursor-pointer"
                                  style={{ top: ROW_PAD, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                                    title={`${project.current_phase} · ${project.completion_pct}%`}
                                  >
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0"
                                      style={{ width: `${project.completion_pct}%`, backgroundColor: s.fill }}
                                    />
                                    <div
                                      className="relative z-10 flex items-center gap-1.5 px-2 min-w-0 w-full"
                                      style={{ color: s.textColor }}
                                    >
                                      <span className="text-[10px] font-bold shrink-0">
                                        {project.current_phase.slice(0, 4).toUpperCase()}
                                      </span>
                                      <span className="text-[10px] font-bold shrink-0">
                                        {project.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })()}

                          {/* No activity in this year */}
                          {numBars === 0 && (
                            <div className="absolute inset-0 flex items-center px-4">
                              <span className="text-[10px] text-slate-300 italic">No activity in {selectedYear}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

          </div>
        </div>
      </main>
    </div>
  );
}
