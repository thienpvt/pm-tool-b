'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  Plus, ArrowRight, Calendar, User, Building2, ShieldAlert,
  Bug, TrendingUp, FolderOpen, ChevronDown, ChevronUp,
  Activity, AlertCircle, LayoutGrid, List, FileBarChart2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProjectRow = {
  id: number; name: string; client: string; customer_id: number | null;
  customer_name: string; customer_industry: string;
  pm_name: string; start_date: string; end_date: string;
  current_phase: string; description: string;
  open_risks: number; open_issues: number;
  completion_pct: number; total_activities: number; done_activities: number;
  rag: 'red' | 'amber' | 'green';
  days_until_deadline: number | null;
};
type CustomerGroup = {
  id: number; name: string; industry: string;
  projects: ProjectRow[];
};
type PortfolioData = {
  projects: ProjectRow[];
  customers: CustomerGroup[];
  noCustomerProjects: ProjectRow[];
  phaseDist: { phase: string; count: number }[];
  customerBar: { name: string; count: number; active: number }[];
  kpi: {
    totalProjects: number; totalCustomers: number;
    totalOpenRisks: number; totalOpenIssues: number;
    avgCompletion: number; activeProjects: number;
  };
};

// ─── Style maps ───────────────────────────────────────────────────────────────
const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning:   'bg-blue-100 text-blue-700 border-blue-200',
  Execution:  'bg-amber-100 text-amber-700 border-amber-200',
  Closing:    'bg-green-100 text-green-700 border-green-200',
};
const PHASE_CHART_COLOR: Record<string, string> = {
  Initiation: '#a855f7', Planning: '#3b82f6', Execution: '#f59e0b', Closing: '#22c55e',
};
const INDUSTRY_COLOR: Record<string, string> = {
  'Banking & Finance': 'bg-blue-100 text-blue-700',
  'Fintech': 'bg-cyan-100 text-cyan-700',
  'Insurance': 'bg-purple-100 text-purple-700',
  'Retail': 'bg-orange-100 text-orange-700',
  'Healthcare': 'bg-green-100 text-green-700',
  'Technology': 'bg-indigo-100 text-indigo-700',
};

function avatarBg(name: string) {
  const colors = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-indigo-500','bg-rose-500'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function daysLeft(endDate: string) {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate + 'T00:00:00').getTime() - Date.now()) / 86400000);
}

// ─── RAG badge ────────────────────────────────────────────────────────────────
const RAG_STYLE = {
  red:   { dot: 'bg-red-500',   pill: 'bg-red-50 text-red-600 border-red-200',   label: 'RED' },
  amber: { dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-600 border-amber-200', label: 'AMBER' },
  green: { dot: 'bg-green-500', pill: 'bg-green-50 text-green-600 border-green-200', label: 'GREEN' },
};
function RagBadge({ rag }: { rag: 'red' | 'amber' | 'green' }) {
  const s = RAG_STYLE[rag];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── List view row ─────────────────────────────────────────────────────────────
function ProjectListRow({ p }: { p: ProjectRow }) {
  const dl = p.days_until_deadline;
  const isOverdue = dl !== null && dl < 0;
  const isWarning = dl !== null && dl >= 0 && dl <= 14;
  return (
    <Link href={`/projects/${p.id}`}>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer group ${isOverdue ? 'bg-red-50/30' : ''}`}>
        {/* RAG */}
        <div className="w-16 shrink-0"><RagBadge rag={p.rag} /></div>
        {/* Name + customer */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">{p.name}</p>
          {(p.customer_name || p.client) && (
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5" />{p.customer_name || p.client}
            </p>
          )}
        </div>
        {/* Phase */}
        <div className="w-24 shrink-0 hidden md:block">
          <Badge className={`text-[10px] ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>{p.current_phase}</Badge>
        </div>
        {/* Progress */}
        <div className="w-28 shrink-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
              <div
                className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-400' : 'bg-slate-300'}`}
                style={{ width: `${p.completion_pct}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-500 font-medium shrink-0">{p.completion_pct}%</span>
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5">{p.done_activities}/{p.total_activities} done</p>
        </div>
        {/* Deadline */}
        <div className="w-28 shrink-0 hidden xl:flex flex-col items-end">
          {dl !== null ? (
            <span className={`text-xs font-semibold flex items-center gap-1 ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              <Calendar className="h-3 w-3" />
              {isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
            </span>
          ) : <span className="text-xs text-slate-300">—</span>}
          {p.end_date && <span className="text-[10px] text-slate-300">{p.end_date}</span>}
        </div>
        {/* Risks / issues */}
        <div className="w-16 shrink-0 flex flex-col items-end gap-0.5">
          {p.open_risks > 0 && <span className="flex items-center gap-1 text-[10px] text-red-500"><ShieldAlert className="h-3 w-3" />{p.open_risks}</span>}
          {p.open_issues > 0 && <span className="flex items-center gap-1 text-[10px] text-violet-500"><Bug className="h-3 w-3" />{p.open_issues}</span>}
          {p.open_risks === 0 && p.open_issues === 0 && <span className="text-[10px] text-green-500">✓</span>}
        </div>
        {/* PM */}
        {p.pm_name && (
          <div className="w-24 shrink-0 hidden xl:flex items-center gap-1">
            <User className="h-3 w-3 text-slate-300" />
            <span className="text-[11px] text-slate-400 truncate">{p.pm_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ p }: { p: ProjectRow }) {
  const dl = daysLeft(p.end_date);
  const isOverdue = dl !== null && dl < 0;
  const isWarning = dl !== null && dl >= 0 && dl <= 14;

  return (
    <Link href={`/projects/${p.id}`}>
      <div className="bg-white rounded-xl border hover:shadow-md transition-all cursor-pointer group p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`text-[10px] shrink-0 ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>
            {p.current_phase}
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-blue-500 transition-colors shrink-0 mt-0.5" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{p.name}</h4>
          {p.pm_name && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><User className="h-3 w-3" />{p.pm_name}</p>}
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{p.done_activities}/{p.total_activities} activities</span>
            <span className="font-semibold text-slate-600">{p.completion_pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-500' : 'bg-slate-300'}`}
              style={{ width: `${p.completion_pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t">
          <div className="flex items-center gap-3">
            {p.open_risks > 0 && <span className="flex items-center gap-1 text-red-500"><ShieldAlert className="h-3 w-3" />{p.open_risks}</span>}
            {p.open_issues > 0 && <span className="flex items-center gap-1 text-violet-500"><Bug className="h-3 w-3" />{p.open_issues}</span>}
            {p.open_risks === 0 && p.open_issues === 0 && <span className="text-green-500">✓ Clean</span>}
          </div>
          {dl !== null && (
            <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              <Calendar className="h-3 w-3" />
              {isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Collapsible customer section ─────────────────────────────────────────────
function CustomerSection({ customer, defaultOpen }: { customer: CustomerGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const phases = ['Initiation','Planning','Execution','Closing'];
  const phaseCounts = Object.fromEntries(phases.map(ph => [ph, customer.projects.filter(p => p.current_phase === ph).length]));
  const openRisks = customer.projects.reduce((s, p) => s + p.open_risks, 0);
  const openIssues = customer.projects.reduce((s, p) => s + p.open_issues, 0);
  const avgPct = customer.projects.length
    ? Math.round(customer.projects.reduce((s, p) => s + p.completion_pct, 0) / customer.projects.length)
    : 0;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl ${avatarBg(customer.name)} flex items-center justify-center text-white font-bold shrink-0`}>
          {initials(customer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{customer.name}</span>
            {customer.industry && (
              <Badge className={`text-[10px] ${INDUSTRY_COLOR[customer.industry] ?? 'bg-slate-100 text-slate-600'}`}>
                {customer.industry}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{customer.projects.length} projects</span>
            {phases.map(ph => phaseCounts[ph] > 0 && (
              <span key={ph} className={`px-1.5 py-px rounded text-[10px] font-semibold ${PHASE_COLOR[ph]}`}>
                {phaseCounts[ph]} {ph}
              </span>
            ))}
            {openRisks > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-3 w-3" />{openRisks}</span>}
            {openIssues > 0 && <span className="flex items-center gap-1 text-violet-400"><Bug className="h-3 w-3" />{openIssues}</span>}
            <span className="flex items-center gap-1 ml-1"><Activity className="h-3 w-3 text-blue-400" />{avgPct}% avg</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 border-t bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-4">
            {customer.projects.map(p => <ProjectCard key={p.id} p={p} />)}
            <Link href="/projects/new">
              <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors p-4 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-500 cursor-pointer h-full min-h-[120px]">
                <Plus className="h-4 w-4" /> New Project
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border rounded-lg shadow-md px-3 py-2 text-xs">
      <span className="font-semibold">{payload[0].name}</span>: {payload[0].value}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState<string>('');
  // null = All, number = customer id
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  useEffect(() => {
    fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); });
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => { if (u?.company_name) setCompanyName(u.company_name); });
  }, []);

  // Derive the active customer object
  const activeCustomer = useMemo(() => {
    if (selectedCustomerId === null || !data) return null;
    return data.customers.find(c => c.id === selectedCustomerId) ?? null;
  }, [data, selectedCustomerId]);

  // Projects to display in charts/KPIs based on filter
  const filteredProjects = useMemo(() => {
    if (!data) return [];
    if (selectedCustomerId === null) return data.projects;
    if (selectedCustomerId === 0) return data.noCustomerProjects;
    return activeCustomer?.projects ?? [];
  }, [data, selectedCustomerId, activeCustomer]);

  // Derived KPI for current filter
  const filteredKpi = useMemo(() => {
    const ps = filteredProjects;
    return {
      totalProjects: ps.length,
      activeProjects: ps.filter(p => p.current_phase !== 'Closing').length,
      totalOpenRisks: ps.reduce((s, p) => s + p.open_risks, 0),
      totalOpenIssues: ps.reduce((s, p) => s + p.open_issues, 0),
      avgCompletion: ps.length ? Math.round(ps.reduce((s, p) => s + p.completion_pct, 0) / ps.length) : 0,
      totalCustomers: data?.kpi.totalCustomers ?? 0,
    };
  }, [filteredProjects, data]);

  // Phase distribution for current filter
  const filteredPhaseDist = useMemo(() => {
    const phases = ['Initiation','Planning','Execution','Closing'];
    return phases.map(phase => ({
      phase, count: filteredProjects.filter(p => p.current_phase === phase).length,
    }));
  }, [filteredProjects]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-slate-400 text-sm animate-pulse">Loading portfolio...</div>
        </main>
      </div>
    );
  }
  if (!data) return null;

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Determine which sections to show
  const showAllCustomers = selectedCustomerId === null;
  const showSingleCustomer = selectedCustomerId !== null && selectedCustomerId !== 0 && activeCustomer;
  const showNoCustomer = selectedCustomerId === 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Top bar ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-slate-400">{dateStr}</p>
              <h1 className="text-2xl font-bold text-slate-800 mt-0.5">{greeting} 👋</h1>
              <p className="text-slate-500 text-sm mt-1">
                Portfolio overview — {companyName || 'All Projects'}
                {activeCustomer && <> · <span className="text-blue-600 font-semibold">{activeCustomer.name}</span></>}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/portfolio/report">
                <Button variant="outline" className="h-9 text-sm gap-2">
                  <FileBarChart2 className="h-4 w-4 text-blue-500" /> Portfolio Report
                </Button>
              </Link>
              <Link href="/customers">
                <Button variant="outline" className="h-9 text-sm gap-2">
                  <Building2 className="h-4 w-4" /> Customers
                </Button>
              </Link>
              <Link href="/projects/new">
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
                  <Plus className="h-4 w-4" /> New Project
                </Button>
              </Link>
            </div>
          </div>

          {/* ── Customer switcher tabs ── */}
          <div className="bg-white rounded-2xl border p-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {/* All tab */}
              <button
                onClick={() => setSelectedCustomerId(null)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                  selectedCustomerId === null
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                All Customers
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedCustomerId === null ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {data.projects.length}
                </span>
              </button>

              {/* Separator */}
              {data.customers.length > 0 && (
                <div className="w-px h-6 bg-slate-200 shrink-0 mx-1" />
              )}

              {/* Customer tabs */}
              {data.customers.map(c => {
                const isActive = selectedCustomerId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCustomerId(isActive ? null : c.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md ${avatarBg(c.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                      {initials(c.name)}
                    </div>
                    <span className="max-w-[120px] truncate">{c.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {c.projects.length}
                    </span>
                  </button>
                );
              })}

              {/* No-customer tab if needed */}
              {data.noCustomerProjects.length > 0 && (
                <button
                  onClick={() => setSelectedCustomerId(selectedCustomerId === 0 ? null : 0)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
                    selectedCustomerId === 0
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  <span>Unassigned</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedCustomerId === 0 ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {data.noCustomerProjects.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {[
              { label: 'Total Projects', value: filteredKpi.totalProjects, icon: FolderOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active', value: filteredKpi.activeProjects, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
              { label: showAllCustomers ? 'Customers' : 'Projects Phase', value: showAllCustomers ? filteredKpi.totalCustomers : activeCustomer?.projects.filter(p => p.current_phase === 'Execution').length ?? 0, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Avg. Progress', value: `${filteredKpi.avgCompletion}%`, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50' },
              { label: 'Open Risks', value: filteredKpi.totalOpenRisks, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Open Issues', value: filteredKpi.totalOpenIssues, icon: AlertCircle, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label} className="p-4 flex flex-col gap-2">
                <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            {/* Phase donut */}
            <Card className="xl:col-span-2 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-1">Projects by Phase</h3>
              <p className="text-xs text-slate-400 mb-4">
                {selectedCustomerId === null ? 'All customers' : activeCustomer?.name ?? 'Unassigned'}
              </p>
              {filteredProjects.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={filteredPhaseDist.filter(d => d.count > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="count" nameKey="phase">
                      {filteredPhaseDist.filter(d => d.count > 0).map(d => (
                        <Cell key={d.phase} fill={PHASE_CHART_COLOR[d.phase] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip content={<PhaseTooltip />} />
                    <Legend formatter={v => <span className="text-xs text-slate-600">{v}</span>} iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Customer/project bar */}
            <Card className="xl:col-span-3 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-1">
                {selectedCustomerId === null ? 'Projects per Customer' : `${activeCustomer?.name ?? ''} — Project Progress`}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {selectedCustomerId === null ? 'Portfolio view' : 'Completion % per project'}
              </p>
              {selectedCustomerId === null ? (
                data.customerBar.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No customers yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.customerBar} layout="vertical" barGap={2}>
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="active" name="Active" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                filteredProjects.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No projects</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={filteredProjects.map(p => ({ name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name, pct: p.completion_pct }))}
                      layout="vertical"
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={100} />
                      <Tooltip formatter={(v) => [`${v}%`, 'Progress']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="pct" name="Progress" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              )}
            </Card>
          </div>

          {/* ── Project sections ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                {selectedCustomerId === null
                  ? 'All Customer Portfolios'
                  : selectedCustomerId === 0
                  ? 'Unassigned Projects'
                  : `${activeCustomer?.name ?? ''} — Projects`}
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                {/* RAG summary (list mode) */}
                {viewMode === 'list' && filteredProjects.length > 0 && (() => {
                  const red = filteredProjects.filter(p => p.rag === 'red').length;
                  const amber = filteredProjects.filter(p => p.rag === 'amber').length;
                  const green = filteredProjects.filter(p => p.rag === 'green').length;
                  return (
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      {red > 0 && <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">🔴 {red}</span>}
                      {amber > 0 && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">🟡 {amber}</span>}
                      {green > 0 && <span className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🟢 {green}</span>}
                    </div>
                  );
                })()}
                {/* View toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setViewMode('cards')}
                    title="Cards view"
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="List view"
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Empty state */}
            {filteredProjects.length === 0 && data.customers.length === 0 && (
              <div className="text-center py-20 rounded-2xl border bg-white">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
                <Link href="/projects/new">
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                    <Plus className="h-4 w-4" /> Create First Project
                  </Button>
                </Link>
              </div>
            )}

            {/* ── List view (all filtered projects, RAG-sorted) ── */}
            {viewMode === 'list' && filteredProjects.length > 0 && (() => {
              const sorted = [...filteredProjects].sort((a, b) => {
                const order = { red: 0, amber: 1, green: 2 };
                if (order[a.rag] !== order[b.rag]) return order[a.rag] - order[b.rag];
                // Within same RAG: overdue first, then by days ascending
                const da = a.days_until_deadline ?? 9999;
                const db = b.days_until_deadline ?? 9999;
                return da - db;
              });
              return (
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                  {/* Table header */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    <div className="w-16 shrink-0">Status</div>
                    <div className="flex-1">Project</div>
                    <div className="w-24 shrink-0 hidden md:block">Phase</div>
                    <div className="w-28 shrink-0 hidden lg:block">Progress</div>
                    <div className="w-28 shrink-0 hidden xl:block">Deadline</div>
                    <div className="w-16 shrink-0">Alerts</div>
                    <div className="w-24 shrink-0 hidden xl:block">PM</div>
                  </div>
                  {sorted.map(p => <ProjectListRow key={p.id} p={p} />)}
                </div>
              );
            })()}

            {/* All customers view */}
            {viewMode === 'cards' && showAllCustomers && data.customers.map((c, i) => (
              <CustomerSection key={c.id} customer={c} defaultOpen={i === 0} />
            ))}

            {/* Single customer view */}
            {viewMode === 'cards' && showSingleCustomer && activeCustomer && (
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-xl ${avatarBg(activeCustomer.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                    {initials(activeCustomer.name)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{activeCustomer.name}</h3>
                    {activeCustomer.industry && (
                      <Badge className={`text-[10px] mt-0.5 ${INDUSTRY_COLOR[activeCustomer.industry] ?? 'bg-slate-100 text-slate-600'}`}>
                        {activeCustomer.industry}
                      </Badge>
                    )}
                  </div>
                  <Link href="/customers" className="ml-auto text-xs text-blue-600 hover:underline">Edit customer →</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activeCustomer.projects.map(p => <ProjectCard key={p.id} p={p} />)}
                  <Link href="/projects/new">
                    <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors p-4 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-500 cursor-pointer h-full min-h-[120px]">
                      <Plus className="h-4 w-4" /> New Project
                    </div>
                  </Link>
                </div>
              </div>
            )}

            {/* Unassigned view */}
            {viewMode === 'cards' && showNoCustomer && (
              <div className="bg-white rounded-2xl border p-6">
                <h3 className="font-bold text-slate-700 mb-4">Unassigned Projects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data.noCustomerProjects.map(p => <ProjectCard key={p.id} p={p} />)}
                </div>
              </div>
            )}

            {/* Unassigned projects at bottom when viewing all (cards) */}
            {viewMode === 'cards' && showAllCustomers && data.noCustomerProjects.length > 0 && (
              <CustomerSection
                customer={{ id: 0, name: 'Unassigned Projects', industry: '', projects: data.noCustomerProjects }}
                defaultOpen={false}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
