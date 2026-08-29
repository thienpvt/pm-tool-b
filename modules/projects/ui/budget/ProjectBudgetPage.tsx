'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, DollarSign, TrendingUp, TrendingDown,
  Wallet, PieChart, ChevronDown, ChevronRight, AlertCircle, Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type BudgetExpense = {
  id: number; budget_item_id: number;
  expense_date: string; description: string;
  amount: number; reference: string;
};
type BudgetItem = {
  id: number; project_id: number;
  type: 'CAPEX' | 'OPEX';
  group_name: string; name: string;
  planned_amount: number; approved_amount: number; actual_amount: number;
  budget_status: string;
  unit: string; notes: string;
  expenses: BudgetExpense[];
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CURRENCY_PREFIX: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', SGD: 'S$', AUD: 'A$', CAD: 'C$',
  JPY: '¥', CNY: '¥', KRW: '₩', VND: '₫', THB: '฿', IDR: 'Rp ', MYR: 'RM ', PHP: '₱',
};
const NO_DEC = new Set(['VND', 'JPY', 'KRW', 'IDR']);
const UNIT_PRESETS = [
  'USD', 'VND', 'EUR', 'GBP', 'SGD', 'JPY', 'CNY', 'AUD', 'CAD', 'KRW', 'THB', 'IDR', 'MYR', 'PHP',
  'person-day', 'man-hour', 'man-month',
];

const EMPTY_FORM = {
  type: 'CAPEX' as 'CAPEX' | 'OPEX',
  group_name: '', name: '', planned_amount: '', approved_amount: '', actual_amount: '', unit: 'USD', notes: '',
};
const EMPTY_EXP = {
  expense_date: new Date().toISOString().slice(0, 10),
  description: '', amount: '', reference: '',
};

// ─── Formatters ───────────────────────────────────────────────────────────────
function formatDisplayAmount(v: string): string {
  if (!v) return '';
  const parts = v.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart;
}

function fmtAmount(n: number, unit: string, compact = false): string {
  const u = (unit || '').toUpperCase();
  const prefix = CURRENCY_PREFIX[u] ?? '';
  const noDec = NO_DEC.has(u);
  if (compact) {
    const abs = Math.abs(n);
    const neg = n < 0 ? '-' : '';
    if (abs >= 1_000_000_000) return `${neg}${prefix}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000)     return `${neg}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)         return `${neg}${prefix}${(abs / 1_000).toFixed(0)}K`;
    return `${neg}${prefix}${abs.toLocaleString('en-US')}`;
  }
  if (prefix) {
    const dec = noDec ? 0 : 2;
    return prefix + n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function utilPct(planned: number, actual: number) {
  return planned > 0 ? Math.round((actual / planned) * 100) : 0;
}

// ─── SVG Donut ────────────────────────────────────────────────────────────────
function polarXY(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}
function slicePath(cx: number, cy: number, R: number, ir: number, a1: number, a2: number): string {
  const span = a2 - a1;
  if (span >= 359.99) return `M${cx},${cy - R} A${R},${R},0,1,1,${cx - 0.01},${cy - R} L${cx - 0.01},${cy - ir} A${ir},${ir},0,1,0,${cx},${cy - ir} Z`;
  const [x1, y1] = polarXY(cx, cy, R, a1), [x2, y2] = polarXY(cx, cy, R, a2);
  const [x3, y3] = polarXY(cx, cy, ir, a2), [x4, y4] = polarXY(cx, cy, ir, a1);
  return `M${x1},${y1} A${R},${R},0,${span > 180 ? 1 : 0},1,${x2},${y2} L${x3},${y3} A${ir},${ir},0,${span > 180 ? 1 : 0},0,${x4},${y4} Z`;
}
function Donut({ slices, size = 140 }: { slices: { label: string; value: number; color: string }[]; size?: number }) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const cx = size / 2, cy = size / 2, R = size * 0.42, ir = size * 0.27;
  if (total === 0) return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth={R - ir} />
      <text x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={11} fill="#94a3b8">No data</text>
    </svg>
  );
  let angle = 0;
  return (
    <svg width={size} height={size}>
      {slices.filter(s => s.value > 0).map((s, i) => {
        const sweep = (s.value / total) * 360;
        const d = slicePath(cx, cy, R, ir, angle, angle + sweep);
        angle += sweep;
        return <path key={i} d={d} fill={s.color} />;
      })}
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={13} fontWeight="700" fill="#0f172a">{fmtAmount(total, '', true)}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fill="#64748b">total</text>
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string; sub?: string; color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-xl font-bold text-slate-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [items, setItems]               = useState<BudgetItem[]>([]);
  const [completionPct, setCompletion]  = useState(0);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<'ALL' | 'CAPEX' | 'OPEX'>('ALL');
  const [projectBudgetStatus, setProjectBudgetStatus] = useState('draft');
  const [allocation, setAllocation]     = useState<{ allocated_amount: number; period_label: string; portfolio_budget_id: number } | null>(null);
  const [openGroups, setOpenGroups]     = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editItem, setEditItem]         = useState<BudgetItem | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });
  const [saving, setSaving]             = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<BudgetItem | null>(null);
  const [expenseTarget, setExpenseTarget] = useState<BudgetItem | null>(null);
  const [expForm, setExpForm]           = useState({ ...EMPTY_EXP });
  const [expSaving, setExpSaving]       = useState(false);
  const [unitOpen, setUnitOpen]         = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [budgetRes, projRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/budget`),
      fetch(`/api/projects/${projectId}`),
    ]);
    if (budgetRes.ok) {
      const d = await budgetRes.json();
      const mapped = (d.items as any[]).map(i => ({
        ...i,
        planned_amount:   Number(i.planned_amount),
        approved_amount:  Number(i.approved_amount ?? 0),
        actual_amount:    Number(i.actual_amount),
        budget_status:    i.budget_status ?? 'draft',
        expenses: (i.expenses ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) })),
      }));
      setItems(mapped);
      setCompletion(d.completion_pct ?? 0);
      setOpenGroups(new Set(mapped.map((i: BudgetItem) => `${i.type}::${i.group_name}`)));
      setLoading(false);
    }
    if (projRes.ok) {
      const proj = await projRes.json();
      setProjectBudgetStatus(proj.budget_status ?? 'draft');
    }
    // Fetch portfolio allocation for this project
    const budgetsRes = await fetch('/api/portfolio/budgets');
    if (budgetsRes.ok) {
      const budgets = await budgetsRes.json() as any[];
      for (const b of budgets) {
        const detailRes = await fetch(`/api/portfolio/budgets/${b.id}/allocations`);
        if (detailRes.ok) {
          const allocs = await detailRes.json() as any[];
          const myAlloc = allocs.find((a: any) => String(a.project_id) === String(projectId));
          if (myAlloc) {
            setAllocation({ allocated_amount: Number(myAlloc.allocated_amount), period_label: b.period_label, portfolio_budget_id: b.id });
            break;
          }
        }
      }
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const dominantUnit = useMemo(() => {
    if (items.length === 0) return 'USD';
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.unit, (counts.get(i.unit) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [items]);

  const filtered = useMemo(() =>
    tab === 'ALL' ? items : items.filter(i => i.type === tab),
    [items, tab]
  );

  const totals = useMemo(() => {
    const planned  = items.reduce((s, i) => s + i.planned_amount, 0);
    const approved = items.reduce((s, i) => s + i.approved_amount, 0);
    const actual   = items.reduce((s, i) => s + i.actual_amount, 0);
    const capexP   = items.filter(i => i.type === 'CAPEX').reduce((s, i) => s + i.planned_amount, 0);
    const opexP    = items.filter(i => i.type === 'OPEX').reduce((s, i) => s + i.planned_amount, 0);
    const capexA   = items.filter(i => i.type === 'CAPEX').reduce((s, i) => s + i.actual_amount, 0);
    const opexA    = items.filter(i => i.type === 'OPEX').reduce((s, i) => s + i.actual_amount, 0);
    const remaining = planned - actual;
    const util = utilPct(planned, actual);
    const ev   = completionPct > 0 ? (planned * completionPct) / 100 : 0;
    const cpi  = actual > 0 ? ev / actual : null;
    const eac  = cpi && cpi > 0 ? planned / cpi : actual > 0 ? actual : null;
    const etc  = eac !== null ? eac - actual : null;
    return { planned, approved, actual, capexP, opexP, capexA, opexA, remaining, util, ev, cpi, eac, etc };
  }, [items, completionPct]);

  const groups = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    for (const item of filtered) {
      const key = `${item.type}::${item.group_name || '(No Group)'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([key, gitems]) => {
      const [type, group] = key.split('::');
      return { key, type, group, items: gitems };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.group.localeCompare(b.group));
  }, [filtered]);

  const barData = useMemo(() => {
    const map = new Map<string, { planned: number; actual: number }>();
    for (const item of items) {
      const key = item.group_name || '(No Group)';
      if (!map.has(key)) map.set(key, { planned: 0, actual: 0 });
      map.get(key)!.planned += item.planned_amount;
      map.get(key)!.actual  += item.actual_amount;
    }
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [items]);

  // ── Dialog helpers ────────────────────────────────────────────────────────────
  function openAdd() {
    setEditItem(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }
  function openEdit(item: BudgetItem) {
    setEditItem(item);
    setForm({
      type: item.type, group_name: item.group_name, name: item.name,
      planned_amount:  String(item.planned_amount),
      approved_amount: String(item.approved_amount ?? 0),
      actual_amount:   String(item.actual_amount),
      unit: item.unit, notes: item.notes,
    });
    setDialogOpen(true);
  }

  async function handleSubmitForApproval() {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget_status: 'submitted' }),
    });
    if (res.ok) { toast.success('Budget submitted for approval'); setProjectBudgetStatus('submitted'); }
    else toast.error('Failed to submit');
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    const body = {
      ...form,
      planned_amount:  parseFloat(form.planned_amount)  || 0,
      approved_amount: parseFloat(form.approved_amount) || 0,
      actual_amount:   parseFloat(form.actual_amount)   || 0,
    };
    const url    = editItem ? `/api/projects/${projectId}/budget/${editItem.id}` : `/api/projects/${projectId}/budget`;
    const method = editItem ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { toast.error((await res.json()).error ?? 'Failed to save'); return; }
    toast.success(editItem ? 'Item updated' : 'Item added');
    setDialogOpen(false);
    load();
  }

  async function handleDelete(item: BudgetItem) {
    const res = await fetch(`/api/projects/${projectId}/budget/${item.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Item deleted');
    setDeleteConfirm(null);
    load();
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleItem(id: number) {
    setExpandedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAddExpense() {
    if (!expenseTarget) return;
    if (!expForm.description.trim()) { toast.error('Description is required'); return; }
    setExpSaving(true);
    const res = await fetch(`/api/projects/${projectId}/budget/${expenseTarget.id}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expense_date: expForm.expense_date,
        description:  expForm.description.trim(),
        amount:       parseFloat(expForm.amount) || 0,
        reference:    expForm.reference.trim(),
      }),
    });
    setExpSaving(false);
    if (!res.ok) { toast.error('Failed to log expense'); return; }
    toast.success('Expense logged');
    setExpenseTarget(null);
    load();
  }

  async function handleDeleteExpense(itemId: number, expId: number) {
    const res = await fetch(`/api/projects/${projectId}/budget/${itemId}/expenses/${expId}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to delete expense'); return; }
    toast.success('Expense removed');
    load();
  }

  const unitSuggestions = useMemo(() =>
    [...new Set(items.map(i => i.unit).filter(Boolean))],
    [items]
  );
  const groupSuggestions = useMemo(() =>
    [...new Set(items.filter(i => i.type === form.type).map(i => i.group_name).filter(Boolean))],
    [items, form.type]
  );

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const isOverBudget = totals.actual > totals.planned && totals.planned > 0;
  const isOverAllocation = allocation !== null && totals.planned > allocation.allocated_amount;
  const GRID = '28px 80px 1fr 120px 120px 120px 60px 60px 70px 56px';

  const BUDGET_STATUS_LABELS: Record<string, string> = { draft: 'Draft', submitted: 'Pending Approval', approved: 'Approved' };
  const BUDGET_STATUS_COLORS: Record<string, string> = { draft: 'bg-gray-100 text-gray-700', submitted: 'bg-amber-100 text-amber-700', approved: 'bg-green-100 text-green-700' };

  return (
    <>
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-500" />
                Budget &amp; Cost
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${BUDGET_STATUS_COLORS[projectBudgetStatus] ?? BUDGET_STATUS_COLORS.draft}`}>
                  {BUDGET_STATUS_LABELS[projectBudgetStatus] ?? projectBudgetStatus}
                </span>
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Plan and track project expenditure · CAPEX &amp; OPEX
              </p>
            </div>
            <div className="flex items-center gap-2">
              {projectBudgetStatus === 'draft' && items.length > 0 && (
                <Button variant="outline" onClick={handleSubmitForApproval} className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50">
                  Submit for Approval
                </Button>
              )}
              <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>
          </div>

          {/* ── Allocation warning ── */}
          {allocation && (
            <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 text-sm ${isOverAllocation ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
              <AlertCircle className={`h-4 w-4 shrink-0 ${isOverAllocation ? 'text-red-500' : 'text-blue-500'}`} />
              <div>
                <span className={`font-semibold ${isOverAllocation ? 'text-red-700' : 'text-blue-700'}`}>
                  Phân bổ từ khối [{allocation.period_label}]: {fmtAmount(allocation.allocated_amount, dominantUnit)}
                </span>
                {isOverAllocation ? (
                  <span className="ml-2 text-red-600">
                    ⚠ Vượt phân bổ {fmtAmount(totals.planned - allocation.allocated_amount, dominantUnit)}
                  </span>
                ) : (
                  <span className="ml-2 text-blue-500">
                    · Còn {fmtAmount(allocation.allocated_amount - totals.planned, dominantUnit)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Total Budget"   value={fmtAmount(totals.planned, dominantUnit, true)} sub={`${items.length} items`}             color="bg-blue-50 text-blue-600"   icon={Wallet} />
            <KpiCard label="Total Actual"   value={fmtAmount(totals.actual,  dominantUnit, true)} sub={`${totals.util}% utilized`}           color={isOverBudget ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'} icon={DollarSign} />
            <KpiCard label="Remaining"      value={fmtAmount(Math.abs(totals.remaining), dominantUnit, true)} sub={totals.remaining < 0 ? '⚠ Over budget' : 'available'} color={totals.remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} icon={totals.remaining < 0 ? TrendingUp : TrendingDown} />
            <KpiCard label="CAPEX Budget"   value={fmtAmount(totals.capexP,  dominantUnit, true)} sub={`Actual: ${fmtAmount(totals.capexA, dominantUnit, true)}`} color="bg-purple-50 text-purple-600" icon={PieChart} />
            <KpiCard label="OPEX Budget"    value={fmtAmount(totals.opexP,   dominantUnit, true)} sub={`Actual: ${fmtAmount(totals.opexA,  dominantUnit, true)}`} color="bg-amber-50 text-amber-600"   icon={PieChart} />
            <KpiCard
              label={totals.cpi !== null ? `CPI ${totals.cpi.toFixed(2)}` : 'CPI'}
              value={totals.eac !== null ? fmtAmount(totals.eac, dominantUnit, true) : '—'}
              sub={totals.eac !== null ? 'Est. at Completion' : 'No activity data'}
              color={totals.cpi !== null && totals.cpi < 1 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}
              icon={totals.cpi !== null && totals.cpi < 1 ? AlertCircle : TrendingUp}
            />
          </div>

          {/* ── Charts ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

            {/* Donut: CAPEX vs OPEX */}
            <div className="xl:col-span-2 bg-white rounded-xl border p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Budget Breakdown</h3>
                <p className="text-[11px] text-slate-400">CAPEX vs OPEX (planned)</p>
              </div>
              <div className="flex items-center gap-6">
                <Donut
                  slices={[
                    { label: 'CAPEX', value: totals.capexP, color: '#8b5cf6' },
                    { label: 'OPEX',  value: totals.opexP,  color: '#f59e0b' },
                  ]}
                  size={140}
                />
                <div className="flex flex-col gap-3 flex-1">
                  {[
                    { label: 'CAPEX', planned: totals.capexP, actual: totals.capexA, color: 'bg-purple-500' },
                    { label: 'OPEX',  planned: totals.opexP,  actual: totals.opexA,  color: 'bg-amber-400' },
                  ].map(({ label, planned, actual, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-sm ${color}`} />
                          <span className="font-semibold text-slate-700">{label}</span>
                        </span>
                        <span className="text-slate-500">{utilPct(planned, actual)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, utilPct(planned, actual))}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>Actual: {fmtAmount(actual, dominantUnit, true)}</span>
                        <span>Plan: {fmtAmount(planned, dominantUnit, true)}</span>
                      </div>
                    </div>
                  ))}
                  {totals.etc !== null && (
                    <div className="mt-1 text-[11px] bg-slate-50 rounded-lg px-3 py-2 border">
                      <p className="text-slate-500">ETC (Est. To Complete)</p>
                      <p className="font-bold text-slate-700">{fmtAmount(Math.max(0, totals.etc), dominantUnit, true)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bar: Budget vs Actual by group */}
            <div className="xl:col-span-3 bg-white rounded-xl border p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700">Budget vs Actual by Group</h3>
                <p className="text-[11px] text-slate-400">Planned (blue) vs Actual (amber)</p>
              </div>
              {barData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={barData} barGap={2} barCategoryGap="30%">
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v) => fmtAmount(Number(v ?? 0), dominantUnit)}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="planned" name="Planned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actual"  name="Actual"  fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Table section ── */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

            {/* Tabs + header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-slate-50/60 flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-white rounded-lg border p-0.5">
                {(['ALL', 'CAPEX', 'OPEX'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {t}
                    <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold ${tab === t ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {t === 'ALL' ? items.length : items.filter(i => i.type === t).length}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {fmtAmount(filtered.reduce((s, i) => s + i.planned_amount, 0), dominantUnit)} planned ·{' '}
                {fmtAmount(filtered.reduce((s, i) => s + i.actual_amount,  0), dominantUnit)} actual
              </p>
            </div>

            {/* Column headers */}
            <div className="grid gap-0 text-[10px] font-bold text-slate-400 uppercase tracking-wide px-4 py-2 border-b bg-slate-50/40"
              style={{ gridTemplateColumns: GRID }}>
              <span />
              <span>Type</span>
              <span>Name</span>
              <span className="text-right">Estimate</span>
              <span className="text-right">Approved</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Util%</span>
              <span>Notes</span>
              <span />
            </div>

            {filtered.length === 0 && (
              <div className="text-center py-16 text-slate-300">
                <DollarSign className="h-10 w-10 mx-auto mb-2" />
                <p className="text-sm">No budget items yet.</p>
                <button onClick={openAdd} className="mt-2 text-sm text-blue-500 hover:underline">+ Add first item</button>
              </div>
            )}

            {/* Grouped rows */}
            {groups.map(({ key, type, group, items: gItems }) => {
              const gPlanned = gItems.reduce((s, i) => s + i.planned_amount, 0);
              const gActual  = gItems.reduce((s, i) => s + i.actual_amount,  0);
              const isOpen   = openGroups.has(key);
              return (
                <div key={key} className="border-b last:border-b-0">
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left"
                  >
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    <Badge className={`text-[10px] font-bold shrink-0 ${type === 'CAPEX' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                      {type}
                    </Badge>
                    <span className="text-xs font-semibold text-slate-700 flex-1">{group}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{gItems.length} items</span>
                    <span className="text-[11px] text-slate-500 font-semibold shrink-0 ml-4">
                      {fmtAmount(gActual, dominantUnit, true)} / {fmtAmount(gPlanned, dominantUnit, true)}
                    </span>
                    <span className={`text-[10px] font-bold shrink-0 ml-2 ${utilPct(gPlanned, gActual) > 100 ? 'text-red-600' : 'text-slate-500'}`}>
                      {utilPct(gPlanned, gActual)}%
                    </span>
                  </button>

                  {/* Items */}
                  {isOpen && gItems.map(item => {
                    const util    = utilPct(item.planned_amount, item.actual_amount);
                    const over    = util > 100;
                    const hasExp  = item.expenses.length > 0;
                    const isExpanded = expandedItems.has(item.id);
                    return (
                      <div key={item.id} className="border-t">
                        {/* Main row */}
                        <div
                          className="grid items-center gap-0 px-4 py-2.5 hover:bg-slate-50/60 transition-colors text-sm"
                          style={{ gridTemplateColumns: GRID }}
                        >
                          {/* Expand toggle */}
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="p-0.5 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors"
                            title="Show expense log"
                          >
                            {isExpanded
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRight className="h-3 w-3" />}
                          </button>

                          <Badge className={`text-[10px] font-bold w-fit ${type === 'CAPEX' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.type}
                          </Badge>
                          <span className="text-xs font-semibold text-slate-700 truncate pr-2">{item.name}</span>
                          <span className="text-xs text-right text-slate-600 font-medium tabular-nums">
                            {fmtAmount(item.planned_amount, item.unit)}
                          </span>
                          <span className={`text-xs text-right font-medium tabular-nums ${item.approved_amount > 0 && item.approved_amount !== item.planned_amount ? 'text-amber-600 font-semibold' : 'text-slate-600'}`}>
                            {item.approved_amount > 0 ? fmtAmount(item.approved_amount, item.unit) : '—'}
                          </span>
                          <div className="flex flex-col items-end">
                            <span className={`text-xs font-semibold tabular-nums ${over ? 'text-red-600' : 'text-slate-700'}`}>
                              {fmtAmount(item.actual_amount, item.unit)}
                            </span>
                            {hasExp && (
                              <span className="text-[9px] text-blue-500 font-medium">{item.expenses.length} entries</span>
                            )}
                          </div>
                          <span className="text-xs text-right text-slate-400">{item.unit}</span>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-[11px] font-bold ${over ? 'text-red-600' : util >= 80 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {util}%
                            </span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${over ? 'bg-red-500' : util >= 80 ? 'bg-amber-400' : 'bg-blue-400'}`}
                                style={{ width: `${Math.min(100, util)}%` }} />
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 truncate px-1">{item.notes || '—'}</span>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => { setExpenseTarget(item); setExpForm({ ...EMPTY_EXP }); }}
                              className="p-1 rounded hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-colors"
                              title="Log expense"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-600 transition-colors">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(item)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-600 transition-colors">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expense log panel */}
                        {isExpanded && (
                          <div className="mx-4 mb-2 rounded-lg border border-blue-100 bg-blue-50/30 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-blue-100 bg-blue-50/50">
                              <span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1.5">
                                <Receipt className="h-3 w-3" /> Expense Log
                                {hasExp && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">{item.expenses.length}</span>}
                              </span>
                              <button
                                onClick={() => { setExpenseTarget(item); setExpForm({ ...EMPTY_EXP }); }}
                                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" /> Log Expense
                              </button>
                            </div>
                            {item.expenses.length === 0 ? (
                              <p className="text-[11px] text-slate-400 px-3 py-3 text-center">No expenses logged yet. Click "Log Expense" to add actual cost entries.</p>
                            ) : (
                              <div>
                                <div className="grid text-[10px] font-bold text-slate-400 uppercase tracking-wide px-3 py-1.5 border-b border-blue-100"
                                  style={{ gridTemplateColumns: '100px 1fr 120px 100px 28px' }}>
                                  <span>Date</span>
                                  <span>Description</span>
                                  <span className="text-right">Amount</span>
                                  <span>Ref / PO</span>
                                  <span />
                                </div>
                                {item.expenses.map(exp => (
                                  <div key={exp.id} className="grid items-center px-3 py-1.5 border-b border-blue-100/60 last:border-b-0 hover:bg-blue-50/40"
                                    style={{ gridTemplateColumns: '100px 1fr 120px 100px 28px' }}>
                                    <span className="text-[11px] text-slate-500">{exp.expense_date?.slice(0, 10)}</span>
                                    <span className="text-[11px] text-slate-700 font-medium truncate pr-2">{exp.description}</span>
                                    <span className="text-[11px] text-right font-semibold text-slate-700 tabular-nums">{fmtAmount(exp.amount, item.unit)}</span>
                                    <span className="text-[11px] text-slate-400 truncate">{exp.reference || '—'}</span>
                                    <button
                                      onClick={() => handleDeleteExpense(item.id, exp.id)}
                                      className="p-0.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                                <div className="flex justify-end px-3 py-1.5 border-t border-blue-100 bg-blue-50/50">
                                  <span className="text-[11px] font-bold text-slate-600">
                                    Total: {fmtAmount(item.expenses.reduce((s, e) => s + e.amount, 0), item.unit)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Grand total footer */}
            {filtered.length > 0 && (
              <div className="grid items-center gap-0 px-4 py-3 bg-slate-50 border-t text-xs font-bold text-slate-700"
                style={{ gridTemplateColumns: GRID }}>
                <span /><span />
                <span className="text-slate-500 font-semibold">TOTAL</span>
                <span className="text-right tabular-nums">{fmtAmount(filtered.reduce((s, i) => s + i.planned_amount, 0), dominantUnit)}</span>
                <span className="text-right tabular-nums text-amber-700">
                  {filtered.reduce((s, i) => s + i.approved_amount, 0) > 0
                    ? fmtAmount(filtered.reduce((s, i) => s + i.approved_amount, 0), dominantUnit)
                    : '—'}
                </span>
                <span className={`text-right tabular-nums ${isOverBudget ? 'text-red-600' : ''}`}>
                  {fmtAmount(filtered.reduce((s, i) => s + i.actual_amount, 0), dominantUnit)}
                </span>
                <span />
                <span className={`text-right ${totals.util > 100 ? 'text-red-600' : ''}`}>{totals.util}%</span>
                <span /><span />
              </div>
            )}
          </div>

          {/* ── EVM section ── */}
          {totals.planned > 0 && completionPct > 0 && (
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-1">Earned Value Metrics</h3>
              <p className="text-[11px] text-slate-400 mb-4">
                Based on {completionPct}% schedule completion · helps forecast final cost
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Planned Value (PV)',    value: fmtAmount(totals.planned, dominantUnit), sub: '100% budget',                color: 'text-blue-600'  },
                  { label: 'Earned Value (EV)',      value: fmtAmount(totals.ev, dominantUnit),      sub: `${completionPct}% × budget`, color: 'text-green-600' },
                  { label: 'Actual Cost (AC)',        value: fmtAmount(totals.actual, dominantUnit),  sub: 'spent so far',               color: 'text-slate-700' },
                  { label: 'Cost Perf. Index (CPI)', value: totals.cpi !== null ? totals.cpi.toFixed(2) : '—', sub: totals.cpi !== null ? (totals.cpi >= 1 ? 'Under budget ✓' : 'Over budget ⚠') : 'No spend yet', color: totals.cpi !== null && totals.cpi < 1 ? 'text-red-600' : 'text-green-600' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
                    <p className={`text-xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
              {totals.eac !== null && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`rounded-lg p-3 border flex items-center gap-3 ${totals.eac > totals.planned ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <AlertCircle className={`h-4 w-4 shrink-0 ${totals.eac > totals.planned ? 'text-red-500' : 'text-green-500'}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Estimate at Completion (EAC)</p>
                      <p className={`text-lg font-bold tabular-nums ${totals.eac > totals.planned ? 'text-red-600' : 'text-green-600'}`}>{fmtAmount(totals.eac, dominantUnit)}</p>
                      <p className="text-[10px] text-slate-500">
                        {totals.eac > totals.planned
                          ? `+${fmtAmount(totals.eac - totals.planned, dominantUnit)} over planned`
                          : `${fmtAmount(totals.planned - totals.eac, dominantUnit)} under planned`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg p-3 border bg-slate-50 flex items-center gap-3">
                    <TrendingDown className="h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Estimate to Complete (ETC)</p>
                      <p className="text-lg font-bold text-blue-600 tabular-nums">{fmtAmount(Math.max(0, totals.etc ?? 0), dominantUnit)}</p>
                      <p className="text-[10px] text-slate-500">remaining spend forecast</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
{/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" />
              {editItem ? 'Edit Budget Item' : 'Add Budget Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {/* Type */}
            <div>
              <Label className="text-xs">Type *</Label>
              <div className="flex gap-2 mt-1.5">
                {(['CAPEX', 'OPEX'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      form.type === t
                        ? t === 'CAPEX' ? 'bg-purple-600 text-white border-purple-600' : 'bg-amber-500 text-white border-amber-500'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
            {/* Group */}
            <div>
              <Label className="text-xs">Cost Group</Label>
              <Input
                className="mt-1.5"
                value={form.group_name}
                onChange={e => setForm(f => ({ ...f, group_name: e.target.value }))}
                placeholder="e.g. AWS Infrastructure"
                list="group-suggestions"
              />
              <datalist id="group-suggestions">
                {groupSuggestions.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>
            {/* Name */}
            <div>
              <Label className="text-xs">Item Name *</Label>
              <Input
                className="mt-1.5"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Server license"
                autoFocus
              />
            </div>
            {/* Unit */}
            <div>
              <Label className="text-xs">Unit (currency / measure)</Label>
              <div className="relative mt-1.5">
                <input
                  className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={form.unit}
                  onChange={e => { setForm(f => ({ ...f, unit: e.target.value })); setUnitOpen(true); }}
                  onFocus={() => setUnitOpen(true)}
                  onBlur={() => setTimeout(() => setUnitOpen(false), 150)}
                  placeholder="USD / VND / person-day"
                  autoComplete="off"
                />
                {unitOpen && (() => {
                  const query = form.unit.toLowerCase();
                  const allUnits = [...UNIT_PRESETS, ...unitSuggestions.filter(u => !UNIT_PRESETS.includes(u))];
                  const opts = query ? allUnits.filter(u => u.toLowerCase().includes(query)) : allUnits;
                  return opts.length > 0 ? (
                    <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {opts.map(u => (
                        <button
                          key={u}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg"
                          onMouseDown={() => { setForm(f => ({ ...f, unit: u })); setUnitOpen(false); }}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Currency symbols auto-applied: $USD €EUR £GBP ₫VND ¥JPY …</p>
            </div>
            {/* Amounts */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Estimate</Label>
                <Input
                  className="mt-1.5"
                  type="text"
                  inputMode="decimal"
                  value={focusedField === 'planned' ? form.planned_amount : formatDisplayAmount(form.planned_amount)}
                  onFocus={() => setFocusedField('planned')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => setForm(f => ({ ...f, planned_amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Approved</Label>
                <Input
                  className="mt-1.5"
                  type="text"
                  inputMode="decimal"
                  value={focusedField === 'approved' ? form.approved_amount : formatDisplayAmount(form.approved_amount)}
                  onFocus={() => setFocusedField('approved')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => setForm(f => ({ ...f, approved_amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">
                  Actual
                  {editItem && editItem.expenses.length > 0 && (
                    <span className="ml-1 text-blue-500">(auto)</span>
                  )}
                </Label>
                <Input
                  className="mt-1.5"
                  type="text"
                  inputMode="decimal"
                  value={focusedField === 'actual' ? form.actual_amount : formatDisplayAmount(form.actual_amount)}
                  onFocus={() => setFocusedField('actual')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => setForm(f => ({ ...f, actual_amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                  placeholder="0"
                  readOnly={!!(editItem && editItem.expenses.length > 0)}
                  disabled={!!(editItem && editItem.expenses.length > 0)}
                />
                {editItem && editItem.expenses.length > 0 && (
                  <p className="text-[10px] text-blue-500 mt-0.5">From {editItem.expenses.length} entries</p>
                )}
              </div>
            </div>
            {/* Notes */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="mt-1.5 resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Log Expense Dialog ── */}
      <Dialog open={!!expenseTarget} onOpenChange={() => setExpenseTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              Log Expense
            </DialogTitle>
          </DialogHeader>
          {expenseTarget && (
            <div className="space-y-3 py-1">
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border">
                <span className="font-semibold text-slate-700">{expenseTarget.name}</span>
                {' · '}{expenseTarget.type} · {expenseTarget.unit}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date *</Label>
                  <Input
                    type="date"
                    className="mt-1.5"
                    value={expForm.expense_date}
                    onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Amount ({expenseTarget.unit})</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="mt-1.5"
                    value={focusedField === 'exp_amount' ? expForm.amount : formatDisplayAmount(expForm.amount)}
                    onFocus={() => setFocusedField('exp_amount')}
                    onBlur={() => setFocusedField(null)}
                    onChange={e => setExpForm(f => ({ ...f, amount: e.target.value.replace(/[^0-9.]/g, '') }))}
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Description *</Label>
                <Input
                  className="mt-1.5"
                  value={expForm.description}
                  onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. AWS invoice Apr 2025"
                />
              </div>
              <div>
                <Label className="text-xs">Reference / PO No. (optional)</Label>
                <Input
                  className="mt-1.5"
                  value={expForm.reference}
                  onChange={e => setExpForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="e.g. INV-2025-042"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseTarget(null)}>Cancel</Button>
            <Button onClick={handleAddExpense} disabled={expSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {expSaving ? 'Saving…' : 'Log Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete budget item?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            <strong>{deleteConfirm?.name}</strong> and all its expense records will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
