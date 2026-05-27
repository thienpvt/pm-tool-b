'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, AlertCircle, CheckCircle2, Server } from 'lucide-react';

interface OperationSystem {
  id: number;
  name: string;
  description: string;
  project_id: number | null;
  project_name: string | null;
  go_live_date: string | null;
  status: string;
  total_planned: number;
  total_actual: number;
  open_incidents: number;
}

interface Project { id: number; name: string; }

function fmt(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num) || num === 0) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} triệu`;
  return num.toLocaleString('vi-VN');
}

export default function OperationsPage() {
  const router = useRouter();
  const [systems, setSystems] = useState<OperationSystem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const [sysRes, projRes] = await Promise.all([
      fetch('/api/operations/systems'),
      fetch('/api/projects'),
    ]);
    if (sysRes.ok) setSystems(await sysRes.json());
    if (projRes.ok) {
      const data = await projRes.json();
      setProjects(data.projects ?? data);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Xóa hệ thống vận hành này?')) return;
    await fetch(`/api/operations/systems/${id}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    load();
  };

  const filtered = systems.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.project_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý hệ thống đang vận hành sau khi dự án kết thúc</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Thêm hệ thống
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Tìm kiếm hệ thống..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Tổng hệ thống</div>
          <div className="text-2xl font-bold">{systems.length}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Đang hoạt động</div>
          <div className="text-2xl font-bold text-green-600">{systems.filter(s => s.status === 'active').length}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Incident mở</div>
          <div className="text-2xl font-bold text-red-600">{systems.reduce((s, sys) => s + Number(sys.open_incidents), 0)}</div>
        </div>
      </div>

      {/* Systems grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chưa có hệ thống nào</p>
          <p className="text-sm">Thêm hệ thống vận hành đầu tiên</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(sys => {
            const utilPct = Number(sys.total_planned) > 0
              ? Math.min(100, (Number(sys.total_actual) / Number(sys.total_planned)) * 100)
              : 0;
            return (
              <div
                key={sys.id}
                className="p-4 rounded-lg border bg-card cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/operations/${sys.id}`)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="font-medium text-sm leading-tight">{sys.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={e => handleDelete(sys.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>

                {sys.project_name && (
                  <p className="text-xs text-muted-foreground mb-2">Từ dự án: {sys.project_name}</p>
                )}

                <div className="flex items-center gap-2 mb-3">
                  {sys.status === 'active' ? (
                    <span className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Retired
                    </span>
                  )}
                  {Number(sys.open_incidents) > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5" /> {sys.open_incidents} incident
                    </span>
                  )}
                  {sys.go_live_date && (
                    <span className="text-xs text-muted-foreground ml-auto">Go-live: {sys.go_live_date}</span>
                  )}
                </div>

                {Number(sys.total_planned) > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Chi phí</span>
                      <span>{fmt(sys.total_actual)} / {fmt(sys.total_planned)} VND</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${utilPct > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${utilPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateSystemDialog
          projects={projects}
          onClose={() => setShowCreate(false)}
          onCreated={id => { setShowCreate(false); router.push(`/operations/${id}`); }}
        />
      )}
    </div>
  );
}

function CreateSystemDialog({
  projects, onClose, onCreated,
}: {
  projects: Project[];
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    project_id: '',
    go_live_date: '',
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên hệ thống'); return; }
    setSaving(true);
    const res = await fetch('/api/operations/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        project_id: form.project_id ? parseInt(form.project_id) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success('Đã tạo hệ thống');
      onCreated(data.id);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Thêm hệ thống vận hành</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Tên hệ thống *</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="vd: AI Platform Production" />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dự án gốc</Label>
              <Select value={form.project_id ?? ''} onValueChange={v => setForm(p => ({ ...p, project_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Chọn dự án (tùy chọn)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Không liên kết —</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ngày go-live</Label>
              <Input type="date" value={form.go_live_date} onChange={e => setForm(p => ({ ...p, go_live_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Trạng thái</Label>
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v ?? '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>Tạo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
