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
  Download, Pencil, Trash2, Building2, ClipboardList,
} from 'lucide-react';

type Customer = { id: number; name: string; industry: string; };
type Project = {
  id: number; name: string; client: string; customer_id: number | null;
  pm_name: string; pm_email: string;
  start_date: string; end_date: string; status: string;
  current_phase: string; description: string; created_at: string;
};

const QUICK_LINKS = [
  { href: '/timeline',      icon: Calendar,       label: 'Project Timeline',  desc: 'Quản lý activities & deliverables' },
  { href: '/resources',     icon: Users,           label: 'Resource Plan',     desc: 'Team members & capacity' },
  { href: '/communication', icon: MessageSquare,   label: 'Communication',     desc: 'Meetings & escalation path' },
  { href: '/risks',         icon: AlertTriangle,   label: 'Risks & Issues',    desc: 'Risk register & issue log' },
  { href: '/reports',       icon: ClipboardList,   label: 'Weekly Report',     desc: 'Báo cáo tuần tự động + AI' },
  { href: '/documents',     icon: FileText,        label: 'Documents',         desc: 'Charter, SoW, Closure Report...' },
];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [exporting, setExporting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Project>>({});

  const loadProject = useCallback(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject);
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
  }, []);

  const openEdit = () => {
    if (!project) return;
    setEditForm({ ...project });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? 'Save failed'); return; }
    setProject(data);
    setEditOpen(false);
    toast.success('Project updated');
  };

  const updatePhase = async (phase: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_phase: phase }),
    });
    const data = await res.json();
    setProject(data);
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

  const set = (key: keyof Project, value: string | number | null) =>
    setEditForm(f => ({ ...f, [key]: value }));

  const selectedCustomer = customers.find(c => c.id === (editForm.customer_id ?? project?.customer_id));

  if (!project) return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-8"><p className="text-slate-400">Loading...</p></main>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-8 max-w-5xl">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
              {project.client && (
                <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />{project.client}
                </Badge>
              )}
            </div>
            {project.description && <p className="text-slate-500 text-sm">{project.description}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
              {project.pm_name && <span>PM: <span className="font-medium text-slate-600">{project.pm_name}</span></span>}
              {project.pm_email && <span>{project.pm_email}</span>}
              {project.start_date && <span>{project.start_date} → {project.end_date || '?'}</span>}
            </div>
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
            {/* Customer */}
            <FieldRow label="Customer">
              <div className="flex gap-2">
                <Select
                  value={editForm.customer_id ? String(editForm.customer_id) : 'none'}
                  onValueChange={v => set('customer_id', v === 'none' ? null : Number(v))}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none"><span className="text-slate-400 italic">— No customer —</span></SelectItem>
                    {customers.map(c => (
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
              {selectedCustomer && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {selectedCustomer.name}
                  {selectedCustomer.industry && ` · ${selectedCustomer.industry}`}
                </p>
              )}
            </FieldRow>

            {/* Project name */}
            <FieldRow label="Project Name *">
              <Input className="h-9 text-sm" value={editForm.name ?? ''} onChange={e => set('name', e.target.value)} />
            </FieldRow>

            {/* Description */}
            <FieldRow label="Description">
              <Textarea className="text-sm min-h-[80px]" value={editForm.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Mô tả ngắn về project..." />
            </FieldRow>

            {/* PM row */}
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Project Manager">
                <Input className="h-9 text-sm" value={editForm.pm_name ?? ''} onChange={e => set('pm_name', e.target.value)} placeholder="Nguyễn Văn A" />
              </FieldRow>
              <FieldRow label="PM Email">
                <Input className="h-9 text-sm" type="email" value={editForm.pm_email ?? ''} onChange={e => set('pm_email', e.target.value)} placeholder="pm@chartertech.com" />
              </FieldRow>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Start Date">
                <Input className="h-9 text-sm" type="date" value={editForm.start_date ?? ''} onChange={e => set('start_date', e.target.value)} />
              </FieldRow>
              <FieldRow label="End Date">
                <Input className="h-9 text-sm" type="date" value={editForm.end_date ?? ''} onChange={e => set('end_date', e.target.value)} />
              </FieldRow>
            </div>

            {/* Phase */}
            <FieldRow label="Current Phase">
              <Select value={editForm.current_phase ?? 'Initiation'} onValueChange={v => set('current_phase', v ?? 'Initiation')}>
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
