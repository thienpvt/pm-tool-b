'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, ChevronLeft, Building2, Map, CalendarDays, Download, Filter, X, Flag, Layers } from 'lucide-react';
import { toPng } from 'html-to-image';
import { statusPct, weightedProgress } from '@/lib/status-weights';

// ─── Types ────────────────────────────────────────────────────────────────────
type PhaseInfo = {
  phase: string;
  start_date: string | null;
  end_date:   string | null;
  total:      number;
  done:       number;
  completion_pct: number;
  epic_key:   string | null;
};
type ProjectRow = {
  id: number; name: string; pm_name: string;
  customer_id: number | null;
  start_date: string; end_date: string;
  current_phase: string; completion_pct: number;
  rag: 'red' | 'amber' | 'green';
  phases: PhaseInfo[];
};
type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type RoadmapData = { programs: ProgramGroup[]; noProgramProjects: ProjectRow[] };

type EpicChild = {
  id: number; no: string; activity: string; status: string;
  plan_start: string | null; plan_end: string | null; jira_key: string | null;
  weighted_pct: number;
};
type EpicNode = {
  id: number; phase: string; no: string; activity: string; status: string;
  plan_start: string | null; plan_end: string | null; jira_key: string | null;
  child_count: number; weighted_pct: number; children: EpicChild[];
};

type MilestoneRow = {
  id: number; project_id: number; name: string;
  start_date: string | null; end_date: string | null;
  project_name: string; program_name: string | null;
};
type MilestoneItem = {
  id: number; phase: string; no: string; activity: string; status: string;
  completion_pct: number; plan_start: string | null; plan_end: string | null;
  jira_key: string; parent_id: number | null;
};

// Dữ liệu chung cho dialog chi tiết Epic (dùng cả ở phase-mode lẫn milestone-mode)
type EpicDetailData = {
  projectName: string;
  epicActivity: string;
  jira_key: string | null;
  status: string;
  children: { id: number; jira_key: string | null; no: string; activity: string; status: string; plan_start: string | null; plan_end: string | null }[];
};

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

// ─── Epic colours — bảng màu riêng, KHÁC hẳn 4 phase (tím/xanh dương/vàng/xanh lá) ──
// Xoay vòng theo epic.id để các Epic cạnh nhau nhìn khác nhau, dễ phân biệt với phase.
type EpicStyle = { bg: string; fill: string; border: string; textColor: string };
const EPIC_PALETTE: EpicStyle[] = [
  { bg: '#ecfeff', fill: '#22d3ee', border: '#0e7490', textColor: '#155e75' }, // cyan
  { bg: '#fff1f2', fill: '#fb7185', border: '#be123c', textColor: '#9f1239' }, // rose
  { bg: '#f0fdfa', fill: '#2dd4bf', border: '#0f766e', textColor: '#115e59' }, // teal
  { bg: '#fdf4ff', fill: '#e879f9', border: '#a21caf', textColor: '#86198f' }, // fuchsia
  { bg: '#eef2ff', fill: '#818cf8', border: '#4338ca', textColor: '#3730a3' }, // indigo
  { bg: '#fff7ed', fill: '#fb923c', border: '#c2410c', textColor: '#9a3412' }, // orange
];
function epicStyle(id: number): EpicStyle { return EPIC_PALETTE[id % EPIC_PALETTE.length]; }

const STATUS_COLOR: Record<string, string> = {
  'Done': 'bg-green-100 text-green-700', 'Deployed': 'bg-green-100 text-green-700',
  'UAT': 'bg-green-100 text-green-700', 'QC Done': 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700', 'In Review': 'bg-indigo-100 text-indigo-700',
  'In Testing': 'bg-cyan-100 text-cyan-700', 'In Dev': 'bg-amber-100 text-amber-700',
  'To-do': 'bg-slate-100 text-slate-500', 'To Do': 'bg-slate-100 text-slate-500',
  'Blocked': 'bg-red-100 text-red-700', 'New': 'bg-slate-100 text-slate-500',
};
function statusColor(s: string) { return STATUS_COLOR[s] ?? 'bg-slate-100 text-slate-500'; }

// ─── Layout ───────────────────────────────────────────────────────────────────
const LABEL_W = 220;
const BAR_H   = 24;
const BAR_GAP = 5;
const ROW_PAD = 6;
const MIN_M_W = 72; // min width per month column

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Quick-view presets ───────────────────────────────────────────────────────
const QUICK_VIEWS: { label: string; v: [number, number] }[] = [
  { label: 'Full', v: [0, 11] },
  { label: 'Q1',   v: [0, 2]  },
  { label: 'Q2',   v: [3, 5]  },
  { label: 'Q3',   v: [6, 8]  },
  { label: 'Q4',   v: [9, 11] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  if (!day) return d;
  return `${day}/${m}/${y}`;
}

function buildYearTimeline(year: number, startMonth = 0, endMonth = 11) {
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
  const [data, setData]           = useState<RoadmapData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [openSet, setOpenSet]     = useState<Set<number>>(new Set());
  const [selectedYear, setYear]   = useState(() => new Date().getFullYear());
  const [viewMonths, setViewMonths] = useState<[number, number]>([0, 11]);
  const [exporting, setExporting] = useState(false);
  const [filterProgram, setFilterProgram] = useState<number | null>(null);
  const [filterProject, setFilterProject] = useState<number | null>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);

  // View mode: phase-timeline (default) hoặc milestone-list
  const [viewMode, setViewMode] = useState<'phase' | 'milestone'>('phase');

  // Phase-mode: expand phase → xem epic; epic data lazy-load theo project
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [epicsByProject, setEpicsByProject] = useState<Record<number, EpicNode[] | 'loading'>>({});

  // Epic detail dialog (dùng chung)
  const [epicDetail, setEpicDetail] = useState<EpicDetailData | null>(null);

  // Milestone-mode
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [milestoneItems, setMilestoneItems] = useState<MilestoneItem[] | null>(null);
  const [collapsedMsEpics, setCollapsedMsEpics] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/portfolio/roadmap').then(r => r.json()).then((d: RoadmapData) => {
      setData(d);
      setOpenSet(new Set([...d.programs.map((c: ProgramGroup) => c.id), 0]));
      setLoading(false);
    });
  }, []);

  // Load milestone list lần đầu khi chuyển sang milestone mode
  useEffect(() => {
    if (viewMode === 'milestone' && milestones === null) {
      fetch('/api/portfolio/milestones').then(r => r.json()).then((d: MilestoneRow[]) => setMilestones(d));
    }
  }, [viewMode, milestones]);

  const selectedMilestone = useMemo(
    () => milestones?.find(m => m.id === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId]
  );

  // Load epics+children của milestone đã chọn
  useEffect(() => {
    if (!selectedMilestone) { setMilestoneItems(null); return; }
    setMilestoneItems(null);
    setCollapsedMsEpics(new Set());
    fetch(`/api/projects/${selectedMilestone.project_id}/milestones/${selectedMilestone.id}/epics`)
      .then(r => r.json())
      .then((d: MilestoneItem[]) => setMilestoneItems(d));
  }, [selectedMilestone]);

  const loadEpics = useCallback(async (projectId: number) => {
    let already = false;
    setEpicsByProject(prev => {
      if (prev[projectId]) { already = true; return prev; }
      return { ...prev, [projectId]: 'loading' };
    });
    if (already) return;
    const d = await fetch(`/api/portfolio/roadmap/epics?project_id=${projectId}`).then(r => r.json());
    setEpicsByProject(prev => ({ ...prev, [projectId]: (d.epics ?? []) as EpicNode[] }));
  }, []);

  const togglePhaseExpand = useCallback((projectId: number, phase: string) => {
    const key = `${projectId}:${phase}`;
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    loadEpics(projectId);
  }, [loadEpics]);

  // Available years
  const availableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    let minY = cur - 1;
    let maxY = cur + 2;

    if (data) {
      const all = [...data.programs.flatMap((c: ProgramGroup) => c.projects), ...data.noProgramProjects];
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

  const tl = useMemo(() => buildYearTimeline(selectedYear, viewMonths[0], viewMonths[1]), [selectedYear, viewMonths]);

  // Convert date string → unclamped % within selected year
  const rawPct = useCallback((dateStr: string, eod = false) => {
    const ms = new Date(dateStr + (eod ? 'T23:59:59' : 'T00:00:00')).getTime();
    return (ms - tl.rStart.getTime()) / tl.totalMs * 100;
  }, [tl]);

  const availableProjects = useMemo((): ProjectRow[] => {
    if (!data) return [];
    if (filterProgram === null) {
      return [
        ...data.programs.flatMap((p: ProgramGroup) => p.projects),
        ...data.noProgramProjects,
      ].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (filterProgram === 0) {
      return [...data.noProgramProjects].sort((a, b) => a.name.localeCompare(b.name));
    }
    const prog = data.programs.find((p: ProgramGroup) => p.id === filterProgram);
    return (prog?.projects ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filterProgram]);

  const groups = useMemo((): ProgramGroup[] => {
    if (!data) return [];
    const yearFilter = (ps: ProjectRow[]) =>
      ps.filter(p => filterProject === p.id ? true : projectInYear(p, selectedYear));

    let result: ProgramGroup[] = [
      ...data.programs
        .map((c: ProgramGroup) => ({ ...c, projects: yearFilter(c.projects) }))
        .filter((c: ProgramGroup) => c.projects.length > 0),
      ...((() => {
        const ps = yearFilter(data.noProgramProjects);
        return ps.length ? [{ id: 0, name: 'Unassigned', industry: '', projects: ps }] : [];
      })()),
    ];

    if (filterProgram !== null) {
      result = result.filter(g => g.id === filterProgram);
    }
    if (filterProject !== null) {
      result = result
        .map(g => ({ ...g, projects: g.projects.filter((p: ProjectRow) => p.id === filterProject) }))
        .filter(g => g.projects.length > 0);
    }

    return result;
  }, [data, selectedYear, filterProgram, filterProject]);

  const setYearAndReset = useCallback((y: number) => {
    setYear(y);
    setViewMonths([0, 11]);
  }, []);

  const toggleProgram = useCallback((id: number) => {
    setOpenSet((prev: Set<number>) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleExportPng = useCallback(async () => {
    if (!roadmapRef.current) return;
    setExporting(true);
    try {
      const el = roadmapRef.current;
      const dataUrl = await toPng(el, {
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: { overflow: 'visible' },
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.download = `portfolio-roadmap-${selectedYear}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('PNG export failed', err);
    } finally {
      setExporting(false);
    }
  }, [selectedYear]);

  // ── Milestone computed (weighted-by-status) ────────────────────────────────
  const ms = useMemo(() => {
    if (!milestoneItems) return null;
    const inIds = new Set(milestoneItems.map(i => i.id));
    const childrenByParent: Record<number, MilestoneItem[]> = {};
    for (const it of milestoneItems) {
      if (it.parent_id && inIds.has(it.parent_id)) {
        (childrenByParent[it.parent_id] = childrenByParent[it.parent_id] ?? []).push(it);
      }
    }
    const leaves = milestoneItems.filter(i => i.no !== 'EPIC');
    const overallPct = weightedProgress(leaves.map(i => i.status));
    const topLevel = milestoneItems.filter(i => !i.parent_id || !inIds.has(i.parent_id));
    const byPhase: Record<string, MilestoneItem[]> = {};
    for (const it of topLevel) (byPhase[it.phase] = byPhase[it.phase] ?? []).push(it);
    const itemPct = (it: MilestoneItem): number => {
      if (it.no === 'EPIC') {
        const kids = childrenByParent[it.id] ?? [];
        return kids.length > 0 ? weightedProgress(kids.map(k => k.status)) : statusPct(it.status);
      }
      return statusPct(it.status);
    };
    return { childrenByParent, overallPct, byPhase, itemPct, count: milestoneItems.length };
  }, [milestoneItems]);

  const toggleMsEpic = useCallback((epicId: number) => {
    setCollapsedMsEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
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
              {viewMode === 'phase'
                ? <>{totalProjects} project{totalProjects !== 1 ? 's' : ''} · phase bars from activity dates</>
                : <>Xem theo milestone · tiến độ weighted theo trạng thái</>}
            </p>
          </div>

          {/* View-mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('phase')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === 'phase' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Map className="h-3.5 w-3.5" /> Theo Phase
            </button>
            <button
              onClick={() => setViewMode('milestone')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                viewMode === 'milestone' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Flag className="h-3.5 w-3.5" /> Theo Milestone
            </button>
          </div>

          {/* Year selector (phase mode only) */}
          {viewMode === 'phase' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => curYearIdx > 0 && setYearAndReset(availableYears[curYearIdx - 1])}
                disabled={curYearIdx <= 0}
                className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-500" />
              </button>
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {availableYears.map(y => (
                  <button
                    key={y}
                    onClick={() => setYearAndReset(y)}
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
                onClick={() => curYearIdx < availableYears.length - 1 && setYearAndReset(availableYears[curYearIdx + 1])}
                disabled={curYearIdx >= availableYears.length - 1}
                className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {viewMode === 'phase' && (
              <button
                onClick={handleExportPng}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? 'Exporting…' : 'Export PNG'}
              </button>
            )}
            <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
          </div>
        </div>

        {/* ════════════════════ PHASE MODE ════════════════════ */}
        {viewMode === 'phase' && (
        <>
        {/* ── View range controls ── */}
        <div className="shrink-0 px-6 py-2 bg-slate-50 border-b flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">View:</span>

          {/* Quick presets */}
          <div className="flex items-center gap-1">
            {QUICK_VIEWS.map(opt => {
              const active = viewMonths[0] === opt.v[0] && viewMonths[1] === opt.v[1];
              return (
                <button
                  key={opt.label}
                  onClick={() => setViewMonths(opt.v)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <span className="text-slate-300">|</span>

          {/* Custom month range */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 shrink-0">From</span>
            <select
              value={viewMonths[0]}
              onChange={e => {
                const s = +e.target.value;
                setViewMonths([s, Math.max(s, viewMonths[1])]);
              }}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <span className="text-slate-400 text-xs">→</span>
            <select
              value={viewMonths[1]}
              onChange={e => {
                const e2 = +e.target.value;
                setViewMonths([Math.min(viewMonths[0], e2), e2]);
              }}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>

          <span className="text-[11px] text-slate-400 ml-1">
            {tl.months.length} month{tl.months.length !== 1 ? 's' : ''} shown
          </span>

          <span className="text-slate-300">|</span>

          {/* Program / Project filter */}
          <Filter className="h-3 w-3 text-slate-400 shrink-0" />
          <select
            value={filterProgram ?? ''}
            onChange={e => {
              const val = e.target.value === '' ? null : +e.target.value;
              setFilterProgram(val);
              setFilterProject(null);
            }}
            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Tất cả Program</option>
            {data?.programs.map((p: ProgramGroup) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {data?.noProgramProjects.length ? <option value={0}>Unassigned</option> : null}
          </select>

          <select
            value={filterProject ?? ''}
            onChange={e => setFilterProject(e.target.value === '' ? null : +e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Tất cả Project</option>
            {availableProjects.map((p: ProjectRow) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {(filterProgram !== null || filterProject !== null) && (
            <button
              onClick={() => { setFilterProgram(null); setFilterProject(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <X className="h-3 w-3" />
              Xóa filter
            </button>
          )}
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
            <span className="flex items-center gap-0.5">
              {EPIC_PALETTE.slice(0, 4).map((e, i) => (
                <span key={i} className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: e.fill, border: `1px solid ${e.border}` }} />
              ))}
            </span>
            <Layers className="h-3 w-3" /> Epic (màu riêng) — bấm phase để mở/đóng
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="inline-block w-0.5 h-4 bg-blue-400 rounded" />Today
          </span>
        </div>

        {/* ── Roadmap ── */}
        <div className="flex-1 overflow-auto p-4">
          <div
            ref={roadmapRef}
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
            style={{ minWidth: LABEL_W + tl.months.length * MIN_M_W }}
          >

            {/* Month header */}
            <div className="flex border-b bg-slate-50" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
              <div
                className="shrink-0 bg-slate-50 border-r flex items-end px-4 pb-2 pt-3"
                style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 30 }}
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program / Project</span>
              </div>
              <div className="flex flex-1">
                {tl.months.map((m: { label: string; quarter: string; start: Date; end: Date }, idx: number) => (
                  <div
                    key={m.label}
                    className={`flex-1 border-r last:border-r-0 py-2 px-1 text-center ${idx % 3 === 0 ? 'bg-slate-100/60' : ''}`}
                    style={{ minWidth: MIN_M_W }}
                  >
                    <p className="text-xs font-bold text-slate-600">{m.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{m.quarter}</p>
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

            {/* Program groups */}
            {groups.map(program => {
              const isOpen = openSet.has(program.id);
              return (
                <div key={program.id} className="border-b last:border-b-0">

                  {/* Program header */}
                  <button
                    onClick={() => toggleProgram(program.id)}
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
                      <span className="text-xs font-bold text-slate-700 truncate">{program.name}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-3 px-4 py-2.5 text-xs text-slate-400 flex-wrap">
                      <span>{program.projects.length} project{program.projects.length !== 1 ? 's' : ''}</span>
                      {PHASES.map(ph => {
                        const cnt = program.projects.filter(p => p.current_phase === ph).length;
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
                  {isOpen && program.projects.map((project, pIdx) => {
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

                    const projEpics = epicsByProject[project.id];

                    // Build render lines: phase bar, then (if expanded) its epic bars
                    type Line =
                      | { kind: 'phase'; ph: PhaseInfo }
                      | { kind: 'epic'; ph: PhaseInfo; epic: EpicNode };
                    const lines: Line[] = [];
                    for (const ph of barsToShow) {
                      lines.push({ kind: 'phase', ph });
                      const expanded = expandedPhases.has(`${project.id}:${ph.phase}`);
                      if (expanded && Array.isArray(projEpics)) {
                        for (const epic of projEpics.filter(e => e.phase === ph.phase)) {
                          lines.push({ kind: 'epic', ph, epic });
                        }
                      }
                    }

                    const numBars = lines.length + (showFallback ? 1 : 0);
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
                          {/* Month grid lines */}
                          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                            {tl.months.map((m: { label: string; quarter: string }, idx: number) => (
                              <div
                                key={m.label}
                                className={`flex-1 border-r last:border-r-0 ${idx % 3 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                                style={{ minWidth: MIN_M_W }}
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

                          {/* Lines: phase bars + expanded epic bars */}
                          {lines.map((line, lineIdx) => {
                            const top = ROW_PAD + lineIdx * (BAR_H + BAR_GAP);

                            if (line.kind === 'phase') {
                              const ph = line.ph;
                              const s = PS[ph.phase] ?? PS['Execution'];
                              const r0 = ph.start_date ? rawPct(ph.start_date) : 0;
                              const r1 = ph.end_date   ? rawPct(ph.end_date, true) : 100;
                              const startPct = Math.max(0, r0);
                              const endPct   = Math.min(100, r1);
                              const widthPct = Math.max(endPct - startPct, 0.4);
                              const expanded = expandedPhases.has(`${project.id}:${ph.phase}`);

                              return (
                                <button
                                  key={`ph-${ph.phase}`}
                                  type="button"
                                  onClick={() => togglePhaseExpand(project.id, ph.phase)}
                                  className="absolute group text-left"
                                  style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                  title={`${ph.phase}: ${ph.done}/${ph.total} done · ${ph.completion_pct}% — bấm để xem Epic`}
                                >
                                  <div
                                    className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                                  >
                                    <div
                                      aria-hidden
                                      className="absolute inset-y-0 left-0"
                                      style={{ width: `${ph.completion_pct}%`, backgroundColor: s.fill }}
                                    />
                                    <div
                                      className="relative z-10 flex items-center gap-1 px-1.5 min-w-0 w-full"
                                      style={{ color: s.textColor }}
                                    >
                                      {expanded
                                        ? <ChevronDown className="h-3 w-3 shrink-0" />
                                        : <ChevronRight className="h-3 w-3 shrink-0" />}
                                      {ph.epic_key && (
                                        <span
                                          className="text-[9px] font-mono font-bold shrink-0 px-1 py-px rounded"
                                          style={{ backgroundColor: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}
                                        >
                                          {ph.epic_key}
                                        </span>
                                      )}
                                      <span className="text-[10px] font-semibold truncate flex-1">
                                        {ph.phase}
                                      </span>
                                      <span className="text-[10px] shrink-0 opacity-80 ml-0.5">
                                        {ph.done}/{ph.total}
                                      </span>
                                      <span className="text-[10px] font-bold shrink-0 ml-0.5">
                                        {ph.completion_pct}%
                                      </span>
                                    </div>
                                  </div>
                                </button>
                              );
                            }

                            // Epic line — dùng bảng màu riêng (khác phase)
                            const { epic, ph } = line;
                            const es = epicStyle(epic.id);
                            const e0 = epic.plan_start ? rawPct(epic.plan_start)
                              : ph.start_date ? rawPct(ph.start_date) : 0;
                            const e1 = epic.plan_end ? rawPct(epic.plan_end, true)
                              : ph.end_date ? rawPct(ph.end_date, true) : 100;
                            const startPct = Math.max(0, Math.min(100, e0));
                            const endPct   = Math.max(0, Math.min(100, e1));
                            const widthPct = Math.max(endPct - startPct, 0.4);

                            return (
                              <button
                                key={`ep-${epic.id}`}
                                type="button"
                                onClick={() => setEpicDetail({
                                  projectName: project.name,
                                  epicActivity: epic.activity,
                                  jira_key: epic.jira_key,
                                  status: epic.status,
                                  children: epic.children.map(c => ({
                                    id: c.id, jira_key: c.jira_key, no: c.no, activity: c.activity,
                                    status: c.status, plan_start: c.plan_start, plan_end: c.plan_end,
                                  })),
                                })}
                                className="absolute group text-left"
                                style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                title={`Epic: ${epic.activity} · ${epic.weighted_pct}% (${epic.child_count} child) — bấm xem chi tiết`}
                              >
                                <div
                                  className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: es.bg, border: `1.5px solid ${es.border}`, borderLeftWidth: 4 }}
                                >
                                  <div
                                    aria-hidden
                                    className="absolute inset-y-0 left-0 opacity-65"
                                    style={{ width: `${epic.weighted_pct}%`, backgroundColor: es.fill }}
                                  />
                                  <div className="relative z-10 flex items-center gap-1 px-1.5 min-w-0 w-full" style={{ color: es.textColor }}>
                                    <Layers className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                    {epic.jira_key && (
                                      <span className="text-[9px] font-mono font-bold shrink-0 px-1 py-px rounded" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                                        {epic.jira_key}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-medium truncate flex-1">{epic.activity}</span>
                                    <span className="text-[10px] font-bold shrink-0 ml-0.5">{epic.weighted_pct}%</span>
                                  </div>
                                </div>
                              </button>
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
                                      className="relative z-10 flex items-center gap-1 px-2 min-w-0 w-full"
                                      style={{ color: s.textColor }}
                                    >
                                      <span className="text-[10px] font-semibold truncate flex-1">
                                        {project.current_phase}
                                      </span>
                                      <span className="text-[10px] font-bold shrink-0 ml-0.5">
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
        </>
        )}

        {/* ════════════════════ MILESTONE MODE ════════════════════ */}
        {viewMode === 'milestone' && (
        <>
          {/* Milestone selector */}
          <div className="shrink-0 px-6 py-2.5 bg-slate-50 border-b flex items-center gap-3 flex-wrap">
            <Flag className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Milestone:</span>
            <select
              value={selectedMilestoneId ?? ''}
              onChange={e => setSelectedMilestoneId(e.target.value === '' ? null : +e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 min-w-[280px]"
            >
              <option value="">— Chọn milestone —</option>
              {(() => {
                if (!milestones) return null;
                const byProject: Record<string, MilestoneRow[]> = {};
                for (const m of milestones) (byProject[m.project_name] = byProject[m.project_name] ?? []).push(m);
                return Object.entries(byProject).map(([proj, list]) => (
                  <optgroup key={proj} label={proj}>
                    {list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </optgroup>
                ));
              })()}
            </select>
            {milestones && milestones.length === 0 && (
              <span className="text-xs text-slate-400">Chưa có milestone nào. Tạo milestone trong từng project.</span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-6">
            {!selectedMilestone ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                <Flag className="h-12 w-12 text-slate-200" />
                <p className="text-sm">Chọn một milestone để xem Epic, child và tiến độ.</p>
              </div>
            ) : !ms ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="max-w-5xl mx-auto">
                {/* Milestone header */}
                <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Flag className="h-5 w-5 text-orange-500 shrink-0" />
                        {selectedMilestone.name}
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        <Link href={`/projects/${selectedMilestone.project_id}/milestones`} className="text-blue-600 hover:underline">
                          {selectedMilestone.project_name}
                        </Link>
                        {selectedMilestone.program_name && <span className="text-slate-400"> · {selectedMilestone.program_name}</span>}
                        <span className="mx-2 text-slate-300">|</span>
                        {fmt(selectedMilestone.start_date)} → {fmt(selectedMilestone.end_date)}
                        <span className="ml-2 text-orange-600 font-medium">{ms.count} item</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${ms.overallPct}%` }} />
                      </div>
                      <span className="text-lg font-bold text-orange-600 tabular-nums shrink-0">{ms.overallPct}%</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Tiến độ tổng = weighted theo trạng thái (EPIC không tính vào leaf).</p>
                </div>

                {ms.count === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-400">
                    <p className="text-sm">Milestone này chưa có item nào.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(ms.byPhase).map(([phase, parents]) => (
                      <div key={phase}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{phase}</p>
                        <div className="space-y-2">
                          {parents.map(parent => {
                            const kids = ms.childrenByParent[parent.id] ?? [];
                            const isEpic = parent.no === 'EPIC';
                            const collapsed = collapsedMsEpics.has(parent.id);
                            const pct = ms.itemPct(parent);
                            return (
                              <div key={parent.id}>
                                <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors ${
                                  isEpic ? 'bg-orange-50/50 border-orange-200 hover:border-orange-300' : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  {isEpic && kids.length > 0 && (
                                    <button
                                      onClick={() => toggleMsEpic(parent.id)}
                                      className="p-0.5 rounded text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                    >
                                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </button>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isEpic && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>}
                                      {parent.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{parent.jira_key}</span>}
                                      {parent.no && parent.no !== 'EPIC' && <span className="text-xs text-slate-400">#{parent.no}</span>}
                                      <span className="text-sm font-medium text-slate-800 truncate">{parent.activity}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                      <Badge className={`text-xs px-1.5 py-0 ${statusColor(parent.status)}`}>{parent.status}</Badge>
                                      <span className="text-xs text-slate-400">{pct}%</span>
                                      {(parent.plan_start || parent.plan_end) && (
                                        <span className="text-xs text-slate-400">{fmt(parent.plan_start)} → {fmt(parent.plan_end)}</span>
                                      )}
                                      {kids.length > 0 && <span className="text-xs text-orange-500">{kids.length} sub-item</span>}
                                    </div>
                                  </div>
                                  <div className="w-20 shrink-0">
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                  {isEpic && (
                                    <button
                                      onClick={() => setEpicDetail({
                                        projectName: selectedMilestone.project_name,
                                        epicActivity: parent.activity,
                                        jira_key: parent.jira_key || null,
                                        status: parent.status,
                                        children: kids.map(c => ({
                                          id: c.id, jira_key: c.jira_key || null, no: c.no, activity: c.activity,
                                          status: c.status, plan_start: c.plan_start, plan_end: c.plan_end,
                                        })),
                                      })}
                                      className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline shrink-0"
                                    >
                                      Chi tiết
                                    </button>
                                  )}
                                </div>

                                {kids.length > 0 && !collapsed && (
                                  <div className="ml-5 mt-1.5 space-y-1.5 pl-4 border-l-2 border-orange-100">
                                    {kids.map(child => (
                                      <div key={child.id} className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {child.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{child.jira_key}</span>}
                                            {child.no && child.no !== 'EPIC' && <span className="text-xs text-slate-400">{child.no}</span>}
                                            <span className="text-sm text-slate-700 truncate">{child.activity}</span>
                                          </div>
                                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <Badge className={`text-xs px-1.5 py-0 ${statusColor(child.status)}`}>{child.status}</Badge>
                                            <span className="text-xs text-slate-400">{statusPct(child.status)}%</span>
                                            {(child.plan_start || child.plan_end) && (
                                              <span className="text-xs text-slate-400">{fmt(child.plan_start)} → {fmt(child.plan_end)}</span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="w-16 shrink-0">
                                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-300 rounded-full" style={{ width: `${statusPct(child.status)}%` }} />
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
        )}
      </main>

      {/* ── Epic detail dialog ── */}
      <Dialog open={!!epicDetail} onOpenChange={open => { if (!open) setEpicDetail(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
          {epicDetail && (() => {
            const childTotal = weightedProgress(epicDetail.children.map(c => c.status));
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
                    <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                    {epicDetail.jira_key && (
                      <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{epicDetail.jira_key}</span>
                    )}
                    <span className="text-base font-bold text-slate-800">{epicDetail.epicActivity}</span>
                  </DialogTitle>
                </DialogHeader>

                <p className="text-xs text-slate-500 -mt-1">
                  {epicDetail.projectName}
                  <span className="mx-2 text-slate-300">|</span>
                  <Badge className={`text-xs px-1.5 py-0 ${statusColor(epicDetail.status)}`}>{epicDetail.status}</Badge>
                </p>

                {/* Tổng tiến độ các child (weighted) */}
                <div className="bg-slate-50 rounded-lg border p-3 flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-600 shrink-0">Tiến độ tổng ({epicDetail.children.length} child)</span>
                  <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${childTotal}%` }} />
                  </div>
                  <span className="text-lg font-bold text-orange-600 tabular-nums shrink-0">{childTotal}%</span>
                </div>
                <p className="text-[11px] text-slate-400 -mt-1">Tính theo tỷ trọng (weighted) trạng thái của toàn bộ child.</p>

                {/* Bảng child */}
                <div className="overflow-auto flex-1 -mx-1 px-1">
                  {epicDetail.children.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8">Epic này chưa có child nào.</p>
                  ) : (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b">
                          <th className="py-2 px-2">Key / No</th>
                          <th className="py-2 px-2">Activity</th>
                          <th className="py-2 px-2">Trạng thái</th>
                          <th className="py-2 px-2 text-right">%</th>
                          <th className="py-2 px-2">Bắt đầu</th>
                          <th className="py-2 px-2">Kết thúc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {epicDetail.children.map(c => (
                          <tr key={c.id} className="border-b last:border-b-0 hover:bg-slate-50">
                            <td className="py-2 px-2 whitespace-nowrap">
                              {c.jira_key
                                ? <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{c.jira_key}</span>
                                : <span className="text-xs text-slate-400">{c.no || '—'}</span>}
                            </td>
                            <td className="py-2 px-2 text-slate-700">{c.activity}</td>
                            <td className="py-2 px-2"><Badge className={`text-xs px-1.5 py-0 ${statusColor(c.status)}`}>{c.status}</Badge></td>
                            <td className="py-2 px-2 text-right tabular-nums text-slate-600">{statusPct(c.status)}%</td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{fmt(c.plan_start)}</td>
                            <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{fmt(c.plan_end)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
