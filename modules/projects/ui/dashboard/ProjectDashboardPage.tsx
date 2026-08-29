'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  Activity, Zap, Calendar, User, BarChart2, DollarSign,
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
type Risk  = { id: number; risk_id: string; description: string; category: string; owner: string; status: string; due_date: string; };
type Issue = { id: number; issue_id: string; description: string; category: string; owner: string; status: string; due_date: string; };

// ─── Constants ────────────────────────────────────────────────────────────────
const PHASE_ORDER = ['Initializing','Architecture & Design','Setup & Infra','Development','Testing','UAT','Deployment','Closing'];

const STATUS_WEIGHTS: Record<string, number> = {
  'ANBM': 1, 'STAGING-READY4TEST': 0.6, 'Deployed': 1, 'Done': 1,
  'In Dev': 0.2, 'In development': 0.2, 'In Progress': 0.3, 'In Review': 0.5,
  'In Testing': 0.6, 'New': 0, 'PENDING': 0.5, 'UAT': 1, 'QC Done': 1,
  'Ready For Dev': 0.2, 'Ready for Test': 0.6, 'Testing': 0.6, 'To Do': 0.1,
  'To-do': 0.1, 'REFINEMENT': 0.1, 'Re-Open': 0.7, 'READY TO RELEASE': 1,
  'Passed QC': 1, 'READY4TEST': 0.6, 'READY FOR RELEASE': 1, 'Blocked': 0,
};

const STATUS_GROUPS: { key: string; label: string; color: string; statuses: string[] }[] = [
  { key: 'notStarted', label: 'Chưa làm',  color: '#94a3b8', statuses: ['New','To Do','To-do','REFINEMENT'] },
  { key: 'inDev',      label: 'Đang làm',  color: '#3b82f6', statuses: ['In Dev','In development','Ready For Dev','In Progress'] },
  { key: 'midway',     label: 'Giữa chừng',color: '#f59e0b', statuses: ['In Review','PENDING'] },
  { key: 'testing',    label: 'Đang test', color: '#8b5cf6', statuses: ['In Testing','Testing','Ready for Test','READY4TEST','STAGING-READY4TEST'] },
  { key: 'nearDone',   label: 'Gần xong',  color: '#f97316', statuses: ['Re-Open'] },
  { key: 'done',       label: 'Hoàn thành',color: '#22c55e', statuses: ['Done','UAT','Deployed','QC Done','READY TO RELEASE','READY FOR RELEASE','Passed QC','ANBM'] },
];

const STATUS_BADGE: Record<string, string> = {
  'Done': 'bg-green-100 text-green-700', 'Deployed': 'bg-green-100 text-green-700',
  'UAT': 'bg-green-100 text-green-700', 'QC Done': 'bg-green-100 text-green-700',
  'ANBM': 'bg-green-100 text-green-700', 'READY TO RELEASE': 'bg-green-100 text-green-700',
  'READY FOR RELEASE': 'bg-green-100 text-green-700', 'Passed QC': 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700', 'In Dev': 'bg-blue-100 text-blue-700',
  'In development': 'bg-blue-100 text-blue-700', 'Ready For Dev': 'bg-blue-100 text-blue-700',
  'In Review': 'bg-amber-100 text-amber-700', 'PENDING': 'bg-amber-100 text-amber-700',
  'In Testing': 'bg-purple-100 text-purple-700', 'Testing': 'bg-purple-100 text-purple-700',
  'Ready for Test': 'bg-purple-100 text-purple-700', 'READY4TEST': 'bg-purple-100 text-purple-700',
  'STAGING-READY4TEST': 'bg-purple-100 text-purple-700',
  'Re-Open': 'bg-orange-100 text-orange-700',
  'To-do': 'bg-slate-100 text-slate-600', 'To Do': 'bg-slate-100 text-slate-600',
  'New': 'bg-slate-100 text-slate-600', 'REFINEMENT': 'bg-slate-100 text-slate-600',
  'Blocked': 'bg-red-100 text-red-700',
};

// ─── Status Helpers ───────────────────────────────────────────────────────────
function getStatusWeight(status: string): number {
  return STATUS_WEIGHTS[status] ?? 0;
}
function isStatusComplete(status: string): boolean {
  return getStatusWeight(status) >= 1.0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function today0(): Date { const d = new Date(); d.setHours(0,0,0,0); return d; }
function daysFromNow(dateStr: string): number {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d.getTime() - today0().getTime()) / 86400000);
}
function isOverdue(act: Activity)   { return !isStatusComplete(act.status) && act.status !== 'Blocked' && !!act.plan_end && daysFromNow(act.plan_end) < 0; }
function isDueThisWeek(act: Activity) {
  const d = daysFromNow(act.plan_end);
  return !isStatusComplete(act.status) && !!act.plan_end && d >= 0 && d <= 7;
}
function isCompletedThisWeek(act: Activity) {
  if (!isStatusComplete(act.status) || !act.actual_end) return false;
  return daysFromNow(act.actual_end) >= -7 && daysFromNow(act.actual_end) <= 0;
}
function dateDiffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
function fmt(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function healthLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'text-green-600' };
  if (score >= 65) return { label: 'Good',      color: 'text-blue-600' };
  if (score >= 45) return { label: 'Fair',       color: 'text-amber-600' };
  return               { label: 'Critical',    color: 'text-red-600' };
}
function healthArcColor(score: number) {
  if (score >= 85) return '#22c55e';
  if (score >= 65) return '#3b82f6';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

// ─── Health Score Arc ─────────────────────────────────────────────────────────
function HealthScoreArc({ score }: { score: number }) {
  const r = 52, cx = 64, cy = 64;
  const startAngle = -210, totalAngle = 240;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (a1: number, a2: number, color: string) => {
    const x1 = cx + r * Math.cos(toRad(a1)), y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2)), y2 = cy + r * Math.sin(toRad(a2));
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return <path d={`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" />;
  };
  const fillEnd = startAngle + totalAngle * (score / 100);
  const { label, color } = healthLabel(score);
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="100" viewBox="0 0 128 110">
        {arcPath(startAngle, startAngle + totalAngle, '#e2e8f0')}
        {score > 0 && arcPath(startAngle, fillEnd, healthArcColor(score))}
        <text x="64" y="68" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1e293b">{score}</text>
        <text x="64" y="82" textAnchor="middle" fontSize="9" fill="#94a3b8">out of 100</text>
      </svg>
      <span className={`text-sm font-bold -mt-1 ${color}`}>{label}</span>
    </div>
  );
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 70, h = 24, pad = 2;
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

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────
function polarXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function slicePath(cx: number, cy: number, R: number, ir: number, a1: number, a2: number): string {
  const span = a2 - a1;
  if (span >= 359.99) return [`M ${cx} ${cy - R}`, `A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}`, `L ${cx - 0.01} ${cy - ir}`, `A ${ir} ${ir} 0 1 0 ${cx} ${cy - ir}`, 'Z'].join(' ');
  const [x1,y1] = polarXY(cx,cy,R,a1), [x2,y2] = polarXY(cx,cy,R,a2);
  const [x3,y3] = polarXY(cx,cy,ir,a2), [x4,y4] = polarXY(cx,cy,ir,a1);
  return `M${x1},${y1} A${R},${R},0,${span>180?1:0},1,${x2},${y2} L${x3},${y3} A${ir},${ir},0,${span>180?1:0},0,${x4},${y4} Z`;
}
function DonutChart({ slices, size = 120, center }: { slices: {label:string;value:number;color:string}[]; size?: number; center?: string }) {
  const total = slices.reduce((s,d) => s + d.value, 0);
  const cx = size/2, cy = size/2, R = size*0.4, ir = size*0.26;
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth={R-ir}/>
      <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={size*0.1} fill="#94a3b8">No data</text>
    </svg>
  );
  let angle = 0;
  return (
    <svg width={size} height={size}>
      {slices.filter(s=>s.value>0).map((s,i)=>{const sweep=(s.value/total)*360;const d=slicePath(cx,cy,R,ir,angle,angle+sweep);angle+=sweep;return <path key={i} d={d} fill={s.color}/>;} )}
      {center && (<><text x={cx} y={cy-6} textAnchor="middle" fontSize={size*0.16} fontWeight="700" fill="#0f172a">{center}</text><text x={cx} y={cy+12} textAnchor="middle" fontSize={size*0.09} fill="#64748b">total</text></>)}
    </svg>
  );
}

// ─── Paginator ────────────────────────────────────────────────────────────────
function Pager({ page, total, pageSize, onChange }: { page:number; total:number; pageSize:number; onChange:(p:number)=>void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
      <span>{page*pageSize+1}–{Math.min((page+1)*pageSize,total)} of {total}</span>
      <div className="flex gap-1">
        <button onClick={()=>onChange(Math.max(0,page-1))} disabled={page===0} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5"/></button>
        <span className="px-1 self-center">{page+1}/{pages}</span>
        <button onClick={()=>onChange(Math.min(pages-1,page+1))} disabled={page===pages-1} className="p-1 rounded hover:bg-slate-200 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5"/></button>
      </div>
    </div>
  );
}

// ─── SPI Badge ────────────────────────────────────────────────────────────────
function SpiBadge({ spi }: { spi: number | null }) {
  if (spi === null) return null;
  const { label, cls, Icon } = spi >= 1
    ? { label: `SPI ${spi.toFixed(2)} — Ahead`,    cls: 'bg-green-100 text-green-700 border-green-200', Icon: TrendingUp }
    : spi >= 0.8
    ? { label: `SPI ${spi.toFixed(2)} — On track`,  cls: 'bg-amber-100 text-amber-700 border-amber-200', Icon: Minus }
    : { label: `SPI ${spi.toFixed(2)} — Behind`,   cls: 'bg-red-100 text-red-700 border-red-200',   Icon: TrendingDown };
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

// ─── Phase Status (status-weight based) ──────────────────────────────────────
function PhaseStatus({ acts }: { acts: Activity[] }) {
  const doneActs  = acts.filter(a => isStatusComplete(a.status));
  const blocked   = acts.filter(a => a.status === 'Blocked');
  const weightSum = acts.reduce((s, a) => s + getStatusWeight(a.status), 0);
  const pct = acts.length ? Math.round((weightSum / acts.length) * 100) : 0;
  const label = doneActs.length === acts.length && acts.length > 0
    ? 'Hoàn thành'
    : blocked.length > 0 ? 'Blocked'
    : pct > 50 ? 'Đang tiến hành'
    : pct > 0  ? 'Mới bắt đầu'
    : 'Chưa bắt đầu';
  const lCls = doneActs.length === acts.length && acts.length > 0
    ? 'text-green-600'
    : blocked.length > 0 ? 'text-red-600'
    : pct > 50 ? 'text-blue-600'
    : pct > 0  ? 'text-amber-600'
    : 'text-slate-400';
  const barCls = doneActs.length === acts.length && acts.length > 0
    ? 'bg-green-500'
    : blocked.length > 0 ? 'bg-red-500'
    : pct > 50 ? 'bg-blue-500'
    : pct > 0  ? 'bg-amber-400'
    : 'bg-slate-200';
  return { pct, label, lCls, barCls, done: doneActs.length, blocked: blocked.length, total: acts.length };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [project,    setProject]    = useState<Project | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [team,       setTeam]       = useState<TeamMember[]>([]);
  const [risks,      setRisks]      = useState<Risk[]>([]);
  const [issues,     setIssues]     = useState<Issue[]>([]);
  const [overdueP,   setOverdueP]   = useState(0);
  const [dueWeekP,   setDueWeekP]   = useState(0);
  const [editOpen,   setEditOpen]   = useState(false);
  const [editForm,   setEditForm]   = useState<Partial<Project>>({});
  const [saving,     setSaving]     = useState(false);
  const [budget,     setBudget]     = useState<{ planned: number; actual: number; capex: number; opex: number } | null>(null);

  const load = useCallback(async () => {
    const [proj, acts, tm, rs, iss, bud] = await Promise.all([
      fetch(`/api/projects/${id}`).then(r=>r.json()),
      fetch(`/api/projects/${id}/activities`).then(r=>r.json()),
      fetch(`/api/projects/${id}/team`).then(r=>r.json()),
      fetch(`/api/projects/${id}/risks`).then(r=>r.json()),
      fetch(`/api/projects/${id}/issues`).then(r=>r.json()),
      fetch(`/api/projects/${id}/budget`).then(r=>r.ok?r.json():null),
    ]);
    setProject(proj);
    setActivities(Array.isArray(acts)?acts:[]);
    setTeam(Array.isArray(tm)?tm:[]);
    setRisks(Array.isArray(rs)?rs:[]);
    setIssues(Array.isArray(iss)?iss:[]);
    if (bud?.items) {
      const items = bud.items as { type: string; planned_amount: number; actual_amount: number }[];
      setBudget({
        planned: items.reduce((s: number, i: any) => s + Number(i.planned_amount), 0),
        actual:  items.reduce((s: number, i: any) => s + Number(i.actual_amount),  0),
        capex:   items.filter((i: any) => i.type === 'CAPEX').reduce((s: number, i: any) => s + Number(i.planned_amount), 0),
        opex:    items.filter((i: any) => i.type === 'OPEX').reduce((s: number, i: any)  => s + Number(i.planned_amount), 0),
      });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openEdit = () => {
    if (!project) return;
    setEditForm({ name:project.name, client:project.client, description:project.description, pm_name:project.pm_name, pm_email:project.pm_email, start_date:project.start_date, end_date:project.end_date, current_phase:project.current_phase });
    setEditOpen(true);
  };
  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(editForm) });
      setProject(await res.json());
      setEditOpen(false);
      toast.success('Project info updated');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  if (!project) return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
          <p className="text-slate-400 text-sm">Loading project...</p>
        </div>
      </div>
    );

  // ── Derived metrics (status-weight based) ────────────────────────────────
  const total    = activities.length;
  const done     = activities.filter(a => isStatusComplete(a.status)).length;
  const blocked  = activities.filter(a => a.status === 'Blocked').length;

  // Weighted progress: avg(statusWeight) * 100
  const weightedPct = total
    ? Math.round(activities.reduce((s, a) => s + getStatusWeight(a.status), 0) / total * 100)
    : 0;

  // Group counts for Activity Flow
  const groupCounts = STATUS_GROUPS.map(g => ({
    ...g,
    count: activities.filter(a => g.statuses.includes(a.status)).length,
  }));
  const openRisks  = risks.filter(r=>r.status==='Open'||r.status==='In Progress');
  const openIssues = issues.filter(i=>i.status==='Open'||i.status==='In Progress');

  let spi: number | null = null;
  if (project.start_date && project.end_date) {
    const dTotal   = dateDiffDays(project.start_date, project.end_date);
    const dElapsed = dateDiffDays(project.start_date, new Date().toISOString().slice(0,10));
    const timePct  = dTotal > 0 ? Math.max(0, Math.min(dElapsed/dTotal, 1))*100 : 0;
    if (timePct > 0) spi = Math.round((weightedPct/timePct)*100)/100;
  }

  const daysLeft = project.end_date ? daysFromNow(project.end_date) : null;
  const withPlanEnd = activities.filter(a=>a.plan_end);
  const onTime = withPlanEnd.filter(a => {
    if (isStatusComplete(a.status)) return !a.actual_end || daysFromNow(a.plan_end)>=daysFromNow(a.actual_end);
    return daysFromNow(a.plan_end) >= 0;
  }).length;
  const onTimePct = withPlanEnd.length ? Math.round((onTime/withPlanEnd.length)*100) : 100;

  const phasesInData  = [...new Set(activities.map(a=>a.phase))];
  const orderedPhases = [...PHASE_ORDER.filter(p=>phasesInData.includes(p)), ...phasesInData.filter(p=>!PHASE_ORDER.includes(p))];

  const pmMembers = team.filter(m=>m.domain==='PM'||m.role?.toLowerCase()==='pm'||m.role?.toLowerCase().includes('project manager'));
  const pmDisplay = pmMembers.length > 0 ? pmMembers.map(m=>m.name).join(', ') : (project.pm_name||null);

  const domainCount: Record<string,number> = {};
  for (const m of team) domainCount[m.domain] = (domainCount[m.domain]??0)+1;
  const domainEntries = Object.entries(domainCount).sort((a,b)=>b[1]-a[1]);
  const maxDomain = Math.max(1,...domainEntries.map(([,c])=>c));

  const overdue  = activities.filter(isOverdue).sort((a,b)=>daysFromNow(a.plan_end)-daysFromNow(b.plan_end));
  const dueWeek  = activities.filter(isDueThisWeek).sort((a,b)=>daysFromNow(a.plan_end)-daysFromNow(b.plan_end));
  const completedThisWeek = activities.filter(isCompletedThisWeek);
  const upcoming = activities.filter(a=>!isStatusComplete(a.status)&&a.deliverable&&a.plan_end&&daysFromNow(a.plan_end)>=0&&daysFromNow(a.plan_end)<=30).sort((a,b)=>daysFromNow(a.plan_end)-daysFromNow(b.plan_end)).slice(0,5);

  // Health score uses weighted progress
  const healthScore = Math.max(10, Math.min(100,
    100 - overdue.length*5 - blocked*8 - openRisks.length*4 - openIssues.length*3 - (onTimePct<60?15:onTimePct<80?5:0) - (spi!==null&&spi<0.8?10:0)
  ));

  const PAGE = 10;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 mb-1">Project Dashboard</p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
              {project.client && <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">{project.client}</Badge>}
              <Badge className="bg-blue-100 text-blue-700 text-xs">{project.current_phase}</Badge>
              <SpiBadge spi={spi} />
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-400">
              {pmDisplay && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3"/>
                  <Link href={`/projects/${id}/resources`} className="text-slate-600 font-medium hover:text-blue-600">{pmDisplay}</Link>
                </span>
              )}
              {project.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3"/>
                  {project.start_date} → {project.end_date || '?'}
                </span>
              )}
              {daysLeft !== null && (
                <span className={`font-semibold flex items-center gap-1 ${daysLeft<0?'text-red-600':daysLeft<=14?'text-amber-600':'text-slate-500'}`}>
                  <Clock className="h-3 w-3"/>
                  {daysLeft<0?`${Math.abs(daysLeft)}d overdue`:`${daysLeft}d remaining`}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5 h-8 text-xs">
              <Pencil className="h-3 w-3"/> Edit
            </Button>
            <Link href={`/projects/${id}/timeline`}>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <BarChart2 className="h-3 w-3"/> Timeline
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Top 4 Health KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Health Score */}
          <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-2 shadow-sm">
            <div className="w-full flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-700">Project Health</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Score</span>
            </div>
            <HealthScoreArc score={healthScore} />
            <p className="text-xs text-slate-400 text-center">
              {done}/{total} hoàn thành · {weightedPct}% weighted
            </p>
          </div>

          {/* Schedule Performance */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Schedule Performance</p>
                <p className="text-[11px] text-slate-400">vs timeline elapsed</p>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${spi===null?'bg-slate-50':spi>=1?'bg-green-50':spi>=0.8?'bg-amber-50':'bg-red-50'}`}>
                {spi===null?<Minus className="h-4 w-4 text-slate-400"/>:spi>=1?<TrendingUp className="h-4 w-4 text-green-500"/>:spi>=0.8?<Minus className="h-4 w-4 text-amber-500"/>:<TrendingDown className="h-4 w-4 text-red-500"/>}
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-slate-900">{spi!==null?spi.toFixed(2):'—'}</p>
                <p className="text-xs text-slate-400 mt-1">SPI · {onTimePct}% on-time rate</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Spark data={[0.7,0.8,0.85,0.9,spi??1].map(v=>v*100)} color={spi===null?'#94a3b8':spi>=1?'#22c55e':spi>=0.8?'#f59e0b':'#ef4444'} />
                <span className={`text-[10px] font-semibold ${spi===null?'text-slate-400':spi>=1?'text-green-600':spi>=0.8?'text-amber-600':'text-red-600'}`}>
                  {spi===null?'No dates':spi>=1?'Ahead of schedule':spi>=0.8?'On track':'Behind schedule'}
                </span>
              </div>
            </div>
          </div>

          {/* Open Risks & Issues */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Open Risks & Issues</p>
                <p className="text-[11px] text-slate-400">Requiring attention</p>
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${openRisks.length+openIssues.length>0?'bg-orange-50':'bg-green-50'}`}>
                <ShieldAlert className={`h-4 w-4 ${openRisks.length+openIssues.length>0?'text-orange-500':'text-green-500'}`}/>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-slate-900">{openRisks.length+openIssues.length}</p>
                <p className="text-xs text-slate-400 mt-1">{openRisks.length} risks · {openIssues.length} issues</p>
              </div>
              <div className="flex flex-col gap-2">
                <Link href={`/projects/${id}/risks`} className="flex items-center gap-1.5 text-[11px] bg-red-50 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-100 transition-colors">
                  <ShieldAlert className="h-3 w-3"/>{openRisks.length} risks
                </Link>
                <Link href={`/projects/${id}/risks`} className="flex items-center gap-1.5 text-[11px] bg-violet-50 text-violet-600 px-2.5 py-1 rounded-lg hover:bg-violet-100 transition-colors">
                  <Bug className="h-3 w-3"/>{openIssues.length} issues
                </Link>
              </div>
            </div>
          </div>

          {/* Work Progress (status-weight based) */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Work Progress</p>
                <p className="text-[11px] text-slate-400">Weighted by status</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Target className="h-4 w-4 text-blue-500"/>
              </div>
            </div>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-4xl font-bold text-slate-900">{weightedPct}%</p>
                <p className="text-xs text-slate-400 mt-1">{done}/{total} hoàn thành</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Spark data={[10,20,30,40,50,weightedPct||0]} color="#3b82f6"/>
                {blocked>0&&<span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5"><Flame className="h-2.5 w-2.5"/>{blocked} blocked</span>}
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{width:`${weightedPct}%`}}/>
            </div>
          </div>
        </div>

        {/* ── Budget Summary ── */}
        {budget !== null && budget.planned > 0 && (() => {
          const utilPct = budget.planned > 0 ? Math.round((budget.actual / budget.planned) * 100) : 0;
          const remaining = budget.planned - budget.actual;
          const fmtK = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : v.toFixed(0);
          return (
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600"/>
                  </div>
                  <span className="text-sm font-bold text-slate-700">Budget & Cost</span>
                </div>
                <Link href={`/projects/${id}/budget`} className="text-[11px] text-blue-600 hover:underline font-medium">View details →</Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total Budget</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{fmtK(budget.planned)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Planned</p>
                </div>
                <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Spent</p>
                  <p className={`text-xl font-bold mt-0.5 ${budget.actual > budget.planned ? 'text-red-600' : 'text-slate-800'}`}>{fmtK(budget.actual)}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Actual cost</p>
                </div>
                <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Remaining</p>
                  <p className={`text-xl font-bold mt-0.5 ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{remaining < 0 ? '-' : ''}{fmtK(Math.abs(remaining))}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{remaining < 0 ? 'Over budget' : 'Available'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Utilization</p>
                  <p className={`text-xl font-bold mt-0.5 ${utilPct > 100 ? 'text-red-600' : utilPct > 80 ? 'text-amber-600' : 'text-slate-800'}`}>{utilPct}%</p>
                  <div className="mt-1.5 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${utilPct > 100 ? 'bg-red-500' : utilPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width:`${Math.min(utilPct,100)}%`}}/>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Activity Flow + Phase Progress ── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Activity Flow — 6 status groups */}
          <div className="xl:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Activity Flow</h3>
                <p className="text-[11px] text-slate-400">Phân nhóm theo trạng thái</p>
              </div>
              <Activity className="h-4 w-4 text-slate-300"/>
            </div>

            {/* 6-group grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {groupCounts.map(g => (
                <div key={g.key} className="rounded-xl border p-2.5" style={{backgroundColor:`${g.color}12`, borderColor:`${g.color}30`}}>
                  <p className="text-xl font-bold" style={{color: g.color}}>{g.count}</p>
                  <p className="text-[11px] font-medium mt-0.5 opacity-80" style={{color: g.color}}>{g.label}</p>
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{backgroundColor:`${g.color}20`}}>
                    <div className="h-full rounded-full" style={{width:total?`${(g.count/total)*100}%`:'0%', backgroundColor: g.color}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Blocked row (special) */}
            {blocked > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 mb-4 flex items-center gap-2">
                <Flame className="h-3.5 w-3.5 text-red-500 shrink-0"/>
                <span className="text-xs font-semibold text-red-700">{blocked} Blocked</span>
                <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden ml-1">
                  <div className="h-full bg-red-500 rounded-full" style={{width:total?`${(blocked/total)*100}%`:'0%'}}/>
                </div>
              </div>
            )}

            {/* Donut + legend */}
            <div className="flex items-center gap-3">
              <DonutChart size={96} center={String(total)} slices={[
                ...groupCounts.map(g => ({ label: g.label, value: g.count, color: g.color })),
                ...(blocked > 0 ? [{ label: 'Blocked', value: blocked, color: '#ef4444' }] : []),
              ]}/>
              <div className="flex-1 space-y-1.5">
                {groupCounts.filter(g => g.count > 0).map(g => (
                  <div key={g.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{background: g.color}}/>
                      <span className="text-slate-600">{g.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:total?`${(g.count/total)*100}%`:'0%', background: g.color}}/>
                      </div>
                      <span className="font-mono w-4 text-right text-slate-500">{g.count}</span>
                    </div>
                  </div>
                ))}
                {blocked > 0 && (
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0 bg-red-500"/>
                      <span className="text-slate-600">Blocked</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{width:total?`${(blocked/total)*100}%`:'0%'}}/>
                      </div>
                      <span className="font-mono w-4 text-right text-slate-500">{blocked}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Phase Progress — status-weight based % */}
          <div className="xl:col-span-3 bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Phase Progress</h3>
                <p className="text-[11px] text-slate-400">Current: <span className="text-blue-600 font-semibold">{project.current_phase}</span></p>
              </div>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
            {orderedPhases.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No activities yet</p>
            ) : (
              <div className="space-y-3">
                {orderedPhases.map(phase=>{
                  const acts = activities.filter(a=>a.phase===phase);
                  const {pct,label,lCls,barCls,done:d,blocked:bl,total:tot} = PhaseStatus({acts});
                  const isCurrent = phase===project.current_phase;
                  return (
                    <div key={phase} className={`rounded-xl p-3 transition-colors ${isCurrent?'bg-blue-50/60 border border-blue-100':'hover:bg-slate-50'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isCurrent&&<span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"/>}
                          <span className={`text-xs font-semibold ${isCurrent?'text-blue-700':'text-slate-600'}`}>{phase}</span>
                          {isCurrent&&<Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Current</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-400">{d}/{tot}{bl>0&&<span className="text-red-500 ml-1">· {bl} blocked</span>}</span>
                          <span className={`text-[11px] font-semibold ${lCls}`}>{label}</span>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barCls}`} style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom row: Needs Attention + Recommendations ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Needs Attention */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Needs Attention</h3>
                <p className="text-[11px] text-slate-400">Active alerts for this project</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-amber-400"/>
            </div>
            {blocked===0&&overdue.length===0&&openRisks.length===0?(
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-400"/>
                <p className="text-sm text-slate-400">All clear — project is on track</p>
              </div>
            ):(
              <div className="space-y-2">
                {blocked>0&&(
                  <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0"><Flame className="h-3.5 w-3.5 text-red-600"/></div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-800">{blocked} activity blocked</p>
                      <p className="text-[11px] text-red-600 mt-0.5">Immediate action required to unblock the team.</p>
                    </div>
                  </div>
                )}
                {overdue.length>0&&(
                  <div className="flex gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0"><Clock className="h-3.5 w-3.5 text-orange-600"/></div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-orange-800">{overdue.length} overdue task{overdue.length>1?'s':''}</p>
                      <p className="text-[11px] text-orange-600 mt-0.5">Tasks past their planned end date. Update or escalate.</p>
                    </div>
                  </div>
                )}
                {openRisks.length>0&&(
                  <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><ShieldAlert className="h-3.5 w-3.5 text-amber-600"/></div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-800">{openRisks.length} open risk{openRisks.length>1?'s':''}</p>
                      <p className="text-[11px] text-amber-600 mt-0.5">Review mitigation plans and update statuses.</p>
                    </div>
                    <Link href={`/projects/${id}/risks`} className="text-[10px] text-amber-600 hover:underline self-center whitespace-nowrap">View →</Link>
                  </div>
                )}
                {daysLeft!==null&&daysLeft<0&&(
                  <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0"><Calendar className="h-3.5 w-3.5 text-red-600"/></div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-red-800">Project deadline exceeded</p>
                      <p className="text-[11px] text-red-600 mt-0.5">{Math.abs(daysLeft)} days past the planned end date.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Recommendations</h3>
                <p className="text-[11px] text-slate-400">Suggested next actions</p>
              </div>
              <Zap className="h-4 w-4 text-amber-400"/>
            </div>
            <div className="space-y-2">
              {completedThisWeek.length>0&&(
                <div className="flex gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0"><CheckCircle2 className="h-3.5 w-3.5 text-green-600"/></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-green-800">{completedThisWeek.length} completed this week</p>
                    <p className="text-[11px] text-green-600 mt-0.5">Great momentum — keep it going!</p>
                  </div>
                </div>
              )}
              {upcoming.length>0&&(
                <div className="flex gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><Target className="h-3.5 w-3.5 text-blue-600"/></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-blue-800">{upcoming.length} deliverable{upcoming.length>1?'s':''} due in 30 days</p>
                    <p className="text-[11px] text-blue-600 mt-0.5">Ensure team is aligned on upcoming milestones.</p>
                  </div>
                </div>
              )}
              {team.length===0&&(
                <div className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0"><Users className="h-3.5 w-3.5 text-slate-600"/></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-700">No team members yet</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Add team members in the Resource Plan.</p>
                  </div>
                  <Link href={`/projects/${id}/resources`} className="text-[10px] text-blue-600 hover:underline self-center whitespace-nowrap">Add →</Link>
                </div>
              )}
              <Link href={`/projects/${id}/reports`}>
                <div className="flex gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center shrink-0"><BarChart2 className="h-3.5 w-3.5 text-purple-600"/></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-purple-800">Generate weekly report</p>
                    <p className="text-[11px] text-purple-600 mt-0.5">Share project status update with stakeholders.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-purple-300 shrink-0 self-center"/>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Team + Open Risks + Open Issues ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Headcount */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <Link href={`/projects/${id}/resources`} className="font-semibold text-sm text-slate-700 hover:text-blue-600">Headcount by Domain</Link>
              <Link href={`/projects/${id}/resources`} className="text-xs text-blue-600 hover:underline">{team.length} members →</Link>
            </div>
            <div className="p-4 space-y-2">
              {domainEntries.length===0?(
                <div className="text-center py-6"><Users className="h-8 w-8 text-slate-200 mx-auto mb-2"/><p className="text-xs text-slate-400">No team members</p></div>
              ):domainEntries.map(([domain,count])=>(
                <div key={domain}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-slate-600">{domain}</span>
                    <span className="text-xs font-semibold text-slate-700">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{width:`${(count/maxDomain)*100}%`}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Open Risks */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Open Risks</h2>
              <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="divide-y">
              {openRisks.length===0?(
                <div className="flex items-center gap-2 px-4 py-6 justify-center"><CheckCircle2 className="h-4 w-4 text-green-400"/><p className="text-xs text-green-600">No open risks</p></div>
              ):openRisks.slice(0,4).map(r=>(
                <div key={r.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{r.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{r.risk_id} · {r.category||'—'} · {r.owner||'—'}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${r.status==='In Progress'?'bg-amber-100 text-amber-700 border-amber-200':'bg-red-100 text-red-700 border-red-200'}`}>{r.status}</span>
                  </div>
                  {r.due_date&&<p className="text-[10px] text-slate-400 mt-0.5">Due: {fmt(r.due_date)}</p>}
                </div>
              ))}
              {openRisks.length>4&&<div className="px-4 py-2 text-center"><Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">+{openRisks.length-4} more</Link></div>}
            </div>
          </div>

          {/* Open Issues */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-sm text-slate-700">Open Issues</h2>
              <Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">View all →</Link>
            </div>
            <div className="divide-y">
              {openIssues.length===0?(
                <div className="flex items-center gap-2 px-4 py-6 justify-center"><CheckCircle2 className="h-4 w-4 text-green-400"/><p className="text-xs text-green-600">No open issues</p></div>
              ):openIssues.slice(0,4).map(i=>(
                <div key={i.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{i.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{i.issue_id} · {i.category||'—'} · {i.owner||'—'}</p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-medium ${i.status==='In Progress'?'bg-amber-100 text-amber-700 border-amber-200':'bg-red-100 text-red-700 border-red-200'}`}>{i.status}</span>
                  </div>
                  {i.due_date&&<p className="text-[10px] text-slate-400 mt-0.5">Due: {fmt(i.due_date)}</p>}
                </div>
              ))}
              {openIssues.length>4&&<div className="px-4 py-2 text-center"><Link href={`/projects/${id}/risks`} className="text-xs text-blue-600 hover:underline">+{openIssues.length-4} more</Link></div>}
            </div>
          </div>
        </div>

        {/* ── Weekly Highlights ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-green-50/60 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500"/>
              <h2 className="font-semibold text-sm text-slate-700">Completed This Week</h2>
              <span className="ml-auto text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">{completedThisWeek.length}</span>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
            {completedThisWeek.length===0?(
              <div className="px-4 py-5 text-center text-xs text-slate-400">Nothing completed yet this week</div>
            ):(
              <div className="divide-y">
                {completedThisWeek.slice(0,6).map(a=>(
                  <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0"/>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{a.activity}</p>
                      <p className="text-[10px] text-slate-400">{a.phase} · {a.status} · {fmt(a.actual_end)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-blue-50/60 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500"/>
              <h2 className="font-semibold text-sm text-slate-700">Upcoming Deliverables (30d)</h2>
              <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{upcoming.length}</span>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
            {upcoming.length===0?(
              <div className="px-4 py-5 text-center text-xs text-slate-400">No upcoming deliverables in the next 30 days</div>
            ):(
              <div className="divide-y">
                {upcoming.map(a=>{
                  const d=daysFromNow(a.plan_end);
                  return (
                    <div key={a.id} className="px-4 py-2.5 flex items-start gap-3">
                      <div className={`text-[10px] font-bold rounded px-1.5 py-0.5 shrink-0 mt-0.5 ${d<=3?'bg-red-100 text-red-700':d<=7?'bg-amber-100 text-amber-700':'bg-blue-50 text-blue-600'}`}>
                        {d===0?'Today':`${d}d`}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{a.deliverable}</p>
                        <p className="text-[10px] text-slate-400 truncate">{a.activity} · {a.phase}</p>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[a.status]??'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Blockers ── */}
        {blocked>0&&(
          <div className="bg-red-50 rounded-2xl border border-red-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-red-200 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500"/>
              <h2 className="font-semibold text-sm text-red-700">Blockers — Immediate Attention Required</h2>
              <span className="ml-auto text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">{blocked}</span>
            </div>
            <div className="divide-y divide-red-100">
              {activities.filter(a=>a.status==='Blocked').map(a=>(
                <div key={a.id} className="px-4 py-2.5 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-red-800 truncate">{a.activity}</p>
                    <p className="text-[10px] text-red-500">{a.phase}{a.accountable?` · ${a.accountable}`:''}</p>
                  </div>
                  {a.plan_end&&<span className="text-[10px] text-red-600 font-mono shrink-0">Due {fmt(a.plan_end)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Overdue Tasks ── */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500"/>
            <h2 className="font-semibold text-sm text-slate-700">Overdue Tasks</h2>
            {overdue.length>0&&<span className="ml-1 text-xs font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">{overdue.length}</span>}
            <div className="ml-auto flex gap-3">
              <Link href={`/projects/${id}/analysis`} className="text-xs text-blue-600 hover:underline">Delay Analysis →</Link>
              <Link href={`/projects/${id}/timeline`} className="text-xs text-blue-600 hover:underline">Timeline →</Link>
            </div>
          </div>
          {overdue.length===0?(
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-green-600"><CheckCircle2 className="h-4 w-4 text-green-400"/>No overdue tasks — great work!</div>
          ):(
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1e293b] text-white text-[11px]">
                    <th className="px-3 py-2.5 text-left w-8">#</th>
                    <th className="px-3 py-2.5 text-left">Activity</th>
                    <th className="px-3 py-2.5 text-left w-32">Phase</th>
                    <th className="px-3 py-2.5 text-left w-28">Plan End</th>
                    <th className="px-3 py-2.5 text-center w-20">Overdue</th>
                    <th className="px-3 py-2.5 text-left w-28">Status</th>
                    <th className="px-3 py-2.5 text-left w-32">Accountable</th>
                  </tr></thead>
                  <tbody>
                    {overdue.slice(overdueP*PAGE,(overdueP+1)*PAGE).map((a,i)=>{
                      const lag=Math.abs(daysFromNow(a.plan_end));
                      return (
                        <tr key={a.id} className={`border-t ${lag>14?'bg-red-50/40':lag>7?'bg-amber-50/30':''}`}>
                          <td className="px-3 py-2 text-slate-400">{a.no||overdueP*PAGE+i+1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px]"><p className="truncate">{a.activity}</p>{a.deliverable&&<p className="text-[10px] text-slate-400 truncate">{a.deliverable}</p>}</td>
                          <td className="px-3 py-2 text-slate-500">{a.phase}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{a.plan_end}</td>
                          <td className="px-3 py-2 text-center"><span className={`font-bold ${lag>14?'text-red-600':lag>7?'text-orange-600':'text-amber-600'}`}>+{lag}d</span></td>
                          <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[a.status]??'bg-slate-100 text-slate-600'}`}>{a.status}</span></td>
                          <td className="px-3 py-2 text-slate-500">{a.accountable||'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={overdueP} total={overdue.length} pageSize={PAGE} onChange={p=>{setOverdueP(p);}}/>
            </>
          )}
        </div>

        {/* ── Due This Week ── */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-blue-500"/>
            <h2 className="font-semibold text-sm text-slate-700">Due This Week</h2>
            {dueWeek.length>0&&<span className="ml-1 text-xs font-bold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">{dueWeek.length}</span>}
            <span className="text-[10px] text-slate-400">Next 7 days</span>
            <Link href={`/projects/${id}/timeline`} className="ml-auto text-xs text-blue-600 hover:underline">Timeline →</Link>
          </div>
          {dueWeek.length===0?(
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400"><Clock className="h-4 w-4 text-slate-300"/>No tasks due in the next 7 days</div>
          ):(
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[#1e293b] text-white text-[11px]">
                    <th className="px-3 py-2.5 text-left w-8">#</th>
                    <th className="px-3 py-2.5 text-left">Activity</th>
                    <th className="px-3 py-2.5 text-left w-32">Phase</th>
                    <th className="px-3 py-2.5 text-left w-28">Due Date</th>
                    <th className="px-3 py-2.5 text-center w-20">In</th>
                    <th className="px-3 py-2.5 text-center w-16">Done%</th>
                    <th className="px-3 py-2.5 text-left w-28">Status</th>
                    <th className="px-3 py-2.5 text-left w-32">Accountable</th>
                  </tr></thead>
                  <tbody>
                    {dueWeek.slice(dueWeekP*PAGE,(dueWeekP+1)*PAGE).map((a,i)=>{
                      const d=daysFromNow(a.plan_end);
                      return (
                        <tr key={a.id} className={`border-t ${d===0?'bg-amber-50/40':d<=2?'bg-blue-50/20':''}`}>
                          <td className="px-3 py-2 text-slate-400">{a.no||dueWeekP*PAGE+i+1}</td>
                          <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px]"><p className="truncate">{a.activity}</p>{a.deliverable&&<p className="text-[10px] text-slate-400 truncate">{a.deliverable}</p>}</td>
                          <td className="px-3 py-2 text-slate-500">{a.phase}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{a.plan_end}</td>
                          <td className="px-3 py-2 text-center"><span className={`font-bold ${d===0?'text-red-600':d<=2?'text-orange-500':'text-blue-600'}`}>{d===0?'Today':`${d}d`}</span></td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-8 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-400 rounded-full" style={{width:`${a.completion_pct}%`}}/></div>
                              <span className="text-slate-500">{a.completion_pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_BADGE[a.status]??'bg-slate-100 text-slate-600'}`}>{a.status}</span></td>
                          <td className="px-3 py-2 text-slate-500">{a.accountable||'—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={dueWeekP} total={dueWeek.length} pageSize={PAGE} onChange={p=>{setDueWeekP(p);}}/>
            </>
          )}
        </div>

        <p className="text-[10px] text-slate-300 text-center pb-2">
          SPI = weighted progress % ÷ % timeline elapsed · &gt;1 ahead · &lt;0.8 at risk · weighted progress = avg(status weight) × 100
        </p>
{/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o=>!o&&setEditOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Project Info</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label className="text-xs">Project Name *</Label><Input className="mt-1 text-sm" value={editForm.name??''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/></div>
              <div><Label className="text-xs">Client</Label><Input className="mt-1 text-sm" value={editForm.client??''} onChange={e=>setEditForm(f=>({...f,client:e.target.value}))}/></div>
              <div><Label className="text-xs">Current Phase</Label>
                <select className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" value={editForm.current_phase??''} onChange={e=>setEditForm(f=>({...f,current_phase:e.target.value}))}>
                  {['Initiation','Planning','Execution','Closing'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><Label className="text-xs">Project Manager</Label><Input className="mt-1 text-sm" value={editForm.pm_name??''} onChange={e=>setEditForm(f=>({...f,pm_name:e.target.value}))}/></div>
              <div><Label className="text-xs">PM Email</Label><Input className="mt-1 text-sm" type="email" value={editForm.pm_email??''} onChange={e=>setEditForm(f=>({...f,pm_email:e.target.value}))}/></div>
              <div><Label className="text-xs">Start Date</Label><Input className="mt-1 text-sm" type="date" value={editForm.start_date??''} onChange={e=>setEditForm(f=>({...f,start_date:e.target.value}))}/></div>
              <div><Label className="text-xs">End Date</Label><Input className="mt-1 text-sm" type="date" value={editForm.end_date??''} onChange={e=>setEditForm(f=>({...f,end_date:e.target.value}))}/></div>
              <div className="col-span-2"><Label className="text-xs">Description</Label><Textarea className="mt-1 text-sm" rows={2} value={editForm.description??''} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))}/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving||!editForm.name?.trim()} className="bg-blue-600 hover:bg-blue-700">{saving?'Saving...':'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
