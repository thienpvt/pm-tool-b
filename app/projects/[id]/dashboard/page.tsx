'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CheckCircle2, Clock, AlertTriangle, Users, TrendingUp,
  TrendingDown, Minus, ChevronLeft, ChevronRight, Flame,
  CalendarClock, ShieldAlert, Bug, Target, Pencil,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: number; name: string; client: string; pm_name: string; pm_email: string;
  start_date: string; end_date: string; status: string; current_phase: string;
  description: string;
};

type Activity = {
  id: number; phase: string; no: string; activity: string; deliverable: string;
  accountable: string; plan_start: string; plan_end: string;
  actual_start: string; actual_end: string;
  status: string; completion_pct: number; delay_owner: string;
};

type TeamMember = { id: number; domain: string; role: string; name: string; };
type Risk   = { id: number; risk_id: string; description: string; category: string; owner: string; status: string; due_date: string; };
type Issue  = { id: number; issue_id: string; description: string; category: string; owner: string; status: string; due_date: string; };

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER = ['Initializing','Architecture & Design','Setup & Infra','Development','Testing','UAT','Deployment','Closing'];

const STATUS_COLOR: Record<string, string> = {
  'Done':        '#22c55e',
  'In Progress': '#3b82f6',
  'To-do':       '#94a3b8',
  'Blocked':     '#ef4444',
};
const STATUS_BADGE: Record<string, string> = {
  'Done':        'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100  text-blue-700',
  'To-do':       'bg-slate-100 text-slate-600',
  'Blocked':     'bg-red-100   text-red-700',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today0(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }

function daysFromNow(dateStr: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today0().getTime()) / 86400000);
}

function isOverdue(act: Activity): boolean {
  return act.status !== 'Done' && !!act.plan_end && daysFromNow(act.plan_end) < 0;
}

function isDueThisWeek(act: Activity): boolean {
  const d = daysFromNow(act.plan_end);
  return act.status !== 'Done' && !!act.plan_end && d >= 0 && d <= 7;
}

function isCompletedThisWeek(act: Activity): boolean {
  if (act.status !== 'Done' || !act.actual_end) return false;
  return daysFromNow(act.actual_end) >= -7 && daysFromNow(act.actual_end) <= 0;
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a); const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function fmt(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function polarXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function slicePath(cx: number, cy: number, R: number, ir: number, a1: number, a2: number): string {
  const span = a2 - a1;
  if (span >= 359.99) {
    return [
      `M ${cx} ${cy - R}`,
      `A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}`,
      `L ${cx - 0.01} ${cy - ir}`,
      `A ${ir} ${ir} 0 1 0 ${cx} ${cy - ir}`,
      'Z',
    ].join(' ');
  }
  const [x1, y1] = polarXY(cx, cy, R, a1);
  const [x2, y2] = polarXY(cx, cy, R, a2);
  const [x3, y3] = polarXY(cx, cy, ir, a2);
  const [x4, y4] = polarXY(cx, cy, ir, a1);
  const large = span > 180 ? 1 : 0;
  return `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${ir},${ir},0,${large},0,${x4},${y4} Z`;
}

function DonutChart({ slices, size = 130, center }: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  center?: string;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2;
  const R = size * 0.4, ir = size * 0.26;

  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth={R - ir} />
      <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={size * 0.1} fill="#94a3b8">No data</text>
    </svg>
  );

  let angle = 0;
  return (
    <svg width={size} height={size}>
      {slices.filter(s => s.value > 0).map((s, i) => {
        const sweep = (s.value / total) * 360;
        const d = slicePath(cx, cy, R, ir, angle, angle + sweep);
        angle += sweep;
        return <path key={i} d={d} fill={s.color} />;
      })}
      {center && (
        <>
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.16} fontWeight="700" fill="#0f172a">{center}</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fontSize={size * 0.09} fill="#64748b">total</text>
        </>
      )}
    </svg>
  );
}

// ─── Paginated Table ──────────────────────────────────────────────────────────

function Pager({ page, total, pageSize, onChange }: {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
      <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(Math.max(0, page - 1))} disabled={page === 0}
          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-1 self-center">{page + 1}/{pages}</span>
        <button onClick={() => onChange(Math.min(pages - 1, page + 1))} disabled={page === pages - 1}
          className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent, danger, warning }: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean; danger?: boolean; warning?: boolean;
}) {
  const base = danger ? 'border-red-200 bg-red-50/40'
    : warning ? 'border-amber-200 bg-amber-50/40'
    : accent ? 'border-blue-200 bg-blue-50/20' : '';
  const valColor = danger ? 'text-red-700' : warning ? 'text-amber-700' : accent ? 'text-blue-700' : 'text-slate-800';
  const iconColor = danger ? 'text-red-400' : warning ? 'text-amber-400' : accent ? 'text-blue-400' : 'text-slate-300';
  return (
    <div className={`rounded-xl border p-4 bg-white ${base}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <p className={`text-2xl font-bold ${valColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── SPI Badge ────────────────────────────────────────────────────────────────

function SpiBadge({ spi }: { spi: number | null }) {
  if (spi === null) return null;
  const { label, cls, Icon } = spi >= 1
    ? { label: `SPI ${spi.toFixed(2)} — Ahead`, cls: 'bg-green-100 text-green-700 border-green-200', Icon: TrendingUp }
    : spi >= 0.8
    ? { label: `SPI ${spi.toFixed(2)} — On track`, cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Minus }
    : { label: `SPI ${spi.toFixed(2)} — Behind`, cls: 'bg-red-100 text-red-700 border-red-200', Icon: TrendingDown };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

// ─── Phase Progress Bars ──────────────────────────────────────────────────────

function PhaseStatus({ acts }: { acts: Activity[] }) {
  const done = acts.filter(a => a.status === 'Done').length;
  const inProg = acts.filter(a => a.status === 'In Progress').length;
  const blocked = acts.filter(a => a.status === 'Blocked').length;
  const pct = acts.length ? Math.round(acts.reduce((s, a) => s + (a.completion_pct || 0), 0) / acts.length) : 0;
  const label = done === acts.length ? 'Done' : blocked > 0 ? 'Blocked' : inProg > 0 ? 'In Progress' : 'Not Started';
  const lCls = done === acts.length ? 'text-green-600' : blocked > 0 ? 'text-red-600' : inProg > 0 ? 'text-blue-600' : 'text-slate-400';
  const barCls = done === acts.length ? 'bg-green-500' : blocked > 0 ? 'bg-red-500' : inProg > 0 ? 'bg-blue-500' : 'bg-slate-200';
  return { pct, label, lCls, barCls, done, inProg, blocked, total: acts.length };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject]       = useState<Project | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [team, setTeam]             = useState<TeamMember[]>([]);
  const [risks, setRisks]           = useState<Risk[]>([]);
  const [issues, setIssues]         = useState<Issue[]>([]);

  // Paging state
  const [overdueP, setOverdueP] = useState(0);
  const [dueWeekP, setDueWeekP] = useState(0);

  // Edit project dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    const [proj, acts, tm, rs, iss] = await Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/activities`).then(r => r.json()),
      fetch(`/api/projects/${id}/team`).then(r => r.json()),
      fetch(`/api/projects/${id}/risks`).then(r => r.json()),
      fetch(`/api/projects/${id}/issues`).then(r => r.json()),
    ]);
    setProject(proj);
    setActivities(Array.isArray(acts) ? acts : []);
    setTeam(Array.isArray(tm) ? tm : []);
    setRisks(Array.isArray(rs) ? rs : []);
    setIssues(Array.isArray(iss) ? iss : []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    if (!project) return;
    setEditForm({
      name: project.name, client: project.client, description: project.description,
      pm_name: project.pm_name, pm_email: project.pm_email,
      start_date: project.start_date, end_date: project.end_date,
      current_phase: project.current_phase,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const updated = await res.json();
      setProject(updated);
      setEditOpen(false);
      toast.success('Project info updated');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  if (!project) return (
    <div className="flex min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-8"><p className="text-slate-400">Loading...</p></main>
    </div>
  );

  // ── Derived metrics ───────────────────────────────────────────────────────

  const total     = activities.length;
  const done      = activities.filter(a => a.status === 'Done').length;
  const inProg    = activities.filter(a => a.status === 'In Progress').length;
  const blocked   = activities.filter(a => a.status === 'Blocked').length;
  const todo      = activities.filter(a => a.status === 'To-do').length;
  const avgPct    = total ? Math.round(activities.reduce((s, a) => s + (a.completion_pct || 0), 0) / total) : 0;

  const openRisks  = risks.filter(r => r.status === 'Open' || r.status === 'In Progress');
  const openIssues = issues.filter(i => i.status === 'Open' || i.status === 'In Progress');

  // SPI
  let spi: number | null = null;
  if (project.start_date && project.end_date) {
    const dTotal   = dateDiffDays(project.start_date, project.end_date);
    const dElapsed = dateDiffDays(project.start_date, new Date().toISOString().slice(0, 10));
    const timePct  = dTotal > 0 ? Math.max(0, Math.min(dElapsed / dTotal, 1)) * 100 : 0;
    if (timePct > 0) spi = Math.round((avgPct / timePct) * 100) / 100;
  }

  const daysLeft = project.end_date ? daysFromNow(project.end_date) : null;

  // On-time rate
  const withPlanEnd = activities.filter(a => a.plan_end);
  const onTime = withPlanEnd.filter(a => {
    if (a.status === 'Done') return !a.actual_end || daysFromNow(a.plan_end) >= daysFromNow(a.actual_end);
    return daysFromNow(a.plan_end) >= 0;
  }).length;
  const onTimePct = withPlanEnd.length ? Math.round((onTime / withPlanEnd.length) * 100) : 100;

  // Phase breakdown
  const phasesInData  = [...new Set(activities.map(a => a.phase))];
  const orderedPhases = [...PHASE_ORDER.filter(p => phasesInData.includes(p)), ...phasesInData.filter(p => !PHASE_ORDER.includes(p))];

  // PM from resource plan (domain='PM' or role contains 'PM'/'Project Manager')
  const pmMembers = team.filter(m =>
    m.domain === 'PM' ||
    m.role?.toLowerCase() === 'pm' ||
    m.role?.toLowerCase().includes('project manager')
  );
  const pmDisplay = pmMembers.length > 0
    ? pmMembers.map(m => m.name).join(', ')
    : (project.pm_name || null);

  // Headcount by domain
  const domainCount: Record<string, number> = {};
  for (const m of team) domainCount[m.domain] = (domainCount[m.domain] ?? 0) + 1;
  const domainEntries = Object.entries(domainCount).sort((a, b) => b[1] - a[1]);
  const maxDomain = Math.max(1, ...domainEntries.map(([, c]) => c));

  // Overdue & due this week
  const overdue  = activities.filter(isOverdue).sort((a, b) => daysFromNow(a.plan_end) - daysFromNow(b.plan_end));
  const dueWeek  = activities.filter(isDueThisWeek).sort((a, b) => daysFromNow(a.plan_end) - daysFromNow(b.plan_end));
  const completedThisWeek = activities.filter(isCompletedThisWeek);

  // Upcoming deliverables (next 30d, not done, has a deliverable)
  const upcoming = activities
    .filter(a => a.status !== 'Done' && a.deliverable && a.plan_end && daysFromNow(a.plan_end) >= 0 && daysFromNow(a.plan_end) <= 30)
    .sort((a, b) => daysFromNow(a.plan_end) - daysFromNow(b.plan_end))
    .slice(0, 5);

  const PAGE = 10;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 p-6 overflow-x-auto space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-800">{project.name}</h1>
              {project.client && <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">{project.client}</Badge>}
              <Badge className="bg-blue-100 text-blue-700 text-xs">{project.current_phase}</Badge>
              <SpiBadge spi={spi} />
            </div>
            <div className="flex items-center gap-1 mt-1 flex-wrap text-xs text-slate-400">
              <span>PM:</span>
              {pmDisplay ? (
                <Link href={`/projects/${id}/resources`} className="text-slate-700 font-medium hover:text-blue-600 transition-colors">
                  {pmDisplay}
                </Link>
              ) : (
                <Link href={`/projects/${id}/resources`} className="text-amber-600 hover:underline font-medium">
                  (not set — add in Resource Plan)
                </Link>
              )}
              {project.pm_email && <span className="text-slate-400">· {project.pm_email}</span>}
              {project.start_date && <span>· {project.start_date} → {project.end_date || '?'}</span>}
              {daysLeft !== null && (
                <span className={`font-medium ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 14 ? 'text-amber-600' : 'text-slate-500'}`}>
                  · {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5 h-8 text-xs">
              <Pencil className="h-3 w-3" /> Edit Info
            </Button>
            <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline whitespace-nowrap">
              Open Timeline →
            </Link>
          </div>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Overall Progress" value={`${avgPct}%`} sub={`${done}/${total} done`} icon={Target} accent />
          <StatCard label="On-time Rate" value={`${onTimePct}%`} sub={`${withPlanEnd.length} with deadline`} icon={TrendingUp}
            accent={onTimePct >= 80} warning={onTimePct >= 60 && onTimePct < 80} danger={onTimePct < 60} />
          <StatCard label="Blocked" value={blocked} sub={blocked > 0 ? 'needs attention' : 'all clear'} icon={Flame}
            danger={blocked > 0} />
          <StatCard label="Headcount" value={team.length} sub={`${Object.keys(domainCount).length} domains`} icon={Users} />
          <StatCard label="Open Risks" value={openRisks.length} sub={`${risks.length} total`} icon={ShieldAlert}
            danger={openRisks.length > 3} warning={openRisks.length > 0 && openRisks.length <= 3} />
          <StatCard label="Open Issues" value={openIssues.length} sub={`${issues.length} total`} icon={Bug}
            danger={openIssues.length > 2} warning={openIssues.length > 0 && openIssues.length <= 2} />
        </div>

        {/* ── Phase Progress + Status Donut ──────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Phase progress */}
          <div className="col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Phase Progress</h2>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">View Timeline →</Link>
            </div>
            <div className="p-4 space-y-3">
              {orderedPhases.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No activities yet</p>
              ) : orderedPhases.map(phase => {
                const acts = activities.filter(a => a.phase === phase);
                const { pct, label, lCls, barCls, done: d, inProg: ip, blocked: bl, total: tot } = PhaseStatus({ acts });
                const isCurrent = phase === project.current_phase;
                return (
                  <div key={phase}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                        <span className={`text-xs font-medium ${isCurrent ? 'text-slate-800' : 'text-slate-500'}`}>{phase}</span>
                        {isCurrent && <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Current</Badge>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">{d}/{tot} · {bl > 0 ? <span className="text-red-500">{bl} blocked</span> : ip > 0 ? `${ip} in progress` : ''}</span>
                        <span className={`text-[11px] font-semibold ${lCls}`}>{label}</span>
                        <span className="text-xs font-bold text-slate-700 w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status donut */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h2 className="font-semibold text-sm text-slate-700">Work Distribution</h2>
            </div>
            <div className="p-4 flex flex-col items-center gap-3">
              <DonutChart
                size={130}
                center={String(total)}
                slices={[
                  { label: 'Done',        value: done,    color: STATUS_COLOR['Done'] },
                  { label: 'In Progress', value: inProg,  color: STATUS_COLOR['In Progress'] },
                  { label: 'Blocked',     value: blocked, color: STATUS_COLOR['Blocked'] },
                  { label: 'To-do',       value: todo,    color: STATUS_COLOR['To-do'] },
                ]}
              />
              <div className="w-full space-y-1.5">
                {[
                  { label: 'Done',        value: done,    color: STATUS_COLOR['Done'] },
                  { label: 'In Progress', value: inProg,  color: STATUS_COLOR['In Progress'] },
                  { label: 'Blocked',     value: blocked, color: STATUS_COLOR['Blocked'] },
                  { label: 'To-do',       value: todo,    color: STATUS_COLOR['To-do'] },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                      <span className="text-slate-600">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: total ? `${(s.value / total) * 100}%` : '0%', background: s.color }} />
                      </div>
                      <span className="text-slate-500 font-mono w-6 text-right">{s.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Team + Risks + Issues ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">

          {/* Headcount by domain */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <Link href={`/projects/${id}/resources`} className="font-semibold text-sm text-slate-700 hover:text-blue-600 transition-colors">
                Headcount by Domain
              </Link>
              <Link href={`/projects/${id}/resources`} className="text-xs text-blue-600 hover:underline">{team.length} members →</Link>
            </div>
            <div className="p-4 space-y-2">
              {domainEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No team members</p>
              ) : domainEntries.map(([domain, count]) => (
                <div key={domain}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600">{domain}</span>
                    <span className="text-xs font-semibold text-slate-700">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count / maxDomain) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Risks */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Open Risks</h2>
              <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="divide-y">
              {openRisks.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <p className="text-xs text-green-600">No open risks</p>
                </div>
              ) : openRisks.slice(0, 4).map(r => (
                <div key={r.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{r.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.risk_id} · {r.category || '—'} · {r.owner || '—'}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${r.status === 'In Progress' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {r.status}
                    </span>
                  </div>
                  {r.due_date && <p className="text-[10px] text-slate-400 mt-0.5">Due: {fmt(r.due_date)}</p>}
                </div>
              ))}
              {openRisks.length > 4 && (
                <div className="px-4 py-2 text-center">
                  <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">+{openRisks.length - 4} more risks</Link>
                </div>
              )}
            </div>
          </div>

          {/* Open Issues */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Open Issues</h2>
              <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="divide-y">
              {openIssues.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-6 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <p className="text-xs text-green-600">No open issues</p>
                </div>
              ) : openIssues.slice(0, 4).map(i => (
                <div key={i.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{i.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{i.issue_id} · {i.category || '—'} · {i.owner || '—'}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${i.status === 'In Progress' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {i.status}
                    </span>
                  </div>
                  {i.due_date && <p className="text-[10px] text-slate-400 mt-0.5">Due: {fmt(i.due_date)}</p>}
                </div>
              ))}
              {openIssues.length > 4 && (
                <div className="px-4 py-2 text-center">
                  <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">+{openIssues.length - 4} more issues</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Weekly Highlights ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Completed this week */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-green-50/60 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h2 className="font-semibold text-sm text-slate-700">Completed This Week</h2>
              <span className="ml-auto text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{completedThisWeek.length}</span>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
            {completedThisWeek.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-slate-400">Nothing completed yet this week</div>
            ) : (
              <div className="divide-y">
                {completedThisWeek.slice(0, 6).map(a => (
                  <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{a.activity}</p>
                      <p className="text-[10px] text-slate-400">{a.phase} · Done {fmt(a.actual_end)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming deliverables */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-blue-50/60 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-sm text-slate-700">Upcoming Deliverables (30d)</h2>
              <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{upcoming.length}</span>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-slate-400">No upcoming deliverables in the next 30 days</div>
            ) : (
              <div className="divide-y">
                {upcoming.map(a => {
                  const d = daysFromNow(a.plan_end);
                  return (
                    <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                      <div className={`text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 mt-0.5 ${d <= 3 ? 'bg-red-100 text-red-700' : d <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
                        {d === 0 ? 'Today' : `${d}d`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{a.deliverable}</p>
                        <p className="text-[10px] text-slate-400 truncate">{a.activity} · {a.phase}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[a.status] ?? ''}`}>{a.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Blockers ───────────────────────────────────────────────────── */}
        {blocked > 0 && (
          <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              <h2 className="font-semibold text-sm text-red-700">Blockers — Immediate Attention Required</h2>
              <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">{blocked}</span>
            </div>
            <div className="divide-y divide-red-100">
              {activities.filter(a => a.status === 'Blocked').map(a => (
                <div key={a.id} className="px-4 py-2.5 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-red-800 truncate">{a.activity}</p>
                    <p className="text-[10px] text-red-500">{a.phase}{a.accountable ? ` · ${a.accountable}` : ''}</p>
                  </div>
                  {a.plan_end && (
                    <span className="text-[10px] text-red-600 font-mono shrink-0">
                      Due {fmt(a.plan_end)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overdue Tasks ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h2 className="font-semibold text-sm text-slate-700">Overdue Tasks</h2>
            {overdue.length > 0 && (
              <span className="ml-1 text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">{overdue.length}</span>
            )}
            <div className="ml-auto flex gap-3">
              <Link href={`/projects/${id}/analysis`} className="text-xs text-blue-600 hover:underline">Delay Analysis →</Link>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
          </div>
          {overdue.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-green-600">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              No overdue tasks — great work!
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1e293b] text-white text-[11px]">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Activity</th>
                      <th className="px-3 py-2.5 text-left w-32">Phase</th>
                      <th className="px-3 py-2.5 text-left w-28">Plan End</th>
                      <th className="px-3 py-2.5 text-center w-20">Overdue</th>
                      <th className="px-3 py-2.5 text-left w-28">Status</th>
                      <th className="px-3 py-2.5 text-left w-32">Accountable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdue.slice(overdueP * PAGE, (overdueP + 1) * PAGE).map((a, i) => {
                      const lag = Math.abs(daysFromNow(a.plan_end));
                      return (
                        <tr key={a.id} className={`border-t ${lag > 14 ? 'bg-red-50/40' : lag > 7 ? 'bg-amber-50/30' : ''}`}>
                          <td className="px-3 py-2 text-slate-400">{a.no || overdueP * PAGE + i + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px]">
                            <p className="truncate">{a.activity}</p>
                            {a.deliverable && <p className="text-[10px] text-slate-400 truncate">{a.deliverable}</p>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{a.phase}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{a.plan_end}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${lag > 14 ? 'text-red-600' : lag > 7 ? 'text-orange-600' : 'text-amber-600'}`}>+{lag}d</span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[a.status] ?? ''}`}>{a.status}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{a.accountable || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={overdueP} total={overdue.length} pageSize={PAGE} onChange={p => { setOverdueP(p); }} />
            </>
          )}
        </div>

        {/* ── Due This Week ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-500" />
            <h2 className="font-semibold text-sm text-slate-700">Due This Week</h2>
            {dueWeek.length > 0 && (
              <span className="ml-1 text-xs font-bold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">{dueWeek.length}</span>
            )}
            <span className="text-[10px] text-slate-400">Next 7 days</span>
            <Link href={`/projects/${id}/timeline`} className="ml-auto text-xs text-blue-600 hover:underline">Timeline →</Link>
          </div>
          {dueWeek.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
              <Clock className="h-4 w-4 text-slate-300" />
              No tasks due in the next 7 days
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1e293b] text-white text-[11px]">
                      <th className="px-3 py-2.5 text-left w-8">#</th>
                      <th className="px-3 py-2.5 text-left">Activity</th>
                      <th className="px-3 py-2.5 text-left w-32">Phase</th>
                      <th className="px-3 py-2.5 text-left w-28">Due Date</th>
                      <th className="px-3 py-2.5 text-center w-20">In</th>
                      <th className="px-3 py-2.5 text-center w-16">Done%</th>
                      <th className="px-3 py-2.5 text-left w-28">Status</th>
                      <th className="px-3 py-2.5 text-left w-32">Accountable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueWeek.slice(dueWeekP * PAGE, (dueWeekP + 1) * PAGE).map((a, i) => {
                      const d = daysFromNow(a.plan_end);
                      return (
                        <tr key={a.id} className={`border-t ${d === 0 ? 'bg-amber-50/40' : d <= 2 ? 'bg-blue-50/20' : ''}`}>
                          <td className="px-3 py-2 text-slate-400">{a.no || dueWeekP * PAGE + i + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px]">
                            <p className="truncate">{a.activity}</p>
                            {a.deliverable && <p className="text-[10px] text-slate-400 truncate">{a.deliverable}</p>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{a.phase}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{a.plan_end}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`font-bold ${d === 0 ? 'text-red-600' : d <= 2 ? 'text-orange-500' : 'text-blue-600'}`}>
                              {d === 0 ? 'Today' : `${d}d`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${a.completion_pct}%` }} />
                              </div>
                              <span className="text-slate-500">{a.completion_pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[a.status] ?? ''}`}>{a.status}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{a.accountable || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={dueWeekP} total={dueWeek.length} pageSize={PAGE} onChange={p => { setDueWeekP(p); }} />
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <p className="text-[10px] text-slate-300 text-center pb-2">
          SPI (Schedule Performance Index) = % work done ÷ % timeline elapsed · &gt;1 ahead · &lt;0.8 at risk
        </p>

      </main>

      {/* ── Edit Project Info Dialog ───────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={o => !o && setEditOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Project Name *</Label>
                <Input className="mt-1 text-sm" value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Client</Label>
                <Input className="mt-1 text-sm" value={editForm.client ?? ''} onChange={e => setEditForm(f => ({ ...f, client: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Current Phase</Label>
                <select
                  className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={editForm.current_phase ?? ''}
                  onChange={e => setEditForm(f => ({ ...f, current_phase: e.target.value }))}
                >
                  {['Initiation','Planning','Execution','Closing'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Project Manager (PM)</Label>
                <Input className="mt-1 text-sm" placeholder="Nguyễn Văn A" value={editForm.pm_name ?? ''} onChange={e => setEditForm(f => ({ ...f, pm_name: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">PM Email</Label>
                <Input className="mt-1 text-sm" type="email" placeholder="pm@company.com" value={editForm.pm_email ?? ''} onChange={e => setEditForm(f => ({ ...f, pm_email: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input className="mt-1 text-sm" type="date" value={editForm.start_date ?? ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input className="mt-1 text-sm" type="date" value={editForm.end_date ?? ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Description</Label>
                <Textarea className="mt-1 text-sm" rows={2} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving || !editForm.name?.trim()} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
