'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import {
  ChevronDown, ChevronRight, Building2, Map, CalendarDays, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProjectRow = {
  id: number; name: string;
  customer_id: number | null; customer_name: string;
  pm_name: string; start_date: string; end_date: string;
  current_phase: string; completion_pct: number;
  rag: 'red' | 'amber' | 'green';
};
type CustomerGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type PortfolioData = {
  projects: ProjectRow[];
  customers: CustomerGroup[];
  noCustomerProjects: ProjectRow[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PHASES = ['Initiation', 'Planning', 'Execution', 'Closing'] as const;
type Phase = typeof PHASES[number];

const PHASE_STYLE: Record<Phase, {
  labelBg: string; text: string;
  barBg: string; barBorder: string; fillBg: string;
}> = {
  Initiation: {
    labelBg: 'bg-purple-100 text-purple-700',
    text: 'text-purple-700',
    barBg: 'rgba(168,85,247,0.10)',
    barBorder: 'rgba(168,85,247,0.45)',
    fillBg: 'rgba(168,85,247,0.30)',
  },
  Planning: {
    labelBg: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
    barBg: 'rgba(59,130,246,0.10)',
    barBorder: 'rgba(59,130,246,0.45)',
    fillBg: 'rgba(59,130,246,0.30)',
  },
  Execution: {
    labelBg: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
    barBg: 'rgba(245,158,11,0.10)',
    barBorder: 'rgba(245,158,11,0.45)',
    fillBg: 'rgba(245,158,11,0.30)',
  },
  Closing: {
    labelBg: 'bg-green-100 text-green-700',
    text: 'text-green-700',
    barBg: 'rgba(34,197,94,0.10)',
    barBorder: 'rgba(34,197,94,0.45)',
    fillBg: 'rgba(34,197,94,0.30)',
  },
};

const RAG_DOT: Record<string, string> = {
  red: '#ef4444', amber: '#f59e0b', green: '#22c55e',
};

// ─── Quarter helpers ──────────────────────────────────────────────────────────
type Quarter = { label: string; start: Date; end: Date };

function quarterStart(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

function buildRange(minDate: Date, maxDate: Date) {
  // Pad: one quarter before min, one quarter after max
  const rStart = quarterStart(new Date(minDate.getFullYear(), minDate.getMonth() - 3, 1));
  const afterMax = quarterStart(new Date(maxDate.getFullYear(), maxDate.getMonth() + 3, 1));
  const rEnd = new Date(afterMax.getFullYear(), afterMax.getMonth() + 3, 0, 23, 59, 59);

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
const LABEL_W = 200; // px — sticky left column
const BAR_H   = 28;  // px — height of each project bar
const BAR_GAP = 6;   // px — vertical gap between bars

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioRoadmap() {
  const [data, setData]         = useState<PortfolioData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [openSet, setOpenSet]   = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json()).then((d: PortfolioData) => {
      setData(d);
      setOpenSet(new Set([...d.customers.map(c => c.id), 0]));
      setLoading(false);
    });
  }, []);

  // ── Derive time range ───────────────────────────────────────────────────────
  const { qs, rStart, rEnd, totalMs, todayPct } = useMemo(() => {
    const fallback = () => {
      const now = new Date();
      const { qs, rStart, rEnd } = buildRange(
        new Date(now.getFullYear(), now.getMonth() - 3, 1),
        new Date(now.getFullYear(), now.getMonth() + 9, 1),
      );
      const totalMs = rEnd.getTime() - rStart.getTime();
      return { qs, rStart, rEnd, totalMs, todayPct: (Date.now() - rStart.getTime()) / totalMs * 100 };
    };

    if (!data) return fallback();
    const dated = data.projects.filter(p => p.start_date || p.end_date);
    if (!dated.length) return fallback();

    const allDates = dated.flatMap(p => [
      p.start_date ? new Date(p.start_date + 'T00:00:00') : null,
      p.end_date   ? new Date(p.end_date   + 'T23:59:59') : null,
    ]).filter(Boolean) as Date[];

    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const { qs, rStart, rEnd } = buildRange(minDate, maxDate);
    const totalMs = rEnd.getTime() - rStart.getTime();
    const todayPct = Math.max(0, Math.min(100, (Date.now() - rStart.getTime()) / totalMs * 100));
    return { qs, rStart, rEnd, totalMs, todayPct };
  }, [data]);

  function toPct(dateStr: string, endOfDay = false) {
    const ms = new Date(dateStr + (endOfDay ? 'T23:59:59' : 'T00:00:00')).getTime();
    return Math.max(0, Math.min(100, (ms - rStart.getTime()) / totalMs * 100));
  }

  // ── Groups ──────────────────────────────────────────────────────────────────
  const groups = useMemo((): CustomerGroup[] => {
    if (!data) return [];
    return [
      ...data.customers,
      ...(data.noCustomerProjects.length
        ? [{ id: 0, name: 'Unassigned', industry: '', projects: data.noCustomerProjects }]
        : []),
    ];
  }, [data]);

  const MIN_Q_W = 110; // px per quarter minimum

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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ── Page header ── */}
        <div className="shrink-0 px-6 py-4 bg-white border-b flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Map className="h-5 w-5 text-blue-500" />
              Portfolio Roadmap
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Timeline view · {data?.projects.length ?? 0} projects across {groups.length} customer{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            ← Portfolio Dashboard
          </Link>
        </div>

        {/* ── Legend ── */}
        <div className="shrink-0 px-6 py-2 bg-white border-b flex items-center gap-5 text-xs text-slate-500 flex-wrap">
          <span className="font-semibold text-slate-600">Phase colour:</span>
          {PHASES.map(ph => (
            <span key={ph} className={`px-2 py-0.5 rounded font-medium ${PHASE_STYLE[ph].labelBg}`}>{ph}</span>
          ))}
          <span className="mx-2 text-slate-300">|</span>
          <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span>Bar fill = completion %. Coloured dot = RAG status.</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-0.5 h-4 bg-blue-400 rounded" />
            Today
          </span>
        </div>

        {/* ── Roadmap scroll area ── */}
        <div className="flex-1 overflow-auto p-4">
          <div
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
            style={{ minWidth: LABEL_W + qs.length * MIN_Q_W }}
          >

            {/* Quarter header row */}
            <div
              className="flex border-b bg-slate-50"
              style={{ position: 'sticky', top: 0, zIndex: 20 }}
            >
              {/* Corner cell */}
              <div
                className="shrink-0 bg-slate-50 border-r flex items-center px-4"
                style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 30 }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer / Phase</span>
              </div>
              {/* Quarter cells */}
              <div className="flex flex-1">
                {qs.map(q => (
                  <div
                    key={q.label}
                    className="flex-1 border-r last:border-r-0 py-2.5 px-2 text-center"
                    style={{ minWidth: MIN_Q_W }}
                  >
                    <span className="text-xs font-bold text-slate-600">{q.label}</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {q.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {q.end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Empty state */}
            {groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-300">
                <CalendarDays className="h-10 w-10" />
                <p className="text-sm">No projects with dates found.</p>
                <Link href="/projects/new" className="text-sm text-blue-500 hover:underline mt-1">Create a project</Link>
              </div>
            )}

            {/* Customer groups */}
            {groups.map(customer => {
              const isOpen = openSet.has(customer.id);

              const phaseRows = PHASES.map(ph => ({
                phase: ph,
                projects: customer.projects
                  .filter(p => p.current_phase === ph && (p.start_date || p.end_date))
                  .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')),
              })).filter(r => r.projects.length > 0);

              return (
                <div key={customer.id} className="border-b last:border-b-0">

                  {/* Customer header */}
                  <button
                    onClick={() => setOpenSet(prev => {
                      const next = new Set(prev);
                      next.has(customer.id) ? next.delete(customer.id) : next.add(customer.id);
                      return next;
                    })}
                    className="w-full flex items-center border-b bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                  >
                    <div
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50/80"
                      style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                    >
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
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
                          <span key={ph} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${PHASE_STYLE[ph].labelBg}`}>
                            {cnt} {ph}
                          </span>
                        );
                      })}
                    </div>
                  </button>

                  {/* Phase rows (only when expanded) */}
                  {isOpen && phaseRows.map(({ phase, projects }) => {
                    const s = PHASE_STYLE[phase as Phase];
                    const rowsH = projects.length * (BAR_H + BAR_GAP) + BAR_GAP;

                    return (
                      <div key={phase} className="flex border-b last:border-b-0">
                        {/* Phase label */}
                        <div
                          className="shrink-0 flex items-start pt-2 px-4 gap-2 border-r bg-white"
                          style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${s.labelBg}`}>
                            {phase}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1">{projects.length}</span>
                        </div>

                        {/* Bar canvas */}
                        <div
                          className="flex-1 relative"
                          style={{ height: rowsH, minHeight: rowsH }}
                        >
                          {/* Quarter grid lines */}
                          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                            {qs.map(q => (
                              <div
                                key={q.label}
                                className="flex-1 border-r border-slate-100 last:border-r-0"
                                style={{ minWidth: MIN_Q_W }}
                              />
                            ))}
                          </div>

                          {/* Today line */}
                          {todayPct >= 0 && todayPct <= 100 && (
                            <div
                              aria-hidden
                              className="absolute top-0 bottom-0 w-px bg-blue-400 opacity-70 pointer-events-none z-10"
                              style={{ left: `${todayPct}%` }}
                            />
                          )}

                          {/* Project bars */}
                          {projects.map((p, idx) => {
                            const startPct = p.start_date ? toPct(p.start_date) : 0;
                            const endPct   = p.end_date   ? toPct(p.end_date, true) : 100;
                            const widthPct = Math.max(endPct - startPct, 0.4);
                            const top = BAR_GAP + idx * (BAR_H + BAR_GAP);

                            return (
                              <Link key={p.id} href={`/projects/${p.id}`} className="block">
                                <div
                                  className="absolute group cursor-pointer"
                                  style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center
                                               transition-all hover:brightness-95 shadow-sm"
                                    style={{
                                      backgroundColor: s.barBg,
                                      border: `1.5px solid ${s.barBorder}`,
                                    }}
                                    title={`${p.name} · ${p.completion_pct}% complete · ${p.start_date ?? '?'} → ${p.end_date ?? '?'}`}
                                  >
                                    {/* Completion fill */}
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0"
                                      style={{ width: `${p.completion_pct}%`, backgroundColor: s.fillBg }}
                                    />
                                    {/* Labels */}
                                    <div className="relative z-10 flex items-center gap-1.5 px-2 min-w-0 w-full">
                                      <span
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: RAG_DOT[p.rag] }}
                                      />
                                      <span className="text-[11px] font-semibold text-slate-700 truncate flex-1 group-hover:text-blue-700">
                                        {p.name}
                                      </span>
                                      <span className={`text-[10px] font-bold shrink-0 ${s.text}`}>
                                        {p.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Projects without dates — shown as text list */}
                  {isOpen && (() => {
                    const nodates = customer.projects.filter(p => !p.start_date && !p.end_date);
                    if (!nodates.length) return null;
                    return (
                      <div className="flex border-b last:border-b-0 bg-slate-50/40">
                        <div
                          className="shrink-0 flex items-start pt-2 px-4 gap-2 border-r"
                          style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                        >
                          <span className="text-[10px] text-slate-400 mt-1 italic">No dates</span>
                        </div>
                        <div className="flex-1 flex flex-wrap items-center gap-2 px-4 py-2">
                          {nodates.map(p => (
                            <Link key={p.id} href={`/projects/${p.id}`}>
                              <span className="text-[11px] text-slate-500 bg-slate-100 hover:bg-slate-200 rounded px-2 py-0.5 cursor-pointer transition-colors">
                                {p.name}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
