'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Plus, Calendar, User, Building2, ShieldAlert, Bug, TrendingUp,
  FolderOpen, ChevronDown, ChevronUp, Activity, AlertCircle,
  LayoutGrid, List, FileBarChart2, ArrowRight, CheckCircle2,
  Clock, Zap, Target, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProjectRow = {
  id: number; name: string; client: string; customer_id: number | null;
  program_name: string; program_industry: string;
  pm_name: string; start_date: string; end_date: string;
  current_phase: string; description: string;
  open_risks: number; open_issues: number;
  completion_pct: number; total_activities: number; done_activities: number;
  rag: 'red' | 'amber' | 'green';
  days_until_deadline: number | null;
};
type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
type PortfolioData = {
  projects: ProjectRow[];
  programs: ProgramGroup[];
  noProgramProjects: ProjectRow[];
  phaseDist: { phase: string; count: number }[];
  programBar: { name: string; count: number; active: number }[];
  kpi: {
    totalProjects: number; totalPrograms: number;
    totalOpenRisks: number; totalOpenIssues: number;
    avgCompletion: number; activeProjects: number;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning:   'bg-blue-100 text-blue-700 border-blue-200',
  Execution:  'bg-amber-100 text-amber-700 border-amber-200',
  Closing:    'bg-green-100 text-green-700 border-green-200',
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
function projectHealthScore(p: ProjectRow): number {
  if (p.rag === 'red')   return Math.min(40, p.completion_pct * 0.4);
  if (p.rag === 'amber') return 40 + Math.round(p.completion_pct * 0.4);
  return 65 + Math.round(p.completion_pct * 0.35);
}
function healthLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'text-green-600' };
  if (score >= 65) return { label: 'Good',      color: 'text-blue-600' };
  if (score >= 45) return { label: 'Fair',       color: 'text-amber-600' };
  return               { label: 'Critical',     color: 'text-red-600' };
}
function healthBarColor(score: number) {
  if (score >= 85) return 'bg-green-500';
  if (score >= 65) return 'bg-blue-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

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

// ─── Health Score Arc (SVG) ───────────────────────────────────────────────────
function HealthScoreArc({ score }: { score: number }) {
  const r = 52, cx = 64, cy = 64;
  const startAngle = -210, totalAngle = 240;
  const pct = score / 100;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (a1: number, a2: number, color: string) => {
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2));
    const y2 = cy + r * Math.sin(toRad(a2));
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return <path d={`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" />;
  };
  const fillEnd = startAngle + totalAngle * pct;
  const { label, color } = healthLabel(score);
  const arcColor = score >= 85 ? '#22c55e' : score >= 65 ? '#3b82f6' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="100" viewBox="0 0 128 110">
        {arcPath(startAngle, startAngle + totalAngle, '#e2e8f0')}
        {score > 0 && arcPath(startAngle, fillEnd, arcColor)}
        <text x="64" y="68" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1e293b">{score}</text>
        <text x="64" y="82" textAnchor="middle" fontSize="9" fill="#94a3b8">out of 100</text>
      </svg>
      <span className={`text-sm font-bold -mt-1 ${color}`}>{label}</span>
    </div>
  );
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 80, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────
function ProjectListRow({ p }: { p: ProjectRow }) {
  const dl = p.days_until_deadline;
  const isOverdue = dl !== null && dl < 0;
  const isWarning = dl !== null && dl >= 0 && dl <= 14;
  return (
    <Link href={`/projects/${p.id}`}>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer group ${isOverdue ? 'bg-red-50/30' : ''}`}>
        <div className="w-16 shrink-0"><RagBadge rag={p.rag} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">{p.name}</p>
          {(p.program_name || p.client) && (
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5" />{p.program_name || p.client}
            </p>
          )}
        </div>
        <div className="w-24 shrink-0 hidden md:block">
          <Badge className={`text-[10px] ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>{p.current_phase}</Badge>
        </div>
        <div className="w-28 shrink-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
              <div className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-400' : 'bg-slate-300'}`} style={{ width: `${p.completion_pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 font-medium shrink-0">{p.completion_pct}%</span>
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5">{p.done_activities}/{p.total_activities} done</p>
        </div>
        <div className="w-28 shrink-0 hidden xl:flex flex-col items-end">
          {dl !== null ? (
            <span className={`text-xs font-semibold flex items-center gap-1 ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              <Calendar className="h-3 w-3" />
              {isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
            </span>
          ) : <span className="text-xs text-slate-300">—</span>}
          {p.end_date && <span className="text-[10px] text-slate-300">{p.end_date}</span>}
        </div>
        <div className="w-16 shrink-0 flex flex-col items-end gap-0.5">
          {p.open_risks > 0 && <span className="flex items-center gap-1 text-[10px] text-red-500"><ShieldAlert className="h-3 w-3" />{p.open_risks}</span>}
          {p.open_issues > 0 && <span className="flex items-center gap-1 text-[10px] text-violet-500"><Bug className="h-3 w-3" />{p.open_issues}</span>}
          {p.open_risks === 0 && p.open_issues === 0 && <span className="text-[10px] text-green-500">✓</span>}
        </div>
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
          <Badge className={`text-[10px] shrink-0 ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>{p.current_phase}</Badge>
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
            <div className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${p.completion_pct}%` }} />
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

// ─── Program section ──────────────────────────────────────────────────────────
function ProgramSection({ program, defaultOpen }: { program: ProgramGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const phases = ['Initiation','Planning','Execution','Closing'];
  const phaseCounts = Object.fromEntries(phases.map(ph => [ph, program.projects.filter(p => p.current_phase === ph).length]));
  const openRisks  = program.projects.reduce((s, p) => s + p.open_risks, 0);
  const openIssues = program.projects.reduce((s, p) => s + p.open_issues, 0);
  const avgPct = program.projects.length ? Math.round(program.projects.reduce((s, p) => s + p.completion_pct, 0) / program.projects.length) : 0;
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors text-left">
        <div className={`w-10 h-10 rounded-xl ${avatarBg(program.name)} flex items-center justify-center text-white font-bold shrink-0`}>{initials(program.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{program.name}</span>
            {program.industry && <Badge className={`text-[10px] ${INDUSTRY_COLOR[program.industry] ?? 'bg-slate-100 text-slate-600'}`}>{program.industry}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{program.projects.length} projects</span>
            {phases.map(ph => phaseCounts[ph] > 0 && <span key={ph} className={`px-1.5 py-px rounded text-[10px] font-semibold ${PHASE_COLOR[ph]}`}>{phaseCounts[ph]} {ph}</span>)}
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
            {program.projects.map(p => <ProjectCard key={p.id} p={p} />)}
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [meUser, setMeUser] = useState<{ display_name: string; username: string; onboarding_completed: number } | null>(null);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => {
    loadPortfolio();
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => {
      if (u?.company_name) setCompanyName(u.company_name);
      if (u) setMeUser(u);
    });
  }, [loadPortfolio]);

  useEffect(() => {
    if (!loading && data !== null && meUser !== null) {
      if (!meUser.onboarding_completed && data.projects.length === 0) {
        setShowOnboarding(true);
      }
    }
  }, [loading, data, meUser]);

  const activeProgram = useMemo(() => {
    if (selectedProgramId === null || !data) return null;
    return data.programs.find(c => c.id === selectedProgramId) ?? null;
  }, [data, selectedProgramId]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    if (selectedProgramId === null) return data.projects;
    if (selectedProgramId === 0) return data.noProgramProjects;
    return activeProgram?.projects ?? [];
  }, [data, selectedProgramId, activeProgram]);

  // ── Derived analytics ──────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const ps = filteredProjects;
    const red   = ps.filter(p => p.rag === 'red').length;
    const amber = ps.filter(p => p.rag === 'amber').length;
    const green = ps.filter(p => p.rag === 'green').length;
    const total = ps.length;
    const healthScore = total === 0 ? 0 : Math.round((green * 100 + amber * 55 + red * 15) / total);

    const totalActivities = ps.reduce((s, p) => s + p.total_activities, 0);
    const doneActivities  = ps.reduce((s, p) => s + p.done_activities, 0);
    const inProgress = ps.filter(p => p.current_phase === 'Execution').length;
    const planning   = ps.filter(p => p.current_phase === 'Planning').length;
    const initiation = ps.filter(p => p.current_phase === 'Initiation').length;
    const closing    = ps.filter(p => p.current_phase === 'Closing').length;

    const totalOpenRisks  = ps.reduce((s, p) => s + p.open_risks, 0);
    const totalOpenIssues = ps.reduce((s, p) => s + p.open_issues, 0);
    const avgCompletion   = total ? Math.round(ps.reduce((s, p) => s + p.completion_pct, 0) / total) : 0;
    const overdueCount    = ps.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0).length;

    const byHealthScore = [...ps]
      .map(p => ({ ...p, hScore: projectHealthScore(p) }))
      .sort((a, b) => b.hScore - a.hScore)
      .slice(0, 8);

    const topRiskyProjects = [...ps]
      .filter(p => p.open_risks > 0 || p.open_issues > 0)
      .sort((a, b) => {
        const order = { red: 0, amber: 1, green: 2 };
        return order[a.rag] - order[b.rag];
      })
      .slice(0, 4);

    return {
      healthScore, red, amber, green, total,
      totalActivities, doneActivities, inProgress, planning, initiation, closing,
      totalOpenRisks, totalOpenIssues, avgCompletion, overdueCount,
      byHealthScore, topRiskyProjects,
      totalPrograms: data?.kpi.totalPrograms ?? 0,
    };
  }, [filteredProjects, data]);

  const filteredPhaseDist = useMemo(() => ['Initiation','Planning','Execution','Closing'].map(phase => ({
    phase, count: filteredProjects.filter(p => p.current_phase === phase).length,
  })), [filteredProjects]);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading portfolio...</p>
          </div>
        </main>
      </div>
    );
  }
  if (!data) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const showAllPrograms   = selectedProgramId === null;
  const showSingleProgram = selectedProgramId !== null && selectedProgramId !== 0 && activeProgram;
  const showNoProgram     = selectedProgramId === 0;

  // Fake sparkline seeds (visual only — based on health score)
  const riskSpark  = [3,5,4,7,6,analytics.totalOpenRisks || 4];
  const issueSpark = [2,3,5,4,3,analytics.totalOpenIssues || 2];
  const progSpark  = [30,38,45,52,60,analytics.avgCompletion || 55];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {showOnboarding && meUser && (
        <OnboardingModal
          userName={meUser.display_name || meUser.username || 'there'}
          onComplete={() => { setShowOnboarding(false); loadPortfolio(); }}
        />
      )}
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">{dateStr}</p>
              <h1 className="text-2xl font-bold text-slate-900">Portfolio Health Check</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                AI-powered workspace analysis · {companyName || 'All Projects'}
                {activeProgram && <> · <span className="text-blue-600 font-semibold">{activeProgram.name}</span></>}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link href="/portfolio/report">
                <Button variant="outline" className="h-9 text-sm gap-2">
                  <FileBarChart2 className="h-4 w-4 text-blue-500" /> Portfolio Report
                </Button>
              </Link>
              <Link href="/programs">
                <Button variant="outline" className="h-9 text-sm gap-2">
                  <Building2 className="h-4 w-4" /> Programs
                </Button>
              </Link>
              <Link href="/projects/new">
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
                  <Plus className="h-4 w-4" /> New Project
                </Button>
              </Link>
            </div>
          </div>

          {/* ── Program tabs ── */}
          <div className="bg-white rounded-2xl border p-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setSelectedProgramId(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${selectedProgramId === null ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <LayoutGrid className="h-4 w-4" /> All
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedProgramId === null ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{data.projects.length}</span>
              </button>
              {data.programs.length > 0 && <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />}
              {data.programs.map(c => {
                const isActive = selectedProgramId === c.id;
                return (
                  <button key={c.id} onClick={() => setSelectedProgramId(isActive ? null : c.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                    <div className={`w-5 h-5 rounded-md ${avatarBg(c.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{initials(c.name)}</div>
                    <span className="max-w-[120px] truncate">{c.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c.projects.length}</span>
                  </button>
                );
              })}
              {data.noProgramProjects.length > 0 && (
                <button onClick={() => setSelectedProgramId(selectedProgramId === 0 ? null : 0)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${selectedProgramId === 0 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>
                  Unassigned
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedProgramId === 0 ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{data.noProgramProjects.length}</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Top 4 health KPI cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Overall Health Score */}
            <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-2 shadow-sm">
              <div className="w-full flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-700">Overall Health Score</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Workspace</span>
              </div>
              <HealthScoreArc score={analytics.healthScore} />
              <p className="text-xs text-slate-400 text-center">
                {analytics.green} healthy · {analytics.amber} at risk · {analytics.red} critical
              </p>
            </div>

            {/* Projects at Risk */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">Projects at Risk</p>
                  <p className="text-[11px] text-slate-400">RED + AMBER status</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900">{analytics.red + analytics.amber}</p>
                  <p className="text-xs text-slate-400 mt-1">of {analytics.total} projects</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Spark data={riskSpark} color="#ef4444" />
                  {analytics.red > 0
                    ? <span className="text-[10px] text-red-500 font-semibold">{analytics.red} critical</span>
                    : <span className="text-[10px] text-green-500 font-semibold">None critical</span>}
                </div>
              </div>
              {analytics.overdueCount > 0 && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {analytics.overdueCount} project{analytics.overdueCount > 1 ? 's' : ''} overdue
                </div>
              )}
            </div>

            {/* Open Issues */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">Open Issues & Risks</p>
                  <p className="text-[11px] text-slate-400">Across all projects</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Bug className="h-4 w-4 text-orange-500" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900">{analytics.totalOpenRisks + analytics.totalOpenIssues}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {analytics.totalOpenRisks} risks · {analytics.totalOpenIssues} issues
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Spark data={issueSpark} color="#f97316" />
                  <span className={`text-[10px] font-semibold ${analytics.totalOpenRisks + analytics.totalOpenIssues > 5 ? 'text-orange-500' : 'text-green-500'}`}>
                    {analytics.totalOpenRisks + analytics.totalOpenIssues > 5 ? 'High impact' : 'Under control'}
                  </span>
                </div>
              </div>
            </div>

            {/* Avg Progress */}
            <div className="bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">Avg. Progress</p>
                  <p className="text-[11px] text-slate-400">Portfolio completion</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-slate-900">{analytics.avgCompletion}%</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {analytics.doneActivities}/{analytics.totalActivities} activities done
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Spark data={progSpark} color="#3b82f6" />
                  <span className={`text-[10px] font-semibold ${analytics.avgCompletion >= 60 ? 'text-blue-500' : 'text-amber-500'}`}>
                    {analytics.avgCompletion >= 60 ? 'On track' : 'Needs attention'}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${analytics.avgCompletion}%` }} />
              </div>
            </div>
          </div>

          {/* ── Middle row: Activity Flow + Health by Project ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

            {/* Activity Flow */}
            <div className="xl:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Activity Flow</h3>
                  <p className="text-[11px] text-slate-400">Projects by phase</p>
                </div>
                <Activity className="h-4 w-4 text-slate-300" />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Initiation', value: analytics.initiation, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', bar: 'bg-purple-500' },
                  { label: 'Planning',   value: analytics.planning,   color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',   bar: 'bg-blue-500' },
                  { label: 'Execution',  value: analytics.inProgress, color: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  bar: 'bg-amber-500' },
                  { label: 'Closing',    value: analytics.closing,    color: 'bg-green-50 border-green-200',   text: 'text-green-700',  bar: 'bg-green-500' },
                ].map(({ label, value, color, text, bar }) => (
                  <div key={label} className={`rounded-xl border p-3 ${color}`}>
                    <p className={`text-2xl font-bold ${text}`}>{value}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${text} opacity-80`}>{label}</p>
                    <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
                      <div className={`h-full ${bar} rounded-full`} style={{ width: analytics.total ? `${(value / analytics.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Phase bar chart */}
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={filteredPhaseDist} barGap={4}>
                  <XAxis dataKey="phase" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis hide allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {filteredPhaseDist.map(d => (
                      <Cell key={d.phase} fill={
                        d.phase === 'Initiation' ? '#a855f7' :
                        d.phase === 'Planning'   ? '#3b82f6' :
                        d.phase === 'Execution'  ? '#f59e0b' : '#22c55e'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {analytics.totalActivities > 0 && (
                <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {Math.round((analytics.doneActivities / analytics.totalActivities) * 100)}% of all activities completed across portfolio
                </div>
              )}
            </div>

            {/* Health by Project */}
            <div className="xl:col-span-3 bg-white rounded-2xl border p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Health by Project</h3>
                  <p className="text-[11px] text-slate-400">Sorted by health score</p>
                </div>
                <Link href={filteredProjects.length > 0 ? '#projects' : '/projects/new'} className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {analytics.byHealthScore.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No projects yet</div>
              ) : (
                <div className="space-y-3">
                  {analytics.byHealthScore.map(p => {
                    const hs = p.hScore;
                    const { label, color } = healthLabel(hs);
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`}>
                        <div className="flex items-center gap-3 group hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">
                          <div className={`w-7 h-7 rounded-lg ${avatarBg(p.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                            {initials(p.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">{p.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-bold ${color}`}>{label}</span>
                                <span className="text-xs font-bold text-slate-700 w-6 text-right">{hs}</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${healthBarColor(hs)}`} style={{ width: `${hs}%` }} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom row: Top Risks + Recommendations ── */}
          {(analytics.topRiskyProjects.length > 0 || analytics.total > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Top At-Risk Projects */}
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">Needs Attention</h3>
                    <p className="text-[11px] text-slate-400">Projects requiring immediate action</p>
                  </div>
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
                {analytics.topRiskyProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <CheckCircle2 className="h-8 w-8 text-green-400" />
                    <p className="text-sm text-slate-400">All projects are on track</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {analytics.topRiskyProjects.map(p => (
                      <Link key={p.id} href={`/projects/${p.id}`}>
                        <div className="flex items-center gap-3 p-3 rounded-xl border hover:border-blue-200 hover:bg-blue-50/30 transition-colors cursor-pointer group">
                          <RagBadge rag={p.rag} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">{p.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span className={`${PHASE_COLOR[p.current_phase] ?? ''} px-1.5 rounded text-[9px]`}>{p.current_phase}</span>
                              {p.open_risks > 0 && <span className="text-red-400 flex items-center gap-0.5"><ShieldAlert className="h-2.5 w-2.5" />{p.open_risks}R</span>}
                              {p.open_issues > 0 && <span className="text-violet-400 flex items-center gap-0.5"><Bug className="h-2.5 w-2.5" />{p.open_issues}I</span>}
                              {p.days_until_deadline !== null && p.days_until_deadline < 0 && (
                                <span className="text-red-500 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{Math.abs(p.days_until_deadline)}d overdue</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-slate-700">{p.completion_pct}%</p>
                            <p className="text-[10px] text-slate-400">done</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-2xl border p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-700">Top Recommendations</h3>
                    <p className="text-[11px] text-slate-400">Data-driven action items</p>
                  </div>
                  <Zap className="h-4 w-4 text-amber-400" />
                </div>
                <div className="space-y-3">
                  {analytics.red > 0 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                      <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-red-800">Address critical projects</p>
                        <p className="text-[11px] text-red-600 mt-0.5">{analytics.red} project{analytics.red > 1 ? 's are' : ' is'} in RED status. Immediate escalation recommended.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-red-300 shrink-0 self-center" />
                    </div>
                  )}
                  {analytics.totalOpenRisks > 3 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-orange-800">Reduce open risks</p>
                        <p className="text-[11px] text-orange-600 mt-0.5">{analytics.totalOpenRisks} risks are unresolved. Review mitigation plans with project teams.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-orange-300 shrink-0 self-center" />
                    </div>
                  )}
                  {analytics.avgCompletion < 50 && analytics.total > 0 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-800">Accelerate delivery</p>
                        <p className="text-[11px] text-amber-600 mt-0.5">Portfolio avg. completion is {analytics.avgCompletion}%. Identify blockers slowing teams down.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-amber-300 shrink-0 self-center" />
                    </div>
                  )}
                  {analytics.red === 0 && analytics.totalOpenRisks <= 3 && analytics.avgCompletion >= 50 && (
                    <div className="flex gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                      <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-green-800">Portfolio is healthy</p>
                        <p className="text-[11px] text-green-600 mt-0.5">No critical issues detected. Keep monitoring progress and risks proactively.</p>
                      </div>
                    </div>
                  )}
                  <Link href="/portfolio/report">
                    <div className="flex gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Target className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-800">Generate AI portfolio report</p>
                        <p className="text-[11px] text-blue-600 mt-0.5">Get an executive summary with insights and action items powered by Claude.</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-blue-300 shrink-0 self-center" />
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── Project sections ── */}
          <div className="space-y-4" id="projects">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {selectedProgramId === null ? 'All Program Portfolios' : selectedProgramId === 0 ? 'Unassigned Projects' : `${activeProgram?.name ?? ''} — Projects`}
              </h2>
              <div className="flex items-center gap-2 ml-auto">
                {viewMode === 'list' && filteredProjects.length > 0 && (() => {
                  const red   = filteredProjects.filter(p => p.rag === 'red').length;
                  const amber = filteredProjects.filter(p => p.rag === 'amber').length;
                  const green = filteredProjects.filter(p => p.rag === 'green').length;
                  return (
                    <div className="flex items-center gap-2 text-[11px] font-semibold">
                      {red   > 0 && <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">🔴 {red}</span>}
                      {amber > 0 && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">🟡 {amber}</span>}
                      {green > 0 && <span className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🟢 {green}</span>}
                    </div>
                  );
                })()}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setViewMode('cards')} title="Cards view"
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setViewMode('list')} title="List view"
                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {filteredProjects.length === 0 && data.programs.length === 0 && (
              <div className="text-center py-20 rounded-2xl border bg-white">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
                <Link href="/projects/new">
                  <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" /> Create First Project</Button>
                </Link>
              </div>
            )}

            {viewMode === 'list' && filteredProjects.length > 0 && (() => {
              const sorted = [...filteredProjects].sort((a, b) => {
                const order = { red: 0, amber: 1, green: 2 };
                if (order[a.rag] !== order[b.rag]) return order[a.rag] - order[b.rag];
                return (a.days_until_deadline ?? 9999) - (b.days_until_deadline ?? 9999);
              });
              return (
                <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
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

            {viewMode === 'cards' && showAllPrograms && data.programs.map((c, i) => (
              <ProgramSection key={c.id} program={c} defaultOpen={i === 0} />
            ))}
            {viewMode === 'cards' && showSingleProgram && activeProgram && (
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 rounded-xl ${avatarBg(activeProgram.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>{initials(activeProgram.name)}</div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg">{activeProgram.name}</h3>
                    {activeProgram.industry && <Badge className={`text-[10px] mt-0.5 ${INDUSTRY_COLOR[activeProgram.industry] ?? 'bg-slate-100 text-slate-600'}`}>{activeProgram.industry}</Badge>}
                  </div>
                  <Link href="/programs" className="ml-auto text-xs text-blue-600 hover:underline">Edit program →</Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activeProgram.projects.map(p => <ProjectCard key={p.id} p={p} />)}
                  <Link href="/projects/new">
                    <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors p-4 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-500 cursor-pointer h-full min-h-[120px]">
                      <Plus className="h-4 w-4" /> New Project
                    </div>
                  </Link>
                </div>
              </div>
            )}
            {viewMode === 'cards' && showNoProgram && (
              <div className="bg-white rounded-2xl border p-6">
                <h3 className="font-bold text-slate-700 mb-4">Unassigned Projects</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data.noProgramProjects.map(p => <ProjectCard key={p.id} p={p} />)}
                </div>
              </div>
            )}
            {viewMode === 'cards' && showAllPrograms && data.noProgramProjects.length > 0 && (
              <ProgramSection program={{ id: 0, name: 'Unassigned Projects', industry: '', projects: data.noProgramProjects }} defaultOpen={false} />
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
