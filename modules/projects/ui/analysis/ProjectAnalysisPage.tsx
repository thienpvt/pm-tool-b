'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, User, Building2 } from 'lucide-react';

type Activity = {
  id: number; phase: string; no: string; activity: string;
  plan_start: string; plan_end: string; actual_start: string; actual_end: string;
  status: string; completion_pct: number;
  delay_owner: string; delay_reason: string;
};

const PHASES = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];

const PHASE_COLOR: Record<string, string> = {
  'Initializing':          'bg-blue-500',
  'Architecture & Design': 'bg-indigo-500',
  'Setup & Infra':         'bg-cyan-500',
  'Development':           'bg-violet-500',
  'Testing':               'bg-amber-500',
  'UAT':                   'bg-orange-500',
  'Deployment':            'bg-emerald-500',
  'Closing':               'bg-slate-500',
};

const DELAY_OWNER_COLOR: Record<string, string> = {
  'Client':   'bg-purple-100 text-purple-700 border-purple-200',
  'Vendor':   'bg-blue-100 text-blue-700 border-blue-200',
  'Both':     'bg-orange-100 text-orange-700 border-orange-200',
  'External': 'bg-slate-100 text-slate-600 border-slate-200',
  'N/A':      'bg-green-100 text-green-700 border-green-200',
};

// ─── Core calculation functions ───────────────────────────────────────────────

function calcLag(planEnd: string, actualEnd: string, status: string): number {
  if (!planEnd) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plan = new Date(planEnd); plan.setHours(0, 0, 0, 0);
  if (status === 'Done') {
    if (!actualEnd) return 0;
    const actual = new Date(actualEnd); actual.setHours(0, 0, 0, 0);
    return Math.round((actual.getTime() - plan.getTime()) / 86400000);
  }
  if (status === 'To-do') return 0;
  return today > plan ? Math.round((today.getTime() - plan.getTime()) / 86400000) : 0;
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0;
  const d1 = new Date(a); d1.setHours(0,0,0,0);
  const d2 = new Date(b); d2.setHours(0,0,0,0);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

interface PhaseStats {
  phase: string;
  total: number;
  done: number;
  inProg: number;
  planStart: string;
  planEnd: string;
  planDays: number;
  actualStart: string;
  startLag: number;    // actual_start vs plan_start
  maxLag: number;      // worst individual lag
  avgLag: number;      // avg of all lags
  totalLagDays: number; // sum of positive lags
  clientDays: number;
  vendorDays: number;
  bothDays: number;
  externalDays: number;
  overdueCount: number;
  pct: number;         // avg completion %
}

function analyzePhase(acts: Activity[]): Omit<PhaseStats, 'phase'> {
  const withPlan = acts.filter(a => a.plan_start && a.plan_end);
  const planStart = withPlan.length ? withPlan.map(a => a.plan_start).sort()[0] : '';
  const planEnd   = withPlan.length ? withPlan.map(a => a.plan_end).sort().at(-1)! : '';
  const planDays  = daysBetween(planStart, planEnd);

  const withActual = acts.filter(a => a.actual_start);
  const actualStart = withActual.length ? withActual.map(a => a.actual_start).sort()[0] : '';
  const startLag = actualStart && planStart ? daysBetween(planStart, actualStart) : 0;

  const lags = acts.map(a => calcLag(a.plan_end, a.actual_end, a.status));
  const posLags = lags.filter(l => l > 0);
  const maxLag = lags.length ? Math.max(0, ...lags) : 0;
  const avgLag = lags.length ? Math.round(lags.reduce((s, l) => s + l, 0) / lags.length) : 0;
  const totalLagDays = posLags.reduce((s, l) => s + l, 0);

  const overdueCount = acts.filter(a => a.status !== 'Done' && calcLag(a.plan_end, a.actual_end, a.status) > 0).length;

  const delayLag = (owner: string) =>
    acts.filter(a => a.delay_owner === owner)
        .map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status)))
        .reduce((s, l) => s + l, 0);

  const clientDays   = delayLag('Client')   + acts.filter(a => a.delay_owner === 'Both').map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status))).reduce((s,l) => s+l, 0);
  const vendorDays   = delayLag('Vendor')   + acts.filter(a => a.delay_owner === 'Both').map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status))).reduce((s,l) => s+l, 0);
  const bothDays     = delayLag('Both');
  const externalDays = delayLag('External');

  const done   = acts.filter(a => a.status === 'Done').length;
  const inProg = acts.filter(a => a.status === 'In Progress').length;
  const pct    = acts.length ? Math.round(acts.reduce((s, a) => s + (a.completion_pct || 0), 0) / acts.length) : 0;

  return { total: acts.length, done, inProg, planStart, planEnd, planDays, actualStart, startLag, maxLag, avgLag, totalLagDays, clientDays, vendorDays, bothDays, externalDays, overdueCount, pct };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = false, danger = false }:
  { label: string; value: string | number; sub?: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 bg-white ${danger ? 'border-red-200 bg-red-50/30' : accent ? 'border-blue-200 bg-blue-50/30' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className={`h-4 w-4 ${danger ? 'text-red-400' : accent ? 'text-blue-400' : 'text-slate-300'}`} />
      </div>
      <p className={`text-2xl font-bold ${danger ? 'text-red-700' : accent ? 'text-blue-700' : 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LagBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-600 w-10 text-right">{value}d</span>
    </div>
  );
}

function lagColor(lag: number): string {
  if (lag <= 0) return 'text-green-600';
  if (lag <= 3) return 'text-yellow-600';
  if (lag <= 14) return 'text-orange-600';
  return 'text-red-600 font-bold';
}

function lagBgColor(lag: number): string {
  if (lag <= 0) return '';
  if (lag <= 3) return 'bg-yellow-50';
  if (lag <= 14) return 'bg-orange-50';
  return 'bg-red-50';
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  const [sortBy, setSortBy] = useState<'lag' | 'phase' | 'status'>('lag');
  const [filterOwner, setFilterOwner] = useState('All');

  const load = useCallback(async () => {
    const [acts, proj] = await Promise.all([
      fetch(`/api/projects/${id}/activities`).then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ]);
    setActivities(Array.isArray(acts) ? acts : []);
    setProjectName(proj.name ?? '');
    setClientName(proj.client ?? '');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!activities.length && !projectName) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar projectId={id} />
        <main className="flex-1 p-4 lg:p-8"><p className="text-slate-400">Loading...</p></main>
      </div>
    );
  }

  // ── Global metrics ──────────────────────────────────────────────────────────
  const allLags = activities.map(a => calcLag(a.plan_end, a.actual_end, a.status));
  const totalActivities = activities.length;
  const doneCount = activities.filter(a => a.status === 'Done').length;
  const overdueCount = activities.filter(a => a.status !== 'Done' && calcLag(a.plan_end, a.actual_end, a.status) > 0).length;
  const maxLagGlobal = Math.max(0, ...allLags);
  const avgLagGlobal = allLags.length ? Math.round(allLags.reduce((s, l) => s + l, 0) / allLags.length) : 0;

  const clientTotalDays = activities
    .filter(a => a.delay_owner === 'Client' || a.delay_owner === 'Both')
    .map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status)))
    .reduce((s, l) => s + l, 0);
  const vendorTotalDays = activities
    .filter(a => a.delay_owner === 'Vendor' || a.delay_owner === 'Both')
    .map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status)))
    .reduce((s, l) => s + l, 0);
  const externalDays = activities
    .filter(a => a.delay_owner === 'External')
    .map(a => Math.max(0, calcLag(a.plan_end, a.actual_end, a.status)))
    .reduce((s, l) => s + l, 0);

  const onTimePct = totalActivities > 0 ? Math.round((allLags.filter(l => l <= 0).length / totalActivities) * 100) : 100;

  // ── Phase breakdown ─────────────────────────────────────────────────────────
  const phasesInData = [...new Set(activities.map(a => a.phase))];
  const orderedPhases = [
    ...PHASES.filter(p => phasesInData.includes(p)),
    ...phasesInData.filter(p => !PHASES.includes(p)),
  ];
  const phaseStats: PhaseStats[] = orderedPhases.map(phase => ({
    phase,
    ...analyzePhase(activities.filter(a => a.phase === phase)),
  }));
  const maxPhaseLag = Math.max(1, ...phaseStats.map(p => p.maxLag));
  const maxClientDays = Math.max(1, ...phaseStats.map(p => p.clientDays));
  const maxVendorDays = Math.max(1, ...phaseStats.map(p => p.vendorDays));

  // ── Activity delay table ────────────────────────────────────────────────────
  let delayActs = activities.filter(a => {
    const lag = calcLag(a.plan_end, a.actual_end, a.status);
    if (filterOwner !== 'All' && a.delay_owner !== filterOwner) return false;
    return lag > 0 || a.delay_owner !== 'N/A';
  });

  if (sortBy === 'lag') delayActs = [...delayActs].sort((a, b) => calcLag(b.plan_end, b.actual_end, b.status) - calcLag(a.plan_end, a.actual_end, a.status));
  else if (sortBy === 'phase') delayActs = [...delayActs].sort((a, b) => PHASES.indexOf(a.phase) - PHASES.indexOf(b.phase));
  else delayActs = [...delayActs].sort((a, b) => a.status.localeCompare(b.status));

  // ── Delay ownership breakdown (pie-like using bars) ─────────────────────────
  const ownerTotals = [
    { label: 'Client',   days: clientTotalDays,  color: 'bg-purple-500', icon: Building2 },
    { label: 'Vendor',   days: vendorTotalDays,   color: 'bg-blue-500',   icon: User },
    { label: 'External', days: externalDays,       color: 'bg-slate-400',  icon: AlertTriangle },
  ].filter(o => o.days > 0);
  const maxOwnerDays = Math.max(1, ...ownerTotals.map(o => o.days));

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Delay Analysis</h1>
          <p className="text-xs text-slate-400 mt-0.5">{projectName}{clientName ? ` · ${clientName}` : ''}</p>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Activities" value={totalActivities} sub={`${doneCount} done`} icon={CheckCircle2} />
          <StatCard label="On-time Rate" value={`${onTimePct}%`} sub={`${totalActivities - doneCount} in progress`} icon={TrendingUp} accent={onTimePct >= 80} danger={onTimePct < 60} />
          <StatCard label="Overdue Activities" value={overdueCount} sub="status ≠ Done, past plan end" icon={AlertTriangle} danger={overdueCount > 0} />
          <StatCard label="Max Lag" value={maxLagGlobal > 0 ? `+${maxLagGlobal}d` : 'On time'} sub="worst single activity" icon={Clock} danger={maxLagGlobal > 14} />
          <StatCard label="Client Delay" value={`${clientTotalDays}d`} sub="accumulated days" icon={Building2} danger={clientTotalDays > 0} />
          <StatCard label="Vendor Delay" value={`${vendorTotalDays}d`} sub="accumulated days" icon={User} danger={vendorTotalDays > 0} />
        </div>

        <div className="grid grid-cols-3 gap-5 mb-6">

          {/* ── Phase breakdown table ──────────────────────────────────── */}
          <div className="col-span-2 rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Phase Breakdown</h2>
              <span className="text-xs text-slate-400">{phaseStats.length} phases</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1e293b] text-white text-[11px]">
                    <th className="px-3 py-2.5 text-left">Phase</th>
                    <th className="px-3 py-2.5 text-center">Acts</th>
                    <th className="px-3 py-2.5 text-center">Done</th>
                    <th className="px-3 py-2.5 text-center">%</th>
                    <th className="px-3 py-2.5 text-left">Plan Period</th>
                    <th className="px-3 py-2.5 text-center w-12">Plan Days</th>
                    <th className="px-3 py-2.5 text-center">Start Lag</th>
                    <th className="px-3 py-2.5 text-center">Max Lag</th>
                    <th className="px-3 py-2.5 text-center">Client</th>
                    <th className="px-3 py-2.5 text-center">Vendor</th>
                    <th className="px-3 py-2.5 text-center">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseStats.map(ps => (
                    <tr key={ps.phase} className={`border-t ${ps.maxLag > 14 ? 'bg-red-50/30' : ps.maxLag > 3 ? 'bg-amber-50/20' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${PHASE_COLOR[ps.phase] ?? 'bg-slate-400'}`} />
                          <span className="font-medium text-slate-700">{ps.phase}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{ps.total}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={ps.done === ps.total ? 'text-green-600 font-medium' : 'text-slate-600'}>{ps.done}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${ps.pct}%` }} />
                          </div>
                          <span className="text-slate-500">{ps.pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                        {ps.planStart ? `${ps.planStart} → ${ps.planEnd}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{ps.planDays || '—'}</td>
                      <td className={`px-3 py-2.5 text-center font-medium ${lagColor(ps.startLag)}`}>
                        {ps.startLag > 0 ? `+${ps.startLag}d` : ps.startLag < 0 ? `${ps.startLag}d` : '—'}
                      </td>
                      <td className={`px-3 py-2.5 text-center font-bold ${lagColor(ps.maxLag)}`}>
                        {ps.maxLag > 0 ? `+${ps.maxLag}d` : <span className="text-green-500 font-normal">✓</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ps.clientDays > 0 ? <span className="text-purple-700 font-medium">{ps.clientDays}d</span> : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ps.vendorDays > 0 ? <span className="text-blue-700 font-medium">{ps.vendorDays}d</span> : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {ps.overdueCount > 0
                          ? <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">{ps.overdueCount}</span>
                          : <span className="text-slate-200">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right panel: ownership + phase lag bars ────────────────── */}
          <div className="flex flex-col gap-4">

            {/* Delay ownership */}
            <div className="rounded-xl border bg-white shadow-sm p-4">
              <h2 className="font-semibold text-sm text-slate-700 mb-3">Delay Ownership</h2>
              {ownerTotals.length === 0 ? (
                <p className="text-xs text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> No delays recorded</p>
              ) : (
                <div className="space-y-3">
                  {ownerTotals.map(o => (
                    <div key={o.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600">{o.label}</span>
                        <span className="text-xs text-slate-500">{o.days} days</span>
                      </div>
                      <LagBar value={o.days} max={maxOwnerDays} color={o.color} />
                    </div>
                  ))}
                  <div className="pt-2 border-t text-xs text-slate-400">
                    Total delay: {clientTotalDays + vendorTotalDays + externalDays} days across all activities
                  </div>
                </div>
              )}
            </div>

            {/* Phase lag bars */}
            <div className="rounded-xl border bg-white shadow-sm p-4 flex-1">
              <h2 className="font-semibold text-sm text-slate-700 mb-3">Lag by Phase</h2>
              <div className="space-y-2.5">
                {phaseStats.filter(p => p.planDays > 0 || p.maxLag > 0).map(ps => (
                  <div key={ps.phase}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${PHASE_COLOR[ps.phase] ?? 'bg-slate-400'}`} />
                        <span className="text-[11px] text-slate-600 truncate max-w-[110px]">{ps.phase}</span>
                      </div>
                      <span className={`text-[11px] font-medium ${lagColor(ps.maxLag)}`}>
                        {ps.maxLag > 0 ? `+${ps.maxLag}d` : '✓'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${ps.maxLag > 14 ? 'bg-red-500' : ps.maxLag > 3 ? 'bg-orange-400' : ps.maxLag > 0 ? 'bg-yellow-400' : 'bg-green-400'}`}
                        style={{ width: `${Math.min((ps.maxLag / maxPhaseLag) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Activity delay detail ──────────────────────────────────────── */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-sm text-slate-700">Activity Delay Detail</h2>
              <p className="text-xs text-slate-400">Chỉ hiển thị activities có delay hoặc đã ghi nhận delay owner</p>
            </div>
            <div className="flex gap-2">
              <Select value={filterOwner} onValueChange={v => setFilterOwner(v ?? 'All')}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Owners</SelectItem>
                  {['Client','Vendor','Both','External','N/A'].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lag">Sort: Lag ↓</SelectItem>
                  <SelectItem value="phase">Sort: Phase</SelectItem>
                  <SelectItem value="status">Sort: Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {delayActs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
              <p className="text-sm">Không có activity nào bị delay hoặc được ghi nhận.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 font-medium">
                    <th className="px-3 py-2.5 text-left w-8">#</th>
                    <th className="px-3 py-2.5 text-left">Activity</th>
                    <th className="px-3 py-2.5 text-left w-36">Phase</th>
                    <th className="px-3 py-2.5 text-left w-28">Plan End</th>
                    <th className="px-3 py-2.5 text-left w-28">Actual End</th>
                    <th className="px-3 py-2.5 text-center w-20">Lag</th>
                    <th className="px-3 py-2.5 text-left w-28">Status</th>
                    <th className="px-3 py-2.5 text-left w-24">Delay By</th>
                    <th className="px-3 py-2.5 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {delayActs.map((a, i) => {
                    const lag = calcLag(a.plan_end, a.actual_end, a.status);
                    return (
                      <tr key={a.id} className={`border-t ${lagBgColor(lag)}`}>
                        <td className="px-3 py-2 text-slate-400">{a.no || i + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate">{a.activity}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${PHASE_COLOR[a.phase] ?? 'bg-slate-400'}`} />
                            <span className="text-slate-500 truncate">{a.phase}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{a.plan_end || '—'}</td>
                        <td className="px-3 py-2 text-slate-500 font-mono">{a.actual_end || '—'}</td>
                        <td className={`px-3 py-2 text-center font-bold ${lagColor(lag)}`}>
                          {lag > 0 ? `+${lag}d` : lag < 0 ? `${lag}d` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                            a.status === 'Done' ? 'bg-green-100 text-green-700 border-green-200'
                            : a.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : a.status === 'Blocked' ? 'bg-red-100 text-red-700 border-red-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>{a.status}</span>
                        </td>
                        <td className="px-3 py-2">
                          {a.delay_owner && a.delay_owner !== 'N/A' ? (
                            <Badge className={`text-[10px] border ${DELAY_OWNER_COLOR[a.delay_owner]}`}>{a.delay_owner}</Badge>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{a.delay_reason || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 mt-3">
          Lag = actual end − plan end (Done) · hoặc today − plan end (In Progress/Blocked). Client/Vendor days tính tổng lag của các activities được ghi nhận thuộc bên đó.
        </p>
      </main>
    </div>
  );
}
