'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { ChevronDown, ChevronRight, Building2, Map, CalendarDays } from 'lucide-react';

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
  customer_id: number | null; customer_name: string;
  start_date: string; end_date: string;
  current_phase: string; completion_pct: number;
  rag: 'red' | 'amber' | 'green';
  phases: PhaseInfo[];
};
type CustomerGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type RoadmapData = { customers: CustomerGroup[]; noCustomerProjects: ProjectRow[] };

// ─── Phase style ──────────────────────────────────────────────────────────────
const PHASES = ['Initiation', 'Planning', 'Execution', 'Closing'] as const;

const PS: Record<string, { labelBg: string; barBg: string; barBorder: string; fill: string; text: string }> = {
  Initiation: { labelBg: 'bg-purple-100 text-purple-700', barBg: 'rgba(168,85,247,0.10)', barBorder: 'rgba(168,85,247,0.50)', fill: 'rgba(168,85,247,0.35)', text: 'text-purple-700' },
  Planning:   { labelBg: 'bg-blue-100 text-blue-700',     barBg: 'rgba(59,130,246,0.10)',  barBorder: 'rgba(59,130,246,0.50)',  fill: 'rgba(59,130,246,0.35)',  text: 'text-blue-700'   },
  Execution:  { labelBg: 'bg-amber-100 text-amber-700',   barBg: 'rgba(245,158,11,0.10)',  barBorder: 'rgba(245,158,11,0.50)',  fill: 'rgba(245,158,11,0.35)',  text: 'text-amber-700'  },
  Closing:    { labelBg: 'bg-green-100 text-green-700',   barBg: 'rgba(34,197,94,0.10)',   barBorder: 'rgba(34,197,94,0.50)',   fill: 'rgba(34,197,94,0.35)',   text: 'text-green-700'  },
};

const RAG_COLOR: Record<string, string> = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };

// ─── Quarter helpers ──────────────────────────────────────────────────────────
type Quarter = { label: string; start: Date; end: Date };

function qStart(d: Date) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

function buildQuarters(minD: Date, maxD: Date): { qs: Quarter[]; rStart: Date; rEnd: Date } {
  const rStart = qStart(new Date(minD.getFullYear(), minD.getMonth() - 3, 1));
  const afterMaxQ = qStart(new Date(maxD.getFullYear(), maxD.getMonth() + 3, 1));
  const rEnd = new Date(afterMaxQ.getFullYear(), afterMaxQ.getMonth() + 3, 0, 23, 59, 59);

  const qs: Quarter[] = [];
  let cur = new Date(rStart);
  while (cur <= rEnd && qs.length < 24) {
    const s = new Date(cur);
    const e = new Date(cur.getFullYear(), cur.getMonth() + 3, 0, 23, 59, 59);
    qs.push({ label: `Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()}`, start: s, end: e });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 3, 1);
  }
  return { qs, rStart, rEnd };
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const LABEL_W   = 220; // px — sticky left column
const BAR_H     = 22;  // px — height of each phase bar
const BAR_GAP   = 4;   // px — gap between phase bars
const ROW_PAD   = 6;   // px — top/bottom padding in project row
const MIN_Q_W   = 100; // px — min quarter column width

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortfolioRoadmap() {
  const [data, setData]       = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio/roadmap').then(r => r.json()).then((d: RoadmapData) => {
      setData(d);
      setOpenSet(new Set([...d.customers.map(c => c.id), 0]));
      setLoading(false);
    });
  }, []);

  // ── Derive time range from all phase dates ──────────────────────────────────
  const timeline = useMemo(() => {
    const fallback = () => {
      const now = new Date();
      const { qs, rStart, rEnd } = buildQuarters(
        new Date(now.getFullYear(), now.getMonth() - 3, 1),
        new Date(now.getFullYear(), now.getMonth() + 9, 1),
      );
      const totalMs = rEnd.getTime() - rStart.getTime();
      return { qs, rStart, totalMs, todayPct: (Date.now() - rStart.getTime()) / totalMs * 100 };
    };
    if (!data) return fallback();

    const allProjects = [...data.customers.flatMap(c => c.projects), ...data.noCustomerProjects];
    const dates: Date[] = [];
    for (const p of allProjects) {
      for (const ph of p.phases) {
        if (ph.start_date) dates.push(new Date(ph.start_date + 'T00:00:00'));
        if (ph.end_date)   dates.push(new Date(ph.end_date   + 'T23:59:59'));
      }
      if (p.start_date) dates.push(new Date(p.start_date + 'T00:00:00'));
      if (p.end_date)   dates.push(new Date(p.end_date   + 'T23:59:59'));
    }
    if (!dates.length) return fallback();

    const minD = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())));
    const { qs, rStart, rEnd } = buildQuarters(minD, maxD);
    const totalMs = rEnd.getTime() - rStart.getTime();
    return { qs, rStart, totalMs, todayPct: Math.max(0, Math.min(100, (Date.now() - rStart.getTime()) / totalMs * 100)) };
  }, [data]);

  function pct(dateStr: string, eod = false) {
    const ms = new Date(dateStr + (eod ? 'T23:59:59' : 'T00:00:00')).getTime();
    return Math.max(0, Math.min(100, (ms - timeline.rStart.getTime()) / timeline.totalMs * 100));
  }

  const groups = useMemo((): CustomerGroup[] => {
    if (!data) return [];
    return [
      ...data.customers,
      ...(data.noCustomerProjects.length
        ? [{ id: 0, name: 'Unassigned', industry: '', projects: data.noCustomerProjects }]
        : []),
    ];
  }, [data]);

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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="shrink-0 px-6 py-4 bg-white border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Map className="h-5 w-5 text-blue-500" />
              Portfolio Roadmap
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {totalProjects} project{totalProjects !== 1 ? 's' : ''} across {groups.length} customer{groups.length !== 1 ? 's' : ''}
              &nbsp;·&nbsp;Phase bars positioned by actual activity dates
            </p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Portfolio Dashboard</Link>
        </div>

        {/* ── Legend ── */}
        <div className="shrink-0 px-6 py-2 bg-white border-b flex items-center gap-4 text-xs text-slate-500 flex-wrap">
          <span className="font-semibold text-slate-600">Phase:</span>
          {PHASES.map(ph => (
            <span key={ph} className={`px-2 py-0.5 rounded font-medium ${PS[ph].labelBg}`}>{ph}</span>
          ))}
          <span className="mx-1 text-slate-300">|</span>
          <span>Bar fill = phase completion %</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-0.5 h-4 bg-blue-400 rounded" /> Today
          </span>
        </div>

        {/* ── Roadmap ── */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
            style={{ minWidth: LABEL_W + timeline.qs.length * MIN_Q_W }}
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
                {timeline.qs.map(q => (
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

                  {/* ── Customer header row ── */}
                  <button
                    onClick={() => setOpenSet(prev => {
                      const next = new Set(prev);
                      next.has(customer.id) ? next.delete(customer.id) : next.add(customer.id);
                      return next;
                    })}
                    className="w-full flex items-stretch border-b bg-slate-50/90 hover:bg-slate-100/90 transition-colors text-left"
                  >
                    {/* Label */}
                    <div
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50/90"
                      style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                    >
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                      <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 truncate">{customer.name}</span>
                    </div>
                    {/* Timeline area: summary badges */}
                    <div className="flex-1 flex items-center gap-3 px-4 py-2.5 text-xs text-slate-400 flex-wrap">
                      <span>{customer.projects.length} project{customer.projects.length !== 1 ? 's' : ''}</span>
                      {PHASES.map(ph => {
                        const cnt = customer.projects.filter(p => p.current_phase === ph).length;
                        if (!cnt) return null;
                        return (
                          <span key={ph} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PS[ph].labelBg}`}>
                            {cnt} {ph}
                          </span>
                        );
                      })}
                    </div>
                  </button>

                  {/* ── Project rows ── */}
                  {isOpen && customer.projects.map((project, pIdx) => {
                    // Collect phase bars that have dates
                    const phaseBars = project.phases.filter(ph => ph.start_date || ph.end_date);

                    // Fallback: use project start/end with current_phase color if no activity dates
                    const useFallback = phaseBars.length === 0 && (project.start_date || project.end_date);

                    const numBars = phaseBars.length || (useFallback ? 1 : 0);
                    const rowH = numBars * (BAR_H + BAR_GAP) + ROW_PAD * 2;

                    return (
                      <div
                        key={project.id}
                        className={`flex border-b last:border-b-0 ${pIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                      >
                        {/* Project label (sticky) */}
                        <div
                          className={`shrink-0 flex flex-col justify-center px-4 border-r ${pIdx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                          style={{ width: LABEL_W, minWidth: LABEL_W, minHeight: rowH, position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          <Link href={`/projects/${project.id}`} className="group">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: RAG_COLOR[project.rag] }}
                              />
                              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-600">
                                {project.name}
                              </span>
                            </div>
                            {project.pm_name && (
                              <p className="text-[10px] text-slate-400 truncate pl-3">{project.pm_name}</p>
                            )}
                          </Link>
                        </div>

                        {/* Timeline canvas */}
                        <div
                          className="flex-1 relative"
                          style={{ height: rowH, minHeight: rowH }}
                        >
                          {/* Quarter grid lines */}
                          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                            {timeline.qs.map(q => (
                              <div
                                key={q.label}
                                className="flex-1 border-r border-slate-100 last:border-r-0"
                                style={{ minWidth: MIN_Q_W }}
                              />
                            ))}
                          </div>

                          {/* Today line */}
                          {timeline.todayPct >= 0 && timeline.todayPct <= 100 && (
                            <div
                              aria-hidden
                              className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-60 pointer-events-none z-10"
                              style={{ left: `${timeline.todayPct}%` }}
                            />
                          )}

                          {/* Phase bars from activity data */}
                          {phaseBars.map((ph, barIdx) => {
                            const startPct = ph.start_date ? pct(ph.start_date) : 0;
                            const endPct   = ph.end_date   ? pct(ph.end_date, true) : 100;
                            const widthPct = Math.max(endPct - startPct, 0.5);
                            const style    = PS[ph.phase] ?? PS['Execution'];
                            const top      = ROW_PAD + barIdx * (BAR_H + BAR_GAP);

                            return (
                              <Link key={ph.phase} href={`/projects/${project.id}`} className="block">
                                <div
                                  className="absolute group cursor-pointer"
                                  style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center transition-all hover:brightness-95 shadow-sm"
                                    style={{ backgroundColor: style.barBg, border: `1.5px solid ${style.barBorder}` }}
                                    title={`${ph.phase}: ${ph.done}/${ph.total} done (${ph.completion_pct}%)`}
                                  >
                                    {/* Completion fill */}
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0 rounded-l-md"
                                      style={{ width: `${ph.completion_pct}%`, backgroundColor: style.fill }}
                                    />
                                    {/* Labels */}
                                    <div className="relative z-10 flex items-center gap-1.5 px-2 min-w-0 w-full">
                                      <span className={`text-[10px] font-semibold shrink-0 ${style.text}`}>
                                        {ph.phase.slice(0, 4)}
                                      </span>
                                      <span className="text-[10px] text-slate-500 truncate flex-1">
                                        {ph.done}/{ph.total}
                                      </span>
                                      <span className={`text-[10px] font-bold shrink-0 ${style.text}`}>
                                        {ph.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}

                          {/* Fallback bar (project dates, no activity dates) */}
                          {useFallback && (() => {
                            const startPct = project.start_date ? pct(project.start_date) : 0;
                            const endPct   = project.end_date   ? pct(project.end_date, true) : 100;
                            const widthPct = Math.max(endPct - startPct, 0.5);
                            const style    = PS[project.current_phase] ?? PS['Execution'];
                            return (
                              <Link href={`/projects/${project.id}`} className="block">
                                <div
                                  className="absolute group cursor-pointer"
                                  style={{ top: ROW_PAD, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center transition-all hover:brightness-95 shadow-sm"
                                    style={{ backgroundColor: style.barBg, border: `1.5px solid ${style.barBorder}` }}
                                    title={`${project.current_phase} · ${project.completion_pct}%`}
                                  >
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0 rounded-l-md"
                                      style={{ width: `${project.completion_pct}%`, backgroundColor: style.fill }}
                                    />
                                    <div className="relative z-10 flex items-center gap-1.5 px-2 min-w-0 w-full">
                                      <span className={`text-[10px] font-semibold shrink-0 ${style.text}`}>
                                        {project.current_phase.slice(0, 4)}
                                      </span>
                                      <span className={`text-[10px] font-bold shrink-0 ${style.text}`}>
                                        {project.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })()}

                          {/* No dates placeholder */}
                          {!useFallback && phaseBars.length === 0 && (
                            <div className="absolute inset-0 flex items-center px-4">
                              <span className="text-[10px] text-slate-300 italic">No dates set</span>
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
