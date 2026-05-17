'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, DollarSign, TrendingUp, TrendingDown,
  Wallet, PieChart, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type BudgetItem = {
  id: number; project_id: number;
  type: 'CAPEX' | 'OPEX';
  group_name: string; name: string;
  planned_amount: number; actual_amount: number;
  unit: string; notes: string;
};

const EMPTY_FORM = {
  type: 'CAPEX' as 'CAPEX' | 'OPEX',
  group_name: '', name: '',
  planned_amount: '', actual_amount: '',
  unit: 'USD', notes: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtNum(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
function fmtFull(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function variance(planned: number, actual: number) { return planned - actual; }
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
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={13} fontWeight="700" fill="#0f172a">{fmtNum(total)}</text>
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
      <p className="text-2xl font-bold text-slate-800 leading-none">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BudgetPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [items, setItems]             = useState<BudgetItem[]>([]);
  const [completionPct, setCompletion] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<'ALL' | 'CAPEX' | 'OPEX'>('ALL');
  const [openGroups, setOpenGroups]   = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editItem, setEditItem]       = useState<BudgetItem | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<BudgetItem | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/budget`)
      .then(r => r.json())
      .then(d => {
        const mapped = (d.items as any[]).map(i => ({
          ...i,
          planned_amount: Number(i.planned_amount),
          actual_amount:  Number(i.actual_amount),
        }));
        setItems(mapped);
        setCompletion(d.completion_pct ?? 0);
        setOpenGroups(new Set(mapped.map((i: BudgetItem) => `${i.type}::${i.group_name}`)));
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    tab === 'ALL' ? items : items.filter(i => i.type === tab),
    [items, tab]
  );

  const totals = useMemo(() => {
    const planned   = items.reduce((s, i) => s + i.planned_amount, 0);
    const actual    = items.reduce((s, i) => s + i.actual_amount, 0);
    const capexP    = items.filter(i => i.type === 'CAPEX').reduce((s, i) => s + i.planned_amount, 0);
    const opexP     = items.filter(i => i.type === 'OPEX').reduce((s, i)  => s + i.planned_amount, 0);
    const capexA    = items.filter(i => i.type === 'CAPEX').reduce((s, i) => s + i.actual_amount, 0);
    const opexA     = items.filter(i => i.type === 'OPEX').reduce((s, i)  => s + i.actual_amount, 0);
    const remaining = planned - actual;
    const util      = utilPct(planned, actual);
    // EVM
    const ev  = completionPct > 0 ? (planned * completionPct) / 100 : 0;
    const cpi = actual > 0 ? ev / actual : null;
    const eac = cpi && cpi > 0 ? planned / cpi : actual > 0 ? actual : null;
    const etc = eac !== null ? eac - actual : null;
    return { planned, actual, capexP, opexP, capexA, opexA, remaining, util, ev, cpi, eac, etc };
  }, [items, completionPct]);

  // Groups for table
  const groups = useMemo(() => {
    const map = new Map<string, BudgetItem[]>();
    for (const item of filtered) {
      const key = `${item.type}::${item.group_name || '(No Group)'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([key, items]) => {
      const [type, group] = key.split('::');
      return { key, type, group, items };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.group.localeCompare(b.group));
  }, [filtered]);

  // Bar chart data by group
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
      planned_amount: String(item.planned_amount),
      actual_amount:  String(item.actual_amount),
      unit: item.unit, notes: item.notes,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    setSaving(true);
    const body = {
      ...form,
      planned_amount: parseFloat(form.planned_amount) || 0,
      actual_amount:  parseFloat(form.actual_amount)  || 0,
    };
    const url    = editItem
      ? `/api/projects/${projectId}/budget/${editItem.id}`
      : `/api/projects/${projectId}/budget`;
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
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
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
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  const isOverBudget = totals.actual > totals.planned && totals.planned > 0;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-6 w-6 text-blue-500" />
                Budget &amp; Cost
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Plan and track project expenditure · CAPEX &amp; OPEX
              </p>
            </div>
            <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard label="Total Budget"   value={fmtNum(totals.planned)}   sub={`${items.length} items`}          color="bg-blue-50 text-blue-600"   icon={Wallet} />
            <KpiCard label="Total Actual"   value={fmtNum(totals.actual)}    sub={`${totals.util}% utilized`}        color={isOverBudget ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-600'} icon={DollarSign} />
            <KpiCard label="Remaining"      value={fmtNum(Math.abs(totals.remaining))} sub={totals.remaining < 0 ? '⚠ Over budget' : 'available'} color={totals.remaining < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'} icon={totals.remaining < 0 ? TrendingUp : TrendingDown} />
            <KpiCard label="CAPEX Budget"   value={fmtNum(totals.capexP)}    sub={`Actual: ${fmtNum(totals.capexA)}`} color="bg-purple-50 text-purple-600" icon={PieChart} />
            <KpiCard label="OPEX Budget"    value={fmtNum(totals.opexP)}     sub={`Actual: ${fmtNum(totals.opexA)}`}  color="bg-amber-50 text-amber-600"   icon={PieChart} />
            <KpiCard
              label={totals.cpi !== null ? `CPI ${totals.cpi.toFixed(2)}` : 'CPI'}
              value={totals.eac !== null ? fmtNum(totals.eac) : '—'}
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
                        <div
                          className={`h-full rounded-full ${color}`}
                          style={{ width: `${Math.min(100, utilPct(planned, actual))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>Actual: {fmtNum(actual)}</span>
                        <span>Plan: {fmtNum(planned)}</span>
                      </div>
                    </div>
                  ))}
                  {totals.etc !== null && (
                    <div className="mt-1 text-[11px] bg-slate-50 rounded-lg px-3 py-2 border">
                      <p className="text-slate-500">ETC (Est. To Complete)</p>
                      <p className="font-bold text-slate-700">{fmtNum(Math.max(0, totals.etc))}</p>
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
                      formatter={(v) => fmtFull(Number(v ?? 0))}
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
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t}
                    <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full font-bold ${
                      tab === t ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {t === 'ALL' ? items.length : items.filter(i => i.type === t).length}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {fmtFull(filtered.reduce((s, i) => s + i.planned_amount, 0))} planned ·{' '}
                {fmtFull(filtered.reduce((s, i) => s + i.actual_amount,  0))} actual
              </p>
            </div>

            {/* Column headers */}
            <div className="grid gap-0 text-[10px] font-bold text-slate-400 uppercase tracking-wide px-4 py-2 border-b bg-slate-50/40"
              style={{ gridTemplateColumns: '90px 1fr 120px 120px 80px 80px 120px 72px' }}>
              <span>Type</span>
              <span>Name</span>
              <span className="text-right">Planned</span>
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
                      {fmtNum(gActual)} / {fmtNum(gPlanned)}
                    </span>
                    <span className={`text-[10px] font-bold shrink-0 ml-2 ${utilPct(gPlanned, gActual) > 100 ? 'text-red-600' : 'text-slate-500'}`}>
                      {utilPct(gPlanned, gActual)}%
                    </span>
                  </button>

                  {/* Items */}
                  {isOpen && gItems.map(item => {
                    const vari  = variance(item.planned_amount, item.actual_amount);
                    const util  = utilPct(item.planned_amount, item.actual_amount);
                    const over  = util > 100;
                    return (
                      <div
                        key={item.id}
                        className="grid items-center gap-0 px-4 py-2.5 border-t hover:bg-slate-50/60 transition-colors text-sm"
                        style={{ gridTemplateColumns: '90px 1fr 120px 120px 80px 80px 120px 72px' }}
                      >
                        <Badge className={`text-[10px] font-bold w-fit ${type === 'CAPEX' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                          {item.type}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-700 truncate pr-2">{item.name}</span>
                        <span className="text-xs text-right text-slate-600 font-medium">{fmtFull(item.planned_amount)}</span>
                        <span className={`text-xs text-right font-semibold ${over ? 'text-red-600' : 'text-slate-700'}`}>
                          {fmtFull(item.actual_amount)}
                        </span>
                        <span className="text-xs text-right text-slate-400">{item.unit}</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-[11px] font-bold ${over ? 'text-red-600' : util >= 80 ? 'text-amber-600' : 'text-slate-600'}`}>
                            {util}%
                          </span>
                          <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${over ? 'bg-red-500' : util >= 80 ? 'bg-amber-400' : 'bg-blue-400'}`}
                              style={{ width: `${Math.min(100, util)}%` }} />
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 truncate px-2">{item.notes || '—'}</span>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm(item)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Grand total footer */}
            {filtered.length > 0 && (
              <div className="grid items-center gap-0 px-4 py-3 bg-slate-50 border-t text-xs font-bold text-slate-700"
                style={{ gridTemplateColumns: '90px 1fr 120px 120px 80px 80px 120px 72px' }}>
                <span />
                <span className="text-slate-500 font-semibold">TOTAL</span>
                <span className="text-right">{fmtFull(filtered.reduce((s, i) => s + i.planned_amount, 0))}</span>
                <span className={`text-right ${isOverBudget ? 'text-red-600' : ''}`}>
                  {fmtFull(filtered.reduce((s, i) => s + i.actual_amount, 0))}
                </span>
                <span />
                <span className={`text-right ${totals.util > 100 ? 'text-red-600' : ''}`}>{totals.util}%</span>
                <span />
                <span />
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
                  { label: 'Planned Value (PV)',    value: fmtFull(totals.planned),              sub: '100% budget',                   color: 'text-blue-600'  },
                  { label: 'Earned Value (EV)',      value: fmtFull(totals.ev),                   sub: `${completionPct}% × budget`,    color: 'text-green-600' },
                  { label: 'Actual Cost (AC)',        value: fmtFull(totals.actual),               sub: 'spent so far',                  color: 'text-slate-700' },
                  { label: 'Cost Perf. Index (CPI)', value: totals.cpi !== null ? totals.cpi.toFixed(2) : '—', sub: totals.cpi !== null ? (totals.cpi >= 1 ? 'Under budget ✓' : 'Over budget ⚠') : 'No spend yet', color: totals.cpi !== null && totals.cpi < 1 ? 'text-red-600' : 'text-green-600' },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</p>
                    <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
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
                      <p className={`text-lg font-bold ${totals.eac > totals.planned ? 'text-red-600' : 'text-green-600'}`}>{fmtFull(totals.eac)}</p>
                      <p className="text-[10px] text-slate-500">
                        {totals.eac > totals.planned
                          ? `+${fmtFull(totals.eac - totals.planned)} over planned`
                          : `${fmtFull(totals.planned - totals.eac)} under planned`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg p-3 border bg-slate-50 flex items-center gap-3">
                    <TrendingDown className="h-4 w-4 shrink-0 text-blue-500" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">Estimate to Complete (ETC)</p>
                      <p className="text-lg font-bold text-blue-600">{fmtFull(Math.max(0, totals.etc ?? 0))}</p>
                      <p className="text-[10px] text-slate-500">remaining spend forecast</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>

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
                  >
                    {t}
                  </button>
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
            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Planned Amount</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  value={form.planned_amount}
                  onChange={e => setForm(f => ({ ...f, planned_amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Actual Amount</Label>
                <Input
                  className="mt-1.5"
                  type="number"
                  min="0"
                  value={form.actual_amount}
                  onChange={e => setForm(f => ({ ...f, actual_amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            {/* Unit */}
            <div>
              <Label className="text-xs">Unit (currency / measure)</Label>
              <Input
                className="mt-1.5"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="USD / VND / person-day"
                list="unit-suggestions"
              />
              <datalist id="unit-suggestions">
                {['USD', 'VND', 'EUR', 'person-day'].map(u => <option key={u} value={u} />)}
                {unitSuggestions.filter(u => !['USD','VND','EUR','person-day'].includes(u)).map(u => <option key={u} value={u} />)}
              </datalist>
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

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete budget item?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            <strong>{deleteConfirm?.name}</strong> will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
