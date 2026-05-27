'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle, ChevronRight, Pencil } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioBudget {
  id: number;
  period_type: string;
  period_label: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  currency: string;
  status: string;
  notes: string;
  total_allocated: number;
}

interface Category {
  id: number;
  portfolio_budget_id: number;
  category: string;
  ceiling_amount: number;
  notes: string;
}

interface Allocation {
  id: number;
  portfolio_budget_id: number;
  project_id: number | null;
  project_name: string | null;
  allocated_amount: number;
  total_estimate: number;
  total_approved: number;
  total_actual: number;
  notes: string;
}

interface BudgetDetail {
  budget: PortfolioBudget;
  categories: Category[];
  allocations: Allocation[];
  summary: {
    total_allocated: number;
    over_total: boolean;
    category_warnings: Record<string, { ceiling: number; used: number }>;
  };
}

interface Project { id: number; name: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['CAPEX', 'OPEX', 'Vận hành', 'Other'];

function fmt(n: number | string, currency = 'VND') {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (currency === 'VND') {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} tỷ`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} triệu`;
    return num.toLocaleString('vi-VN');
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    approved: 'bg-green-100 text-green-700',
    locked: 'bg-blue-100 text-blue-700',
  };
  const labels: Record<string, string> = { draft: 'Draft', approved: 'Approved', locked: 'Locked' };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[s] ?? map.draft}`}>{labels[s] ?? s}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortfolioBudgetPage() {
  const [budgets, setBudgets] = useState<PortfolioBudget[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BudgetDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEditBudget, setShowEditBudget] = useState(false);

  const loadBudgets = useCallback(async () => {
    const res = await fetch('/api/portfolio/budgets');
    if (res.ok) setBudgets(await res.json());
  }, []);

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects ?? data);
    }
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/portfolio/budgets/${id}`);
    if (res.ok) setDetail(await res.json());
  }, []);

  useEffect(() => { loadBudgets(); loadProjects(); }, [loadBudgets, loadProjects]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId, loadDetail]);

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa kỳ ngân sách này?')) return;
    await fetch(`/api/portfolio/budgets/${id}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    if (selectedId === id) { setSelectedId(null); setDetail(null); }
    loadBudgets();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel: budget list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="font-semibold text-lg">Portfolio Budget</h1>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Tạo kỳ
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {budgets.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Chưa có kỳ ngân sách nào.</p>
          )}
          {budgets.map(b => {
            const used = Number(b.total_allocated);
            const total = Number(b.total_amount);
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
            const over = used > total;
            return (
              <div
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className={`p-4 cursor-pointer border-b hover:bg-muted/50 transition-colors ${selectedId === b.id ? 'bg-muted' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{b.period_label}</span>
                  {statusBadge(b.status)}
                </div>
                <div className="text-xs text-muted-foreground mb-2">{b.start_date} → {b.end_date}</div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>{fmt(used, b.currency)} / {fmt(total, b.currency)} {b.currency}</span>
                  {over && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: detail */}
      <div className="flex-1 overflow-y-auto">
        {!detail ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <ChevronRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Chọn một kỳ ngân sách để xem chi tiết</p>
            </div>
          </div>
        ) : (
          <BudgetDetailPanel
            detail={detail}
            projects={projects}
            onRefresh={() => { loadBudgets(); if (selectedId) loadDetail(selectedId); }}
            onDelete={() => handleDelete(detail.budget.id)}
            onEdit={() => setShowEditBudget(true)}
          />
        )}
      </div>

      {/* Create budget dialog */}
      {showCreate && (
        <CreateBudgetDialog
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); loadBudgets(); setSelectedId(id); }}
        />
      )}

      {/* Edit budget dialog */}
      {showEditBudget && detail && (
        <EditBudgetDialog
          budget={detail.budget}
          onClose={() => setShowEditBudget(false)}
          onSaved={() => {
            setShowEditBudget(false);
            loadBudgets();
            if (selectedId) loadDetail(selectedId);
          }}
        />
      )}
    </div>
  );
}

// ─── Budget Detail Panel ──────────────────────────────────────────────────────

function BudgetDetailPanel({
  detail, projects, onRefresh, onDelete, onEdit,
}: {
  detail: BudgetDetail;
  projects: Project[];
  onRefresh: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const { budget, categories, allocations, summary } = detail;
  const currency = budget.currency;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">{budget.period_label}</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{budget.start_date} → {budget.end_date}</span>
            <span>•</span>
            {statusBadge(budget.status)}
            {summary.over_total && (
              <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Vượt tổng ngân sách
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="w-4 h-4 mr-1" /> Sửa</Button>
          <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-1" /> Xóa</Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Tổng ngân sách</div>
          <div className="text-xl font-bold">{fmt(budget.total_amount, currency)}</div>
          <div className="text-xs text-muted-foreground">{currency}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Đã phân bổ</div>
          <div className={`text-xl font-bold ${summary.over_total ? 'text-red-600' : ''}`}>
            {fmt(summary.total_allocated, currency)}
          </div>
          <div className="text-xs text-muted-foreground">{currency}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Còn lại</div>
          <div className={`text-xl font-bold ${summary.over_total ? 'text-red-600' : 'text-green-600'}`}>
            {fmt(Number(budget.total_amount) - summary.total_allocated, currency)}
          </div>
          <div className="text-xs text-muted-foreground">{currency}</div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="allocations">Phân bổ dự án</TabsTrigger>
          <TabsTrigger value="categories">Hạng mục</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab categories={categories} summary={summary} currency={currency} />
        </TabsContent>

        <TabsContent value="allocations">
          <AllocationsTab
            budgetId={budget.id}
            allocations={allocations}
            projects={projects}
            currency={currency}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="categories">
          <CategoriesTab
            budgetId={budget.id}
            categories={categories}
            currency={currency}
            onRefresh={onRefresh}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  categories, summary, currency,
}: {
  categories: Category[];
  summary: BudgetDetail['summary'];
  currency: string;
}) {
  if (categories.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        Chưa có hạng mục nào. Thêm hạng mục tại tab &quot;Hạng mục&quot;.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map(cat => {
        const warn = summary.category_warnings[cat.category];
        const used = warn?.used ?? 0;
        const ceiling = Number(cat.ceiling_amount);
        const pct = ceiling > 0 ? Math.min(100, (used / ceiling) * 100) : 0;
        const over = used > ceiling && ceiling > 0;

        return (
          <div key={cat.id} className="p-4 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{cat.category}</span>
                {over && <AlertTriangle className="w-4 h-4 text-amber-500" />}
              </div>
              <span className="text-sm text-muted-foreground">
                {fmt(used, currency)} / {fmt(ceiling, currency)} {currency}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full ${over ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {over && (
              <p className="text-xs text-amber-600 mt-1">
                Vượt trần {fmt(used - ceiling, currency)} {currency}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Allocations Tab ──────────────────────────────────────────────────────────

function AllocationsTab({
  budgetId, allocations, projects, currency, onRefresh,
}: {
  budgetId: number;
  allocations: Allocation[];
  projects: Project[];
  currency: string;
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    await fetch(`/api/portfolio/budgets/${budgetId}/allocations/${id}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    onRefresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Thêm phân bổ
        </Button>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Dự án</th>
              <th className="text-right p-3 font-medium">Phân bổ</th>
              <th className="text-right p-3 font-medium">Estimate PM</th>
              <th className="text-right p-3 font-medium">Đã duyệt</th>
              <th className="text-right p-3 font-medium">Thực tế</th>
              <th className="text-right p-3 font-medium">% Dùng</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {allocations.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Chưa có phân bổ nào</td></tr>
            ) : allocations.map(a => {
              const alloc = Number(a.allocated_amount);
              const est = Number(a.total_estimate);
              const pct = alloc > 0 ? ((est / alloc) * 100).toFixed(0) : '—';
              const over = est > alloc && alloc > 0;
              return (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{a.project_name ?? <span className="italic text-muted-foreground">Chưa chọn dự án</span>}</td>
                  <td className="p-3 text-right">{fmt(alloc, currency)}</td>
                  <td className={`p-3 text-right ${over ? 'text-red-600 font-medium' : ''}`}>
                    {fmt(est, currency)}
                    {over && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-red-500" />}
                  </td>
                  <td className="p-3 text-right">{fmt(a.total_approved, currency)}</td>
                  <td className="p-3 text-right">{fmt(a.total_actual, currency)}</td>
                  <td className={`p-3 text-right ${over ? 'text-red-600' : ''}`}>{pct}%</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditId(a.id)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id)}>
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

      {showAdd && (
        <AllocationFormDialog
          budgetId={budgetId}
          projects={projects}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {editId !== null && (
        <AllocationFormDialog
          budgetId={budgetId}
          projects={projects}
          existing={allocations.find(a => a.id === editId)}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({
  budgetId, categories, currency, onRefresh,
}: {
  budgetId: number;
  categories: Category[];
  currency: string;
  onRefresh: () => void;
}) {
  const [newCat, setNewCat] = useState({ category: '', ceiling_amount: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!newCat.category) return;
    setSaving(true);
    const res = await fetch(`/api/portfolio/budgets/${budgetId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCat, ceiling_amount: parseFloat(newCat.ceiling_amount) || 0 }),
    });
    setSaving(false);
    if (res.ok) { toast.success('Đã thêm hạng mục'); setNewCat({ category: '', ceiling_amount: '', notes: '' }); onRefresh(); }
  };

  const handleUpdate = async (cat: Category, field: string, value: string) => {
    await fetch(`/api/portfolio/budgets/${budgetId}/categories/${cat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...cat, [field]: field === 'ceiling_amount' ? parseFloat(value) || 0 : value }),
    });
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/portfolio/budgets/${budgetId}/categories/${id}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {categories.map(cat => (
        <div key={cat.id} className="p-4 rounded-lg border bg-card flex items-start gap-3">
          <div className="w-36">
            <Input
              defaultValue={cat.category}
              onBlur={e => handleUpdate(cat, 'category', e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="flex-1">
            <Input
              defaultValue={cat.ceiling_amount?.toString()}
              onBlur={e => handleUpdate(cat, 'ceiling_amount', e.target.value)}
              className="h-8 text-sm text-right"
              placeholder={`Trần (${currency})`}
            />
          </div>
          <div className="flex-1">
            <Input
              defaultValue={cat.notes}
              onBlur={e => handleUpdate(cat, 'notes', e.target.value)}
              className="h-8 text-sm"
              placeholder="Ghi chú"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ))}

      {/* Add row */}
      <div className="p-4 rounded-lg border border-dashed bg-muted/30 flex items-start gap-3">
        <div className="w-36">
          <Select value={newCat.category} onValueChange={v => setNewCat(p => ({ ...p, category: v }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Hạng mục" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Input
            value={newCat.ceiling_amount}
            onChange={e => setNewCat(p => ({ ...p, ceiling_amount: e.target.value }))}
            className="h-8 text-sm text-right"
            placeholder={`Trần (${currency})`}
          />
        </div>
        <div className="flex-1">
          <Input
            value={newCat.notes}
            onChange={e => setNewCat(p => ({ ...p, notes: e.target.value }))}
            className="h-8 text-sm"
            placeholder="Ghi chú"
          />
        </div>
        <Button size="sm" onClick={handleAdd} disabled={saving || !newCat.category}>
          <Plus className="w-4 h-4 mr-1" /> Thêm
        </Button>
      </div>
    </div>
  );
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

function CreateBudgetDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({
    period_type: 'quarterly',
    period_label: '',
    start_date: '',
    end_date: '',
    total_amount: '',
    currency: 'VND',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.period_label || !form.start_date || !form.end_date) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/portfolio/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: parseFloat(form.total_amount) || 0 }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      toast.success('Đã tạo kỳ ngân sách');
      onCreated(data.id);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Tạo kỳ ngân sách mới</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại kỳ</Label>
              <Select value={form.period_type} onValueChange={v => setForm(p => ({ ...p, period_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quý</SelectItem>
                  <SelectItem value="monthly">Tháng</SelectItem>
                  <SelectItem value="yearly">Năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nhãn kỳ *</Label>
              <Input value={form.period_label} onChange={e => setForm(p => ({ ...p, period_label: e.target.value }))} placeholder="Q1-2026" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ngày bắt đầu *</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Ngày kết thúc *</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tổng ngân sách</Label>
              <Input value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))} placeholder="0" type="number" />
            </div>
            <div>
              <Label>Đơn vị tiền</Label>
              <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VND">VND</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
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

function EditBudgetDialog({ budget, onClose, onSaved }: { budget: PortfolioBudget; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    period_type: budget.period_type,
    period_label: budget.period_label,
    start_date: budget.start_date,
    end_date: budget.end_date,
    total_amount: budget.total_amount?.toString() ?? '',
    currency: budget.currency,
    status: budget.status,
    notes: budget.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    const res = await fetch(`/api/portfolio/budgets/${budget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: parseFloat(form.total_amount) || 0 }),
    });
    setSaving(false);
    if (res.ok) { toast.success('Đã lưu'); onSaved(); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Chỉnh sửa kỳ ngân sách</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Loại kỳ</Label>
              <Select value={form.period_type} onValueChange={v => setForm(p => ({ ...p, period_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quarterly">Quý</SelectItem>
                  <SelectItem value="monthly">Tháng</SelectItem>
                  <SelectItem value="yearly">Năm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nhãn kỳ</Label>
              <Input value={form.period_label} onChange={e => setForm(p => ({ ...p, period_label: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ngày bắt đầu</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div>
              <Label>Ngày kết thúc</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Tổng ngân sách</Label>
              <Input value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))} type="number" />
            </div>
            <div>
              <Label>Đơn vị tiền</Label>
              <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VND">VND</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
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

function AllocationFormDialog({
  budgetId, projects, existing, onClose, onSaved,
}: {
  budgetId: number;
  projects: Project[];
  existing?: Allocation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    project_id: existing?.project_id?.toString() ?? '',
    allocated_amount: existing?.allocated_amount?.toString() ?? '',
    notes: existing?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    const url = existing
      ? `/api/portfolio/budgets/${budgetId}/allocations/${existing.id}`
      : `/api/portfolio/budgets/${budgetId}/allocations`;
    const res = await fetch(url, {
      method: existing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: form.project_id ? parseInt(form.project_id) : null,
        allocated_amount: parseFloat(form.allocated_amount) || 0,
        notes: form.notes,
      }),
    });
    setSaving(false);
    if (res.ok) { toast.success(existing ? 'Đã cập nhật' : 'Đã thêm'); onSaved(); }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Chỉnh sửa phân bổ' : 'Thêm phân bổ dự án'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Dự án</Label>
            <Select value={form.project_id} onValueChange={v => setForm(p => ({ ...p, project_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Chọn dự án" /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Số tiền phân bổ</Label>
            <Input
              value={form.allocated_amount}
              onChange={e => setForm(p => ({ ...p, allocated_amount: e.target.value }))}
              type="number"
              placeholder="0"
            />
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
