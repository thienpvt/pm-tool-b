'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Building2, Mail, Phone, Globe,
  FolderKanban, ChevronRight, Search, Users,
} from 'lucide-react';

type Program = {
  id: number; name: string; industry: string;
  contact_name: string; contact_email: string; contact_phone: string;
  website: string; notes: string; created_at: string;
  project_count: number;
};

type ProjectAllocation = {
  project_id: number;
  project_name: string;
  allocated_headcount: number;
};

type ProgramResources = {
  program_id: number;
  portfolio_allocated: number;
  projects: ProjectAllocation[];
};

const INDUSTRIES = [
  'Banking & Finance', 'Insurance', 'Fintech', 'Retail', 'Healthcare',
  'Manufacturing', 'Telecommunications', 'Government', 'Education', 'Technology', 'Other',
];

const INDUSTRY_COLOR: Record<string, string> = {
  'Banking & Finance': 'bg-blue-100 text-blue-700',
  'Insurance': 'bg-purple-100 text-purple-700',
  'Fintech': 'bg-cyan-100 text-cyan-700',
  'Retail': 'bg-orange-100 text-orange-700',
  'Healthcare': 'bg-green-100 text-green-700',
  'Manufacturing': 'bg-yellow-100 text-yellow-700',
  'Telecommunications': 'bg-pink-100 text-pink-700',
  'Government': 'bg-slate-100 text-slate-700',
  'Education': 'bg-emerald-100 text-emerald-700',
  'Technology': 'bg-indigo-100 text-indigo-700',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const EMPTY: Partial<Program> = {
  name: '', industry: '', contact_name: '', contact_email: '',
  contact_phone: '', website: '', notes: '',
};

// ── Resource allocation dialog ─────────────────────────────────────────────────
function ResourceAllocDialog({
  program,
  open,
  onOpenChange,
}: {
  program: Program;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [resources, setResources] = useState<ProgramResources | null>(null);
  const [localValues, setLocalValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/project-allocations`);
      const data = await res.json();
      setResources(data);
      const vals: Record<number, string> = {};
      for (const p of data.projects ?? []) {
        vals[p.project_id] = String(p.allocated_headcount);
      }
      setLocalValues(vals);
    } finally {
      setLoading(false);
    }
  }, [open, program.id]);

  useEffect(() => { load(); }, [load]);

  const saveAlloc = async (projectId: number, headcount: number) => {
    const res = await fetch(`/api/programs/${program.id}/project-allocations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, allocated_headcount: headcount }),
    });
    if (!res.ok) { toast.error('Lưu thất bại'); return; }
    toast.success('Đã cập nhật');
    load();
  };

  if (!resources) return null;

  const totalDistributed = resources.projects.reduce((s, p) => s + (Number(p.allocated_headcount) || 0), 0);
  const portfolioAllocated = Number(resources.portfolio_allocated) || 0;
  const remaining = parseFloat((portfolioAllocated - totalDistributed).toFixed(2));
  const pct = portfolioAllocated > 0
    ? Math.min((totalDistributed / portfolioAllocated) * 100, 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            Phân bổ nhân sự — {program.name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-5 py-1">
            {/* Summary bar */}
            <div className="flex items-center gap-4 flex-wrap bg-slate-50 border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Được phân bổ từ Portfolio:</span>
                <span className="text-sm font-bold text-blue-700">{portfolioAllocated}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-xs">
                <span className="text-slate-400">Đã phân bổ xuống project: </span>
                <span className="font-bold text-slate-700">{totalDistributed.toFixed(2)}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-xs">
                <span className="text-slate-400">Còn lại: </span>
                <span className={`font-bold ${remaining < 0 ? 'text-red-600' : remaining === 0 && portfolioAllocated > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                  {remaining}
                </span>
              </div>
              {portfolioAllocated > 0 && (
                <>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${remaining < 0 ? 'bg-red-500' : pct >= 100 ? 'bg-amber-400' : 'bg-green-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
                  </div>
                </>
              )}
              {portfolioAllocated === 0 && (
                <p className="text-xs text-amber-600 ml-1">
                  Chưa được phân bổ từ Portfolio. Vào <strong>Resource Management → Phân bổ Program</strong> để thiết lập.
                </p>
              )}
            </div>

            {/* Project allocation table */}
            {resources.projects.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm rounded-xl border bg-white">
                Program này chưa có project nào. Tạo project và gắn vào program trước.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1e293b] text-white">
                      <th className="px-3 py-3 text-left">#</th>
                      <th className="px-3 py-3 text-left">Project</th>
                      <th className="px-3 py-3 text-center w-40">Số FTE phân bổ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.projects.map((p, i) => {
                      const localVal = localValues[p.project_id] ?? String(p.allocated_headcount);
                      return (
                        <tr key={p.project_id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-700">{p.project_name}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              className="w-20 h-6 px-1.5 text-xs font-bold text-slate-800 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center bg-white"
                              value={localVal}
                              onChange={e => setLocalValues(v => ({ ...v, [p.project_id]: e.target.value }))}
                              onBlur={() => saveAlloc(p.project_id, Math.max(0, Number(localVal) || 0))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-slate-50">
                      <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600">Tổng</td>
                      <td className="px-3 py-2 text-center text-xs font-bold text-slate-800">{totalDistributed.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Mini resource badge for program card ───────────────────────────────────────
function ProgramResourceBadge({ programId }: { programId: number }) {
  const [data, setData] = useState<ProgramResources | null>(null);

  useEffect(() => {
    fetch(`/api/programs/${programId}/project-allocations`)
      .then(r => r.json())
      .then(setData)
      .catch(() => null);
  }, [programId]);

  const portfolioAlloc = Number(data.portfolio_allocated) || 0;
  if (!data || portfolioAlloc === 0) return null;

  const distributed = data.projects.reduce((s, p) => s + (Number(p.allocated_headcount) || 0), 0);
  const remaining = parseFloat((portfolioAlloc - distributed).toFixed(2));

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
      <Users className="h-3 w-3 text-blue-400 shrink-0" />
      <span className="text-blue-600 font-semibold">{portfolioAlloc}</span>
      <span>từ Portfolio</span>
      <span className="text-slate-300">·</span>
      <span className={remaining < 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}>
        còn {remaining}
      </span>
    </div>
  );
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [editing, setEditing] = useState<Partial<Program> | null>(null);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<Program | null>(null);
  const [resourceProgram, setResourceProgram] = useState<Program | null>(null);

  const load = useCallback(() => {
    fetch('/api/programs').then(r => r.json()).then(setPrograms);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error('Name is required'); return; }
    const isNew = !editing.id;
    const res = await fetch(isNew ? '/api/programs' : `/api/programs/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { toast.error('Failed to save'); return; }
    load();
    setEditing(null);
    toast.success(isNew ? 'Program created' : 'Program updated');
  };

  const del = async (c: Program) => {
    await fetch(`/api/programs/${c.id}`, { method: 'DELETE' });
    setPrograms(ps => ps.filter(x => x.id !== c.id));
    setDeleting(null);
    toast.success('Program deleted');
  };

  const filtered = programs.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProjects = programs.reduce((s, c) => s + c.project_count, 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-600" /> Program Management
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {programs.length} programs · {totalProjects} projects total
              </p>
            </div>
            <Button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" /> Add Program
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 h-10 bg-white"
              placeholder="Search by name, industry, or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="text-center py-24 rounded-2xl border bg-white">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 text-sm">
                {search ? 'No programs match your search.' : 'No programs yet. Add your first program!'}
              </p>
            </div>
          )}

          {/* Program grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border hover:shadow-md transition-shadow flex flex-col">
                {/* Card header */}
                <div className="p-5 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${avatarColor(c.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
                    {c.industry && (
                      <Badge className={`text-[10px] mt-1 ${INDUSTRY_COLOR[c.industry] ?? 'bg-slate-100 text-slate-600'}`}>
                        {c.industry}
                      </Badge>
                    )}
                    <ProgramResourceBadge programId={c.id} />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setResourceProgram(c)}
                      className="p-1.5 text-slate-300 hover:text-blue-500 rounded transition-colors"
                      title="Quản lý nhân sự"
                    >
                      <Users className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setEditing({ ...c })} className="p-1.5 text-slate-300 hover:text-blue-500 rounded transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(c)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="px-5 pb-4 space-y-1.5 text-xs text-slate-500 flex-1">
                  {c.contact_name && (
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-slate-300">👤</span>{c.contact_name}
                    </div>
                  )}
                  {c.contact_email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3 w-3 shrink-0 text-slate-300" />
                      <a href={`mailto:${c.contact_email}`} className="truncate hover:text-blue-600">{c.contact_email}</a>
                    </div>
                  )}
                  {c.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-slate-300" />{c.contact_phone}
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="h-3 w-3 shrink-0 text-slate-300" />
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-600">{c.website.replace(/^https?:\/\//, '')}</a>
                    </div>
                  )}
                  {c.notes && (
                    <p className="text-slate-400 italic line-clamp-2 pt-1">{c.notes}</p>
                  )}
                </div>

                {/* Footer: project count + link */}
                <div className="px-5 py-3 border-t bg-slate-50/60 rounded-b-2xl flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <FolderKanban className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-blue-600">{c.project_count}</span>
                    <span>{c.project_count === 1 ? 'project' : 'projects'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setResourceProgram(c)}
                      className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-0.5 font-medium"
                    >
                      <Users className="h-3 w-3" /> Nhân sự
                    </button>
                    <Link href={`/?program=${c.id}`} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                      View projects <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Resource allocation dialog */}
      {resourceProgram && (
        <ResourceAllocDialog
          program={resourceProgram}
          open={!!resourceProgram}
          onOpenChange={o => { if (!o) setResourceProgram(null); }}
        />
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              {editing?.id ? 'Edit Program' : 'Add New Program'}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FieldRow label="Program Name *">
                    <Input className="h-9" value={editing.name ?? ''} onChange={e => setEditing(x => ({ ...x!, name: e.target.value }))} placeholder="e.g. VPBank Digital Transformation" />
                  </FieldRow>
                </div>
                <FieldRow label="Industry">
                  <select
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editing.industry ?? ''}
                    onChange={e => setEditing(x => ({ ...x!, industry: e.target.value }))}
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Input className="h-9" value={editing.contact_name ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_name: e.target.value }))} placeholder="Nguyễn Văn A" />
                </FieldRow>
                <FieldRow label="Contact Email">
                  <Input className="h-9" type="email" value={editing.contact_email ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_email: e.target.value }))} placeholder="contact@company.com" />
                </FieldRow>
                <FieldRow label="Phone">
                  <Input className="h-9" value={editing.contact_phone ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_phone: e.target.value }))} placeholder="+84 xxx xxx xxx" />
                </FieldRow>
                <div className="col-span-2">
                  <FieldRow label="Website">
                    <Input className="h-9" value={editing.website ?? ''} onChange={e => setEditing(x => ({ ...x!, website: e.target.value }))} placeholder="https://company.com" />
                  </FieldRow>
                </div>
                <div className="col-span-2">
                  <FieldRow label="Notes">
                    <Textarea className="text-sm min-h-[72px]" value={editing.notes ?? ''} onChange={e => setEditing(x => ({ ...x!, notes: e.target.value }))} placeholder="Ghi chú thêm về chương trình..." />
                  </FieldRow>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>
              {editing?.id ? 'Cập nhật' : 'Tạo Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa program?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Bạn có chắc muốn xóa <span className="font-semibold">{deleting?.name}</span>?
            Các projects của chương trình này sẽ không bị xóa nhưng sẽ mất liên kết.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => deleting && del(deleting)}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
