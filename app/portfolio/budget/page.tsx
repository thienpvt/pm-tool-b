'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, AlertTriangle, ChevronRight, Pencil, X } from 'lucide-react';

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

// Line item for CAPEX/OPEX breakdown
type LineItem = { id: string; label: string; amount: string };

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CAPEX: LineItem[] = [
  { id: 'c1', label: 'Phần cứng & Thiết bị', amount: '' },
  { id: 'c2', label: 'Phần mềm bản quyền', amount: '' },
  { id: 'c3', label: 'Hạ tầng & Data Center', amount: '' },
  { id: 'c4', label: 'Phát triển phần mềm (vốn hóa)', amount: '' },
  { id: 'c5', label: 'Khác (CAPEX)', amount: '' },
];

const DEFAULT_OPEX: LineItem[] = [
  { id: 'o1', label: 'Nhân sự (lương, phụ cấp)', amount: '' },
  { id: 'o2', label: 'Dịch vụ & Thuê ngoài', amount: '' },
  { id: 'o3', label: 'Vận hành & Bảo trì hệ thống', amount: '' },
  { id: 'o4', label: 'Đào tạo & Phát triển', amount: '' },
  { id: 'o5', label: 'Chi phí văn phòng & Tiện ích', amount: '' },
  { id: 'o6', label: 'Khác (OPEX)', amount: '' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | string, currency = 'VND') {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (currency === 'VND') {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)} tỷ`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} triệu`;
    return num.toLocaleString('vi-VN');
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtFull(n: number | string, currency = 'VND') {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num) || num === 0) return '—';
  if (currency === 'VND') return num.toLocaleString('vi-VN');
  return num.toLocaleString('en-US');
}

function parseSubItems(notes: string): Array<{ label: string; amount: number }> {
  try {
    const parsed = JSON.parse(notes || '');
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
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

      {showCreate && (
        <CreateBudgetDialog
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); loadBudgets(); setSelectedId(id); }}
        />
      )}

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
          <div className="text-xl font-bold font-mono">{fmt(budget.total_amount, currency)}</div>
          <div className="text-xs text-muted-foreground">{currency}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Đã phân bổ</div>
          <div className={`text-xl font-bold font-mono ${summary.over_total ? 'text-red-600' : ''}`}>
            {fmt(summary.total_allocated, currency)}
          </div>
          <div className="text-xs text-muted-foreground">{currency}</div>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="text-xs text-muted-foreground mb-1">Còn lại</div>
          <div className={`text-xl font-bold font-mono ${summary.over_total ? 'text-red-600' : 'text-green-600'}`}>
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

  const grandCeiling = categories.reduce((s, c) => s + Number(c.ceiling_amount), 0);

  return (
    <div className="space-y-4">
      {categories.map(cat => {
        const warn = summary.category_warnings[cat.category];
        const used = warn?.used ?? 0;
        const ceiling = Number(cat.ceiling_amount);
        const pct = ceiling > 0 ? Math.min(100, (used / ceiling) * 100) : 0;
        const over = used > ceiling && ceiling > 0;
        const subItems = parseSubItems(cat.notes);
        const isCAPEX = cat.category === 'CAPEX';
        const isOPEX = cat.category === 'OPEX';
        const accentColor = isCAPEX
          ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          : isOPEX
          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
          : 'bg-muted/30';
        const barColor = isCAPEX ? (over ? 'bg-red-500' : 'bg-blue-500') : isOPEX ? (over ? 'bg-red-500' : 'bg-amber-500') : 'bg-slate-500';
        const pctOfTotal = grandCeiling > 0 ? ((ceiling / grandCeiling) * 100).toFixed(0) : '0';

        return (
          <div key={cat.id} className={`rounded-lg border overflow-hidden ${accentColor}`}>
            {/* Category header */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-wide">{cat.category}</span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-background/60 rounded">
                    {pctOfTotal}% tổng
                  </span>
                  {over && <AlertTriangle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    Đã dùng / Trần
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    <span className={over ? 'text-red-600' : ''}>{fmtFull(used, currency)}</span>
                    <span className="text-muted-foreground"> / {fmtFull(ceiling, currency)}</span>
                    <span className="text-xs text-muted-foreground ml-1">{currency}</span>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-background/60 dark:bg-black/20 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              {over && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠ Vượt trần {fmtFull(used - ceiling, currency)} {currency}
                </p>
              )}
            </div>

            {/* Sub-items breakdown */}
            {subItems.length > 0 && (
              <div className="bg-background/70 dark:bg-background/10">
                <div className="grid grid-cols-[1fr_auto] text-xs text-muted-foreground border-t px-4 py-1.5 font-medium">
                  <span>Hạng mục chi tiết</span>
                  <span className="text-right">Dự toán ({currency})</span>
                </div>
                {subItems.map((item, idx) => {
                  const itemPct = ceiling > 0 ? ((item.amount / ceiling) * 100).toFixed(0) : '0';
                  return (
                    <div key={idx} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-4 py-2 border-t text-sm">
                      <span className="text-muted-foreground text-xs w-5 text-right">{idx + 1}</span>
                      <span className="text-foreground/80">{item.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{itemPct}%</span>
                      <span className="font-mono text-sm text-right min-w-[120px]">{fmtFull(item.amount, currency)}</span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1fr_auto] items-center px-4 py-2.5 border-t bg-muted/20">
                  <span className="font-semibold text-sm">Tổng {cat.category}</span>
                  <span className="font-bold font-mono text-sm">{fmtFull(ceiling, currency)} {currency}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Grand total */}
      {categories.length > 0 && (
        <div className="rounded-lg border bg-muted/50 px-5 py-4 flex items-center justify-between">
          <span className="font-bold text-base">Tổng ngân sách kế hoạch</span>
          <div className="text-right">
            <div className="font-bold font-mono text-xl">{fmtFull(grandCeiling, currency)}</div>
            <div className="text-xs text-muted-foreground">{currency} • {fmt(grandCeiling, currency)}</div>
          </div>
        </div>
      )}
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
                  <td className="p-3 text-right font-mono">{fmtFull(alloc, currency)}</td>
                  <td className={`p-3 text-right font-mono ${over ? 'text-red-600 font-medium' : ''}`}>
                    {fmtFull(est, currency)}
                    {over && <AlertTriangle className="w-3.5 h-3.5 inline ml-1 text-red-500" />}
                  </td>
                  <td className="p-3 text-right font-mono">{fmtFull(a.total_approved, currency)}</td>
                  <td className="p-3 text-right font-mono">{fmtFull(a.total_actual, currency)}</td>
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
      {categories.map(cat => {
        const subItems = parseSubItems(cat.notes);
        return (
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
                className="h-8 text-sm text-right font-mono"
                placeholder={`Trần (${currency})`}
              />
              {cat.ceiling_amount > 0 && (
                <p className="text-xs text-muted-foreground mt-1 text-right">{fmt(cat.ceiling_amount, currency)} {currency}</p>
              )}
            </div>
            <div className="flex-1">
              {subItems.length > 0 ? (
                <div className="h-8 flex items-center px-2 text-xs text-muted-foreground bg-muted/30 rounded border">
                  {subItems.length} hạng mục chi tiết
                </div>
              ) : (
                <Input
                  defaultValue={cat.notes}
                  onBlur={e => handleUpdate(cat, 'notes', e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Ghi chú"
                />
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        );
      })}

      {/* Add row */}
      <div className="p-4 rounded-lg border border-dashed bg-muted/30 flex items-start gap-3">
        <div className="w-36">
          <Input
            value={newCat.category}
            onChange={e => setNewCat(p => ({ ...p, category: e.target.value }))}
            className="h-8 text-sm"
            placeholder="Tên hạng mục"
          />
        </div>
        <div className="flex-1">
          <Input
            value={newCat.ceiling_amount}
            onChange={e => setNewCat(p => ({ ...p, ceiling_amount: e.target.value }))}
            className="h-8 text-sm text-right font-mono"
            placeholder={`Trần (${currency})`}
            type="number"
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

// ── Line Item Table ──────────────────────────────────────────────────────────

function LineItemTable({
  title,
  items,
  setItems,
  currency,
  total,
  accentClass,
  totalLabelColor,
  idPrefix,
}: {
  title: string;
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  currency: string;
  total: number;
  accentClass: string;
  totalLabelColor: string;
  idPrefix: string;
}) {
  const updateItem = (id: string, field: 'label' | 'amount', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id));
  const addItem = () => setItems(prev => [...prev, { id: `${idPrefix}${Date.now()}`, label: '', amount: '' }]);

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Section header */}
      <div className={`px-4 py-2.5 flex items-center justify-between border-b ${accentClass}`}>
        <span className="font-semibold text-sm tracking-wide">{title}</span>
        <div className="text-right">
          <span className={`font-bold font-mono text-sm ${totalLabelColor}`}>
            {fmtFull(total, currency)}
          </span>
          {total > 0 && (
            <span className={`text-xs ml-1 ${totalLabelColor} opacity-70`}>
              ({fmt(total, currency)})
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-1">{currency}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[28px_1fr_200px_32px] bg-muted/40 border-b text-xs text-muted-foreground font-medium">
        <div className="p-2 text-center">#</div>
        <div className="p-2">Hạng mục</div>
        <div className="p-2 text-right">Dự toán ({currency})</div>
        <div></div>
      </div>

      {/* Rows */}
      {items.map((item, idx) => (
        <div key={item.id} className="grid grid-cols-[28px_1fr_200px_32px] border-b items-center hover:bg-muted/20">
          <div className="p-2 text-center text-xs text-muted-foreground">{idx + 1}</div>
          <div className="px-1 py-1">
            <Input
              value={item.label}
              onChange={e => updateItem(item.id, 'label', e.target.value)}
              className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent px-2"
              placeholder="Tên hạng mục..."
            />
          </div>
          <div className="px-1 py-1">
            <div className="relative">
              <Input
                value={item.amount}
                onChange={e => updateItem(item.id, 'amount', e.target.value)}
                className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 font-mono"
                type="number"
                min="0"
                placeholder="0"
              />
            </div>
            {parseFloat(item.amount) > 0 && (
              <p className="text-[10px] text-muted-foreground text-right px-2 leading-none">
                {fmt(parseFloat(item.amount), currency)}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center">
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 text-muted-foreground/40 hover:text-red-500 transition-colors"
              title="Xóa dòng"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}

      {/* Add row button */}
      <div className="px-3 py-2 border-b">
        <button
          onClick={addItem}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3 h-3" /> Thêm hạng mục
        </button>
      </div>

      {/* Total footer */}
      <div className={`grid grid-cols-[28px_1fr_200px_32px] ${accentClass}`}>
        <div></div>
        <div className="p-3 font-semibold text-sm">Tổng {title.split(' ')[0]}</div>
        <div className="p-3 text-right font-bold font-mono text-sm">
          {fmtFull(total, currency)}
        </div>
        <div></div>
      </div>
    </div>
  );
}

// ── Create Budget Dialog ──────────────────────────────────────────────────────

function CreateBudgetDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({
    period_type: 'quarterly',
    period_label: '',
    start_date: '',
    end_date: '',
    currency: 'VND',
    notes: '',
  });
  const [capexItems, setCapexItems] = useState<LineItem[]>(DEFAULT_CAPEX.map(i => ({ ...i })));
  const [opexItems, setOpexItems] = useState<LineItem[]>(DEFAULT_OPEX.map(i => ({ ...i })));
  const [saving, setSaving] = useState(false);

  const capexTotal = capexItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const opexTotal = opexItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const grandTotal = capexTotal + opexTotal;

  const handleSubmit = async () => {
    if (!form.period_label || !form.start_date || !form.end_date) {
      toast.error('Vui lòng điền đầy đủ: Nhãn kỳ, Ngày bắt đầu, Ngày kết thúc');
      return;
    }
    setSaving(true);

    // 1. Create budget
    const res = await fetch('/api/portfolio/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: grandTotal }),
    });
    if (!res.ok) {
      setSaving(false);
      toast.error('Không thể tạo kỳ ngân sách');
      return;
    }
    const data = await res.json();
    const budgetId = data.id;

    // 2. Auto-create CAPEX category if items entered
    const capexLines = capexItems.filter(i => parseFloat(i.amount) > 0 && i.label.trim());
    if (capexTotal > 0) {
      await fetch(`/api/portfolio/budgets/${budgetId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'CAPEX',
          ceiling_amount: capexTotal,
          notes: JSON.stringify(capexLines.map(i => ({ label: i.label.trim(), amount: parseFloat(i.amount) || 0 }))),
        }),
      });
    }

    // 3. Auto-create OPEX category if items entered
    const opexLines = opexItems.filter(i => parseFloat(i.amount) > 0 && i.label.trim());
    if (opexTotal > 0) {
      await fetch(`/api/portfolio/budgets/${budgetId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'OPEX',
          ceiling_amount: opexTotal,
          notes: JSON.stringify(opexLines.map(i => ({ label: i.label.trim(), amount: parseFloat(i.amount) || 0 }))),
        }),
      });
    }

    setSaving(false);
    toast.success('Đã tạo kỳ ngân sách');
    onCreated(budgetId);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Tạo kỳ ngân sách mới</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* ── Basic info ── */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thông tin kỳ ngân sách</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Loại kỳ</Label>
                <Select value={form.period_type} onValueChange={v => setForm(p => ({ ...p, period_type: v ?? '' }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quý (Quarterly)</SelectItem>
                    <SelectItem value="monthly">Tháng (Monthly)</SelectItem>
                    <SelectItem value="yearly">Năm (Yearly)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nhãn kỳ <span className="text-red-500">*</span></Label>
                <Input
                  value={form.period_label}
                  onChange={e => setForm(p => ({ ...p, period_label: e.target.value }))}
                  placeholder="VD: Q1-2026, FY2026..."
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Từ ngày <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Đến ngày <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Đơn vị tiền</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v ?? '' }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VND">VND — Việt Nam Đồng</SelectItem>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── CAPEX ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Chi phí Vốn (CAPEX) — Capital Expenditure
            </p>
            <LineItemTable
              title="CAPEX — Chi phí Vốn"
              items={capexItems}
              setItems={setCapexItems}
              currency={form.currency}
              total={capexTotal}
              accentClass="bg-blue-50 dark:bg-blue-950/30"
              totalLabelColor="text-blue-700 dark:text-blue-300"
              idPrefix="cx"
            />
          </div>

          {/* ── OPEX ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Chi phí Vận hành (OPEX) — Operating Expenditure
            </p>
            <LineItemTable
              title="OPEX — Chi phí Vận hành"
              items={opexItems}
              setItems={setOpexItems}
              currency={form.currency}
              total={opexTotal}
              accentClass="bg-amber-50 dark:bg-amber-950/30"
              totalLabelColor="text-amber-700 dark:text-amber-300"
              idPrefix="ox"
            />
          </div>

          {/* ── Grand Total ── */}
          <div className="rounded-lg border-2 border-primary/20 bg-primary/5 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-base">Tổng Ngân Sách Kế Hoạch</p>
                <p className="text-xs text-muted-foreground mt-0.5">CAPEX + OPEX = Tổng ngân sách kỳ</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-2xl font-mono">{fmtFull(grandTotal, form.currency)}</p>
                <p className="text-sm text-muted-foreground font-mono">{fmt(grandTotal, form.currency)} {form.currency}</p>
              </div>
            </div>
            {grandTotal > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-4 pt-3 border-t border-primary/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">CAPEX</span>
                  <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{fmtFull(capexTotal, form.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">OPEX</span>
                  <span className="font-mono font-medium text-amber-700 dark:text-amber-300">{fmtFull(opexTotal, form.currency)}</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Notes ── */}
          <div>
            <Label className="text-xs">Ghi chú / Giả định ngân sách</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              placeholder="Ví dụ: Ngân sách dựa trên kế hoạch dự án Q1-2026, tỷ giá USD/VND = 25,000..."
              className="mt-1 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSubmit} disabled={saving} className="min-w-[140px]">
            {saving ? 'Đang tạo...' : 'Tạo kỳ ngân sách'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Budget Dialog ────────────────────────────────────────────────────────

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
              <Select value={form.period_type} onValueChange={v => setForm(p => ({ ...p, period_type: v ?? '' }))}>
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
              {parseFloat(form.total_amount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">{fmt(parseFloat(form.total_amount), form.currency)}</p>
              )}
            </div>
            <div>
              <Label>Đơn vị tiền</Label>
              <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v ?? '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VND">VND</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v ?? '' }))}>
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

// ── Allocation Form Dialog ────────────────────────────────────────────────────

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
            <Select value={form.project_id ?? ''} onValueChange={v => setForm(p => ({ ...p, project_id: v ?? '' }))}>
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
              className="font-mono"
            />
            {parseFloat(form.allocated_amount) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{fmt(parseFloat(form.allocated_amount), 'VND')} VND</p>
            )}
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
