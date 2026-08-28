'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import PhaseTracker from '@/components/PhaseTracker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar, Users, MessageSquare, AlertTriangle, FileText,
  Download, Pencil, Trash2, Building2, ClipboardList, ClipboardCheck, Flag,
} from 'lucide-react';

const CURRENCIES = ['VND', 'USD', 'EUR', 'JPY', 'SGD', 'GBP', 'AUD'];
const STAGES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;
const STATUSES = ['Active', 'Completed', 'Paused', 'Cancelled', 'Other'] as const;
const RAG_VALUES = ['Green', 'Amber', 'Red', 'Not applicable'] as const;
const PM_ROLES = ['primary', 'collaborator'] as const;
const STAKEHOLDER_ROLES = [
  'sponsor', 'psc_chair', 'psc_member', 'project_director', 'key_stakeholder',
] as const;

type Program = { id: number; name: string; industry: string; };
type Me = { id: number; is_admin?: number; roles?: string[] };
type CompanyUser = { id: number; display_name: string; email: string };
type PmAssignment = {
  id: number; user_id: number; role: string;
  effective_from: string; effective_to: string | null;
};
type Stakeholder = {
  id: number; stakeholder_role: string;
  user_id: number | null; external_name: string | null; external_email: string | null;
  effective_from: string; effective_to: string | null;
};
type Project = {
  id: number; name: string; client: string; customer_id: number | null;
  pm_name: string; pm_email: string;
  start_date: string; end_date: string; status: string;
  current_phase: string; description: string;
  objective: string; project_owner: string;
  budget: number; budget_currency: string;
  created_at: string;
  project_code?: string | null;
  portfolio_year?: number | null;
  stage?: string | null;
  status_reason?: string | null;
  rag?: string | null;
  progress_pct?: number | null;
  weekly_report_enabled?: boolean | null;
  weekly_report_start_period?: string | null;
  plan_end?: string | null;
  adjusted_end?: string | null;
  actual_end?: string | null;
  classification?: string | null;
  governance?: string | null;
};

function formatBudget(amount: number, currency: string): string {
  if (!amount) return '';
  const formatted = new Intl.NumberFormat(currency === 'VND' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ${currency}`;
}

const QUICK_LINKS = [
  { href: '/timeline',      icon: Calendar,       label: 'Project Timeline',  desc: 'Quản lý activities & deliverables' },
  { href: '/milestones',    icon: Flag,            label: 'Milestones',        desc: 'Các mốc quan trọng của project' },
  { href: '/resources',     icon: Users,           label: 'Resource Plan',     desc: 'Team members & capacity' },
  { href: '/communication', icon: MessageSquare,   label: 'Communication',     desc: 'Meetings & escalation path' },
  { href: '/risks',         icon: AlertTriangle,   label: 'Risks & Issues',    desc: 'Risk register & issue log' },
  { href: '/reports',       icon: ClipboardList,   label: 'Weekly Report',     desc: 'Báo cáo tuần tự động + AI' },
  { href: '/documents',     icon: FileText,        label: 'Documents',         desc: 'Charter, SoW, Closure Report...' },
  { href: '/document-checklist', icon: ClipboardCheck, label: 'Document checklist', desc: 'Complete Confluence evidence for this stage.' },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function isCpmoUser(me: Me | null): boolean {
  return !!me?.is_admin || (me?.roles?.includes('cpmo') ?? false);
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [assignments, setAssignments] = useState<PmAssignment[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [exporting, setExporting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});
  const [assignForm, setAssignForm] = useState({ user_id: '', role: 'primary' });
  const [stakeholderForm, setStakeholderForm] = useState({
    stakeholder_role: 'sponsor',
    user_id: '',
    external_name: '',
    external_email: '',
  });

  const loadLists = useCallback(async () => {
    const [assignRes, stkhRes] = await Promise.all([
      fetch(`/api/projects/${id}/pm-assignments`),
      fetch(`/api/projects/${id}/stakeholders`),
    ]);
    if (assignRes.ok) setAssignments(await assignRes.json());
    if (stkhRes.ok) setStakeholders(await stkhRes.json());
  }, [id]);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
    await loadLists();
  }, [id, loadLists]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => {
    fetch('/api/programs').then(r => r.json()).then(setPrograms);
  }, []);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(setMe);
  }, []);
  useEffect(() => {
    if (!isCpmoUser(me)) return;
    fetch('/api/admin/users?status=active')
      .then(r => (r.ok ? r.json() : []))
      .then(setCompanyUsers);
  }, [me]);

  const userLabel = (userId: number) => {
    const u = companyUsers.find(c => c.id === userId);
    return u ? `${u.display_name} (${u.email})` : `User #${userId}`;
  };

  const stakeholderPerson = (s: Stakeholder) => {
    if (s.user_id) return userLabel(s.user_id);
    if (s.external_name) return `${s.external_name}${s.external_email ? ` (${s.external_email})` : ''}`;
    return '—';
  };

  const openEdit = () => {
    if (!project) return;
    setEditForm({ ...project });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const chosenProgram = programs.find(c => c.id === editForm.customer_id);
    const payload: Record<string, unknown> = {
      ...editForm,
      client: chosenProgram?.name ?? (editForm.customer_id ? (editForm.client ?? '') : ''),
      budget: editForm.budget ? Number(editForm.budget) : 0,
      budget_currency: editForm.budget_currency || 'VND',
    };
    if (editForm.portfolio_year !== undefined && editForm.portfolio_year !== null && editForm.portfolio_year !== '') {
      payload.portfolio_year = Number(editForm.portfolio_year);
    }
    if (editForm.progress_pct !== undefined && editForm.progress_pct !== null && editForm.progress_pct !== '') {
      payload.progress_pct = Number(editForm.progress_pct);
    }
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
    const warnings = Array.isArray(data.warnings) ? data.warnings as string[] : [];
    const { warnings: _w, ...row } = data;
    setProject(row as Project);
    setEditOpen(false);
    warnings.forEach(w => toast.warning(w));
    toast.success('Project updated');
  };

  const addAssignment = async () => {
    const userId = Number(assignForm.user_id);
    if (!Number.isFinite(userId)) { toast.error('Select a user'); return; }
    const res = await fetch(`/api/projects/${id}/pm-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role: assignForm.role }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Failed to add assignment'); return; }
    toast.success('PM assignment added');
    setAssignForm({ user_id: '', role: 'primary' });
    await loadLists();
  };

  const endAssignment = async (assignmentId: number) => {
    const res = await fetch(`/api/projects/${id}/pm-assignments`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assignmentId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Failed to end assignment'); return; }
    toast.success('Assignment ended');
    await loadLists();
    loadProject();
  };

  const addStakeholder = async () => {
    const body: Record<string, unknown> = { stakeholder_role: stakeholderForm.stakeholder_role };
    if (stakeholderForm.user_id.trim()) {
      body.user_id = Number(stakeholderForm.user_id);
    } else {
      body.external_name = stakeholderForm.external_name.trim();
      body.external_email = stakeholderForm.external_email.trim();
    }
    const res = await fetch(`/api/projects/${id}/stakeholders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Failed to add stakeholder'); return; }
    toast.success('Stakeholder added');
    setStakeholderForm({ stakeholder_role: 'sponsor', user_id: '', external_name: '', external_email: '' });
    await loadLists();
  };

  const endStakeholder = async (stakeholderId: number) => {
    const res = await fetch(`/api/projects/${id}/stakeholders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stakeholderId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Failed to end stakeholder'); return; }
    toast.success('Stakeholder ended');
    await loadLists();
  };

  const updatePhase = async (phase: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_phase: phase }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Update failed'); return; }
    const { warnings: _w, ...row } = data;
    setProject(row as Project);
    if (Array.isArray(data.warnings)) data.warnings.forEach((w: string) => toast.warning(w));
    toast.success(`Phase updated to ${phase}`);
  };

  const deleteProject = async () => {
    if (!confirm('Xóa project này? Tất cả dữ liệu sẽ bị mất.')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    toast.success('Project deleted');
    router.push('/');
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/excel/${id}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name ?? 'project'}-plan.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exported!');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  };

  const setField = <K extends keyof Project>(key: K, value: Project[K]) =>
    setEditForm(f => ({ ...f, [key]: value }));

  const selectedProgram = programs.find(c => c.id === (editForm.customer_id ?? project?.customer_id));
  const cpmo = isCpmoUser(me);

  if (!project) return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-8"><p className="text-slate-400">Loading...</p></main>
    </div>
  );

  const budgetDisplay = project.budget > 0
    ? formatBudget(Number(project.budget), project.budget_currency || 'VND')
    : null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-8 max-w-5xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
              {project.project_code && (
                <Badge variant="outline" className="font-mono text-xs">{project.project_code}</Badge>
              )}
              {project.client && (
                <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{project.client}
                </Badge>
              )}
              {project.stage && (
                <Badge className="bg-slate-100 text-slate-700">{project.stage}</Badge>
              )}
            </div>
            {project.description && <p className="text-slate-500 text-sm">{project.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
              {project.portfolio_year != null && (
                <span>Year: <span className="font-medium text-slate-600">{project.portfolio_year}</span></span>
              )}
              {project.pm_name && <span>PM: <span className="font-medium text-slate-600">{project.pm_name}</span></span>}
              {project.project_owner && <span>Owner: <span className="font-medium text-slate-600">{project.project_owner}</span></span>}
              {project.pm_email && <span>{project.pm_email}</span>}
              {project.start_date && <span>{project.start_date} → {project.end_date || '?'}</span>}
              {budgetDisplay && <span>Budget: <span className="font-medium text-slate-600">{budgetDisplay}</span></span>}
            </div>
            {project.objective && (
              <p className="text-xs text-slate-500 mt-1.5 italic">Objective: {project.objective}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0 ml-4">
            <Button variant="outline" size="sm" onClick={openEdit} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting} className="gap-2">
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </Button>
            <Button variant="outline" size="sm" onClick={deleteProject} className="gap-2 text-red-500 hover:text-red-600 hover:border-red-300">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ── Phase selector ── */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-slate-500">Current Phase:</span>
          <Select value={project.current_phase} onValueChange={v => updatePhase(v ?? '')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Initiation">Initiation</SelectItem>
              <SelectItem value="Planning">Planning</SelectItem>
              <SelectItem value="Execution">Execution</SelectItem>
              <SelectItem value="Closing">Closing</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Phase tracker ── */}
        <div className="mb-6">
          <PhaseTracker currentPhase={project.current_phase} />
        </div>

        {/* ── PM assignments & stakeholders ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">PM Assignments</h3>
            {assignments.length === 0 ? (
              <p className="text-xs text-slate-400 mb-3">No assignment history yet.</p>
            ) : (
              <ul className="space-y-2 mb-3 text-xs">
                {assignments.map(a => (
                  <li key={a.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-medium capitalize">{a.role}</span>
                      <span className="text-slate-500"> · {userLabel(a.user_id)}</span>
                      <div className="text-slate-400">{a.effective_from} → {a.effective_to ?? 'open'}</div>
                    </div>
                    {cpmo && !a.effective_to && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => endAssignment(a.id)}>
                        End
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cpmo && (
              <div className="space-y-2 pt-2 border-t">
                <Select value={assignForm.role} onValueChange={v => setAssignForm(f => ({ ...f, role: v ?? 'primary' }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PM_ROLES.map(r => (
                      <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignForm.user_id || 'none'} onValueChange={v => setAssignForm(f => ({ ...f, user_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select user..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-slate-400">Select user...</span></SelectItem>
                    {companyUsers.map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="w-full h-8 text-xs" onClick={addAssignment}>Add assignment</Button>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Stakeholders</h3>
            {stakeholders.length === 0 ? (
              <p className="text-xs text-slate-400 mb-3">No stakeholder history yet.</p>
            ) : (
              <ul className="space-y-2 mb-3 text-xs">
                {stakeholders.map(s => (
                  <li key={s.id} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="font-medium">{s.stakeholder_role.replace(/_/g, ' ')}</span>
                      <span className="text-slate-500"> · {stakeholderPerson(s)}</span>
                      <div className="text-slate-400">{s.effective_from} → {s.effective_to ?? 'open'}</div>
                    </div>
                    {!s.effective_to && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0" onClick={() => endStakeholder(s.id)}>
                        End
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2 pt-2 border-t">
              <Select
                value={stakeholderForm.stakeholder_role}
                onValueChange={v => setStakeholderForm(f => ({ ...f, stakeholder_role: v ?? 'sponsor' }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAKEHOLDER_ROLES.map(r => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 text-xs"
                type="number"
                placeholder="User ID (optional)"
                value={stakeholderForm.user_id}
                onChange={e => setStakeholderForm(f => ({ ...f, user_id: e.target.value }))}
              />
              <Input
                className="h-8 text-xs"
                placeholder="External name (if no user)"
                value={stakeholderForm.external_name}
                onChange={e => setStakeholderForm(f => ({ ...f, external_name: e.target.value }))}
              />
              <Input
                className="h-8 text-xs"
                placeholder="External email (if no user)"
                value={stakeholderForm.external_email}
                onChange={e => setStakeholderForm(f => ({ ...f, external_email: e.target.value }))}
              />
              <Button size="sm" className="w-full h-8 text-xs" onClick={addStakeholder}>Add stakeholder</Button>
            </div>
          </Card>
        </div>

        {/* ── Quick links ── */}
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Project Sections</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {QUICK_LINKS.map(({ href, icon: Icon, label, desc }) => (
            <Link key={href} href={`/projects/${id}${href}`}>
              <Card className="p-4 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-sm text-slate-700">{label}</span>
                </div>
                <p className="text-xs text-slate-400">{desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      {/* ── Edit Project Dialog ── */}
      <Dialog open={editOpen} onOpenChange={o => { if (!o) setEditOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-blue-500" /> Edit Project
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <FieldRow label="Program">
              <div className="flex gap-2">
                <Select
                  value={editForm.customer_id ? String(editForm.customer_id) : 'none'}
                  onValueChange={v => setField('customer_id', v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder="Select program..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-slate-400 italic">— No program —</span></SelectItem>
                    {programs.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{c.name}</span>
                          {c.industry && <span className="text-xs text-slate-400">· {c.industry}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProgram && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {selectedProgram.name}
                  {selectedProgram.industry && ` · ${selectedProgram.industry}`}
                </p>
              )}
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Project Code">
                <Input
                  className="h-9 text-sm font-mono"
                  value={editForm.project_code ?? ''}
                  onChange={e => setField('project_code', e.target.value)}
                  disabled={!cpmo}
                  placeholder={cpmo ? 'PRJ-2026-001' : 'CPMO only'}
                />
              </FieldRow>
              <FieldRow label="Portfolio Year">
                <Input
                  className="h-9 text-sm"
                  type="number"
                  value={editForm.portfolio_year ?? ''}
                  onChange={e => setField('portfolio_year', e.target.value ? Number(e.target.value) : null)}
                />
              </FieldRow>
            </div>

            <FieldRow label="Project Name *">
              <Input
                className="h-9 text-sm"
                value={editForm.name ?? ''}
                onChange={e => setField('name', e.target.value)}
              />
            </FieldRow>

            <FieldRow label="Description">
              <Textarea
                className="text-sm min-h-[80px]"
                value={editForm.description ?? ''}
                onChange={e => setField('description', e.target.value)}
                placeholder="Mô tả ngắn về project..."
              />
            </FieldRow>

            <FieldRow label="Objective">
              <Textarea
                className="text-sm min-h-[80px]"
                value={editForm.objective ?? ''}
                onChange={e => setField('objective', e.target.value)}
                placeholder="Mục tiêu, kết quả kỳ vọng của project..."
              />
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Stage (L0–L5)">
                <Select
                  value={editForm.stage ?? 'none'}
                  onValueChange={v => setField('stage', v === 'none' ? null : v)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select stage..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-slate-400">— None —</span></SelectItem>
                    {STAGES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Status">
                <Select
                  value={editForm.status ?? 'Active'}
                  onValueChange={v => setField('status', v ?? 'Active')}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>

            <FieldRow label="Status Reason (required when Other)">
              <Input
                className="h-9 text-sm"
                value={editForm.status_reason ?? ''}
                onChange={e => setField('status_reason', e.target.value)}
              />
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="RAG">
                <Select
                  value={editForm.rag ?? 'none'}
                  onValueChange={v => setField('rag', v === 'none' ? null : v)}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select RAG..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-slate-400">— None —</span></SelectItem>
                    {RAG_VALUES.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Progress %">
                <Input
                  className="h-9 text-sm"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.progress_pct ?? ''}
                  onChange={e => setField('progress_pct', e.target.value === '' ? null : Number(e.target.value))}
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Classification">
                <Input
                  className="h-9 text-sm"
                  value={editForm.classification ?? ''}
                  onChange={e => setField('classification', e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Governance">
                <Input
                  className="h-9 text-sm"
                  value={editForm.governance ?? ''}
                  onChange={e => setField('governance', e.target.value)}
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Weekly Report">
                <Select
                  value={editForm.weekly_report_enabled ? 'yes' : 'no'}
                  onValueChange={v => setField('weekly_report_enabled', v === 'yes')}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Weekly Start Period (YYYY-Wnn)">
                <Input
                  className="h-9 text-sm font-mono"
                  placeholder="2026-W01"
                  value={editForm.weekly_report_start_period ?? ''}
                  onChange={e => setField('weekly_report_start_period', e.target.value)}
                />
              </FieldRow>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FieldRow label="Plan End">
                <Input className="h-9 text-sm" type="date" value={editForm.plan_end ?? ''} onChange={e => setField('plan_end', e.target.value)} />
              </FieldRow>
              <FieldRow label="Adjusted End">
                <Input className="h-9 text-sm" type="date" value={editForm.adjusted_end ?? ''} onChange={e => setField('adjusted_end', e.target.value)} />
              </FieldRow>
              <FieldRow label="Actual End">
                <Input className="h-9 text-sm" type="date" value={editForm.actual_end ?? ''} onChange={e => setField('actual_end', e.target.value)} />
              </FieldRow>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Project Manager">
                <Input
                  className="h-9 text-sm"
                  value={editForm.pm_name ?? ''}
                  onChange={e => setField('pm_name', e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </FieldRow>
              <FieldRow label="PM Email">
                <Input
                  className="h-9 text-sm"
                  type="email"
                  value={editForm.pm_email ?? ''}
                  onChange={e => setField('pm_email', e.target.value)}
                  placeholder="pm@example.com"
                />
              </FieldRow>
            </div>

            <FieldRow label="Project Owner">
              <Input
                className="h-9 text-sm"
                value={editForm.project_owner ?? ''}
                onChange={e => setField('project_owner', e.target.value)}
                placeholder="Tên Project Owner / Sponsor..."
              />
            </FieldRow>

            <FieldRow label="Budget">
              <div className="flex gap-2">
                <Input
                  className="h-9 text-sm flex-1"
                  type="number"
                  min="0"
                  value={editForm.budget ?? 0}
                  onChange={e => setField('budget', e.target.value ? Number(e.target.value) : 0)}
                  placeholder="0"
                />
                <Select
                  value={editForm.budget_currency ?? 'VND'}
                  onValueChange={v => setField('budget_currency', v ?? 'VND')}
                >
                  <SelectTrigger className="w-24 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </FieldRow>

            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Start Date">
                <Input
                  className="h-9 text-sm"
                  type="date"
                  value={editForm.start_date ?? ''}
                  onChange={e => setField('start_date', e.target.value)}
                />
              </FieldRow>
              <FieldRow label="End Date">
                <Input
                  className="h-9 text-sm"
                  type="date"
                  value={editForm.end_date ?? ''}
                  onChange={e => setField('end_date', e.target.value)}
                />
              </FieldRow>
            </div>

            <FieldRow label="Current Phase">
              <Select
                value={editForm.current_phase ?? 'Initiation'}
                onValueChange={v => setField('current_phase', v ?? 'Initiation')}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Initiation">Initiation</SelectItem>
                  <SelectItem value="Planning">Planning</SelectItem>
                  <SelectItem value="Execution">Execution</SelectItem>
                  <SelectItem value="Closing">Closing</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={saveEdit}>Lưu thay đổi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
