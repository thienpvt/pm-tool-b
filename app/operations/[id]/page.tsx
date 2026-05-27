'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, AlertCircle, CheckCircle2, Pencil, Server } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface System {
  id: number; name: string; description: string;
  project_id: number | null; project_name: string | null;
  go_live_date: string | null; status: string;
  company_id: number;
}
interface BudgetItem {
  id: number; operations_system_id: number; category: string;
  name: string; planned_amount: number; actual_amount: number;
  unit: string; period_label: string; notes: string;
}
interface Expense {
  id: number; operations_system_id: number; expense_date: string;
  category: string; description: string; amount: number; reference: string;
}
interface Incident {
  id: number; operations_system_id: number; title: string;
  severity: string; description: string; reported_at: string;
  resolved_at: string | null; cost_impact: number; status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string) {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num) || num === 0) return '0';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} triệu`;
  return num.toLocaleString('vi-VN');
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High: 'bg-orange-100 text-orange-700 border-orange-200',
  Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low: 'bg-green-100 text-green-700 border-green-200',
};

const INCIDENT_STATUS_COLORS: Record<string, string> = {
  Open: 'bg-red-100 text-red-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
};

const CATEGORIES = ['CAPEX', 'OPEX', 'Vận hành', 'Other'];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OperationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [system, setSystem] = useState<System | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [showEditSystem, setShowEditSystem] = useState(false);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);

  const load = useCallback(async () => {
    const [detailRes, projRes] = await Promise.all([
      fetch(`/api/operations/systems/${id}`),
      fetch('/api/projects'),
    ]);
    if (detailRes.ok) {
      const data = await detailRes.json();
      setSystem(data.system);
      setBudgetItems(data.budgetItems);
      setExpenses(data.expenses);
      setIncidents(data.incidents);
    } else if (detailRes.status === 404) {
      router.push('/operations');
    }
    if (projRes.ok) {
      const data = await projRes.json();
      setProjects(data.projects ?? data);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (!system) return <div className="p-6 text-muted-foreground">Đang tải...</div>;

  const totalPlanned = budgetItems.reduce((s, i) => s + Number(i.planned_amount), 0);
  const totalActual = budgetItems.reduce((s, i) => s + Number(i.actual_amount), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <button onClick={() => router.push('/operations')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Operations
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Server className="w-6 h-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold">{system.name}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${system.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {system.status === 'active' ? 'Active' : 'Retired'}
            </span>
          </div>
          {system.description && <p className="text-sm text-muted-foreground ml-9">{system.description}</p>}
          <div className="flex items-center gap-4 ml-9 mt-1 text-sm text-muted-foreground">
            {system.project_name && <span>Dự án gốc: <span className="text-foreground">{system.project_name}</span></span>}
            {system.go_live_date && <span>Go-live: <span className="text-foreground">{system.go_live_date}</span></span>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEditSystem(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Sửa
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Chi phí dự kiến</div>
          <div className="text-xl font-bold">{fmt(totalPlanned)}</div>
          <div className="text-xs text-muted-foreground">VND</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Chi phí thực tế</div>
          <div className={`text-xl font-bold ${totalActual > totalPlanned && totalPlanned > 0 ? 'text-red-600' : ''}`}>
            {fmt(totalActual)}
          </div>
          <div className="text-xs text-muted-foreground">VND</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Incident mở</div>
          <div className={`text-xl font-bold ${incidents.filter(i => i.status !== 'Resolved').length > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {incidents.filter(i => i.status !== 'Resolved').length}
          </div>
          <div className="text-xs text-muted-foreground">/ {incidents.length} tổng</div>
        </div>
      </div>

      <Tabs defaultValue="budget">
        <TabsList className="mb-4">
          <TabsTrigger value="budget">Budget ({budgetItems.length})</TabsTrigger>
          <TabsTrigger value="expenses">Chi phí ({expenses.length})</TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents
            {incidents.filter(i => i.status !== 'Resolved').length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {incidents.filter(i => i.status !== 'Resolved').length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="budget">
          <BudgetTab sysId={id} items={budgetItems} onRefresh={load} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab sysId={id} expenses={expenses} onRefresh={load} />
        </TabsContent>
        <TabsContent value="incidents">
          <IncidentsTab sysId={id} incidents={incidents} onRefresh={load} />
        </TabsContent>
      </Tabs>

      {showEditSystem && (
        <EditSystemDialog
          system={system}
          projects={projects}
          onClose={() => setShowEditSystem(false)}
          onSaved={() => { setShowEditSystem(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Budget Tab ───────────────────────────────────────────────────────────────

function BudgetTab({ sysId, items, onRefresh }: { sysId: string; items: BudgetItem[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<BudgetItem | null>(null);

  const handleDelete = async (itemId: number) => {
    await fetch(`/api/operations/systems/${sysId}/budget-items/${itemId}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    onRefresh();
  };

  const grouped = items.reduce((acc, i) => {
    if (!acc[i.category]) acc[i.category] = [];
    acc[i.category].push(i);
    return acc;
  }, {} as Record<string, BudgetItem[]>);

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Thêm hạng mục
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">Chưa có hạng mục chi phí nào</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, catItems]) => {
            const planned = catItems.reduce((s, i) => s + Number(i.planned_amount), 0);
            const actual = catItems.reduce((s, i) => s + Number(i.actual_amount), 0);
            return (
              <div key={cat} className="rounded-lg border overflow-hidden">
                <div className="px-4 py-2 bg-muted/50 flex items-center justify-between text-sm font-medium">
                  <span>{cat}</span>
                  <span className="text-muted-foreground text-xs">
                    Thực tế {fmt(actual)} / KH {fmt(planned)} VND
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium text-muted-foreground">Tên</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">KH</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">TT</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">%</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Đơn vị</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Kỳ</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map(item => {
                      const pct = Number(item.planned_amount) > 0
                        ? ((Number(item.actual_amount) / Number(item.planned_amount)) * 100).toFixed(0)
                        : '—';
                      const over = Number(item.actual_amount) > Number(item.planned_amount) && Number(item.planned_amount) > 0;
                      return (
                        <tr key={item.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">{item.name}</td>
                          <td className="p-3 text-right">{fmt(item.planned_amount)}</td>
                          <td className={`p-3 text-right ${over ? 'text-red-600 font-medium' : ''}`}>{fmt(item.actual_amount)}</td>
                          <td className={`p-3 text-right ${over ? 'text-red-600' : ''}`}>{pct}%</td>
                          <td className="p-3 text-muted-foreground">{item.unit}</td>
                          <td className="p-3 text-muted-foreground">{item.period_label}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditItem(item)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <BudgetItemFormDialog
          sysId={sysId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {editItem && (
        <BudgetItemFormDialog
          sysId={sysId}
          existing={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => { setEditItem(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ sysId, expenses, onRefresh }: { sysId: string; expenses: Expense[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);

  const handleDelete = async (expId: number) => {
    if (!confirm('Xóa chi phí này?')) return;
    await fetch(`/api/operations/systems/${sysId}/expenses/${expId}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    onRefresh();
  };

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">
          Tổng: <span className="font-medium text-foreground">{fmt(total)} VND</span>
        </span>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Thêm chi phí
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Ngày</th>
              <th className="text-left p-3 font-medium">Hạng mục</th>
              <th className="text-left p-3 font-medium">Mô tả</th>
              <th className="text-right p-3 font-medium">Số tiền (VND)</th>
              <th className="text-left p-3 font-medium">Tham chiếu</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chưa có chi phí nào</td></tr>
            ) : expenses.map(exp => (
              <tr key={exp.id} className="border-t hover:bg-muted/30">
                <td className="p-3 whitespace-nowrap">{exp.expense_date?.toString().split('T')[0]}</td>
                <td className="p-3">{exp.category}</td>
                <td className="p-3">{exp.description}</td>
                <td className="p-3 text-right font-mono">{Number(exp.amount).toLocaleString('vi-VN')}</td>
                <td className="p-3 text-muted-foreground text-xs">{exp.reference}</td>
                <td className="p-3">
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(exp.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <ExpenseFormDialog
          sysId={sysId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Incidents Tab ────────────────────────────────────────────────────────────

function IncidentsTab({ sysId, incidents, onRefresh }: { sysId: string; incidents: Incident[]; onRefresh: () => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editInc, setEditInc] = useState<Incident | null>(null);

  const handleDelete = async (incId: number) => {
    if (!confirm('Xóa incident này?')) return;
    await fetch(`/api/operations/systems/${sysId}/incidents/${incId}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    onRefresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Thêm incident
        </Button>
      </div>

      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Chưa có incident nào</div>
        ) : incidents.map(inc => (
          <div key={inc.id} className="p-4 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.Medium}`}>
                    {inc.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${INCIDENT_STATUS_COLORS[inc.status] ?? ''}`}>
                    {inc.status}
                  </span>
                  {Number(inc.cost_impact) > 0 && (
                    <span className="text-xs text-red-600">Impact: {fmt(inc.cost_impact)} VND</span>
                  )}
                </div>
                <p className="font-medium text-sm">{inc.title}</p>
                {inc.description && <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Báo cáo: {inc.reported_at}</span>
                  {inc.resolved_at && <span>Giải quyết: {inc.resolved_at}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditInc(inc)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(inc.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <IncidentFormDialog
          sysId={sysId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {editInc && (
        <IncidentFormDialog
          sysId={sysId}
          existing={editInc}
          onClose={() => setEditInc(null)}
          onSaved={() => { setEditInc(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Form Dialogs ─────────────────────────────────────────────────────────────

function EditSystemDialog({
  system, projects, onClose, onSaved,
}: {
  system: System;
  projects: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: system.name,
    description: system.description ?? '',
    project_id: system.project_id?.toString() ?? '',
    go_live_date: system.go_live_date ?? '',
    status: system.status,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await fetch(`/api/operations/systems/${system.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, project_id: form.project_id && form.project_id !== 'none' ? parseInt(form.project_id) : null }),
    });
    setSaving(false);
    toast.success('Đã lưu');
    onSaved();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Chỉnh sửa hệ thống</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Tên hệ thống</Label>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dự án gốc</Label>
              <Select value={form.project_id ?? ''} onValueChange={v => setForm(p => ({ ...p, project_id: v ?? '' }))}>
                <SelectTrigger><SelectValue placeholder="Không liên kết" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Không liên kết —</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
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
            <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
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
          <Button onClick={handleSubmit} disabled={saving}>Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetItemFormDialog({
  sysId, existing, onClose, onSaved,
}: {
  sysId: string;
  existing?: BudgetItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    category: existing?.category ?? 'OPEX',
    name: existing?.name ?? '',
    planned_amount: existing?.planned_amount?.toString() ?? '',
    actual_amount: existing?.actual_amount?.toString() ?? '',
    unit: existing?.unit ?? 'VND/month',
    period_label: existing?.period_label ?? '',
    notes: existing?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Vui lòng nhập tên'); return; }
    setSaving(true);
    const url = existing
      ? `/api/operations/systems/${sysId}/budget-items/${existing.id}`
      : `/api/operations/systems/${sysId}/budget-items`;
    const res = await fetch(url, {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        planned_amount: parseFloat(form.planned_amount) || 0,
        actual_amount: parseFloat(form.actual_amount) || 0,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success(existing ? 'Đã cập nhật' : 'Đã thêm'); onSaved(); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? 'Chỉnh sửa' : 'Thêm hạng mục chi phí'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hạng mục</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tên *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="vd: Cloud infrastructure" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Chi phí KH</Label>
              <Input value={form.planned_amount} onChange={e => setForm(p => ({ ...p, planned_amount: e.target.value }))} type="number" />
            </div>
            <div>
              <Label>Chi phí TT</Label>
              <Input value={form.actual_amount} onChange={e => setForm(p => ({ ...p, actual_amount: e.target.value }))} type="number" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Đơn vị</Label>
              <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="VND/month" />
            </div>
            <div>
              <Label>Kỳ áp dụng</Label>
              <Input value={form.period_label} onChange={e => setForm(p => ({ ...p, period_label: e.target.value }))} placeholder="Q1-2026" />
            </div>
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>{existing ? 'Lưu' : 'Thêm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseFormDialog({ sysId, onClose, onSaved }: { sysId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'OPEX',
    description: '',
    amount: '',
    reference: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    const res = await fetch(`/api/operations/systems/${sysId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    });
    setSaving(false);
    if (res.ok) { toast.success('Đã thêm'); onSaved(); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Thêm chi phí thực tế</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ngày</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} />
            </div>
            <div>
              <Label>Hạng mục</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mô tả</Label>
            <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Số tiền (VND)</Label>
              <Input value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} type="number" />
            </div>
            <div>
              <Label>Tham chiếu</Label>
              <Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Hóa đơn, PO..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>Thêm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IncidentFormDialog({
  sysId, existing, onClose, onSaved,
}: {
  sysId: string;
  existing?: Incident;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: existing?.title ?? '',
    severity: existing?.severity ?? 'Medium',
    description: existing?.description ?? '',
    reported_at: existing?.reported_at ?? new Date().toISOString().split('T')[0],
    resolved_at: existing?.resolved_at ?? '',
    cost_impact: existing?.cost_impact?.toString() ?? '',
    status: existing?.status ?? 'Open',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.title) { toast.error('Vui lòng nhập tiêu đề'); return; }
    setSaving(true);
    const url = existing
      ? `/api/operations/systems/${sysId}/incidents/${existing.id}`
      : `/api/operations/systems/${sysId}/incidents`;
    const res = await fetch(url, {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        cost_impact: parseFloat(form.cost_impact) || 0,
        resolved_at: form.resolved_at || null,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success(existing ? 'Đã cập nhật' : 'Đã thêm'); onSaved(); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{existing ? 'Chỉnh sửa incident' : 'Thêm incident'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Tiêu đề *</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Critical', 'High', 'Medium', 'Low'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Open', 'In Progress', 'Resolved'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Mô tả</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Báo cáo lúc</Label>
              <Input type="date" value={form.reported_at} onChange={e => setForm(p => ({ ...p, reported_at: e.target.value }))} />
            </div>
            <div>
              <Label>Giải quyết lúc</Label>
              <Input type="date" value={form.resolved_at} onChange={e => setForm(p => ({ ...p, resolved_at: e.target.value }))} />
            </div>
            <div>
              <Label>Cost impact (VND)</Label>
              <Input value={form.cost_impact} onChange={e => setForm(p => ({ ...p, cost_impact: e.target.value }))} type="number" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving}>{existing ? 'Lưu' : 'Thêm'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
