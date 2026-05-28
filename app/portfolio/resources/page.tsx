'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Search, Users, Building2, Download, Target, ChevronDown, Briefcase, Shield } from 'lucide-react';
import PortfolioImportDialog from '@/components/resources/PortfolioImportDialog';

type PortfolioMember = {
  id: number;
  role: string;
  name: string;
  email: string;
  note: string;
  member_type: string;
  member_category: string; // 'delivery' | 'overhead'
  program_count: number;
  overhead_remaining: number; // fraction 0-1: overhead time NOT in any project
  current_month_fte: number; // sum of project capacity for current month
};

type ProgramAllocation = {
  program_id: number;
  program_name: string;
  allocated_headcount: number;
  actual_fte: number;
};

// ── FTE KPI summary bar ────────────────────────────────────────────────────────
// allProjectFte = sum current_month_fte of ALL internal members (delivery + overhead in project)
// overheadRemainingFte = sum overhead_remaining of overhead members (non-project overhead time)
// total portfolio FTE = allProjectFte + overheadRemainingFte
function FteKpiBar({ quota, allProjectFte, overheadRemainingFte }: {
  quota: number;
  allProjectFte: number;
  overheadRemainingFte: number;
}) {
  const base = quota > 0 ? quota : Math.max(1, allProjectFte + overheadRemainingFte);
  const bench = Math.max(0, base - allProjectFte - overheadRemainingFte);
  const pctProject = base > 0 ? (allProjectFte / base) * 100 : 0;
  const pctOverhead = base > 0 ? (overheadRemainingFte / base) * 100 : 0;
  const pctBench = base > 0 ? (bench / base) * 100 : 0;

  const fmtFte = (v: number) => parseFloat(v.toFixed(3)).toString();

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] text-blue-500 font-semibold uppercase tracking-wide">
          <Briefcase className="h-3 w-3" /> FTE phân bổ dự án
        </div>
        <div className="text-2xl font-bold text-blue-700">{fmtFte(allProjectFte)}</div>
        <div className="text-xs text-blue-500">{pctProject.toFixed(0)}% của {quota > 0 ? quota : 'tổng'} FTE</div>
        <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pctProject, 100)}%` }} />
        </div>
        <div className="text-[10px] text-blue-400 mt-0.5">Delivery + Overhead trong dự án</div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] text-amber-500 font-semibold uppercase tracking-wide">
          <Shield className="h-3 w-3" /> FTE Overhead còn lại
        </div>
        <div className="text-2xl font-bold text-amber-700">{fmtFte(overheadRemainingFte)}</div>
        <div className="text-xs text-amber-500">{pctOverhead.toFixed(0)}% của {quota > 0 ? quota : 'tổng'} FTE</div>
        <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(pctOverhead, 100)}%` }} />
        </div>
        <div className="text-[10px] text-amber-400 mt-0.5">Quản lý / lãnh đạo — không trong dự án</div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
          <Users className="h-3 w-3" /> % Bench
        </div>
        <div className={`text-2xl font-bold ${bench > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
          {pctBench.toFixed(0)}%
        </div>
        <div className="text-xs text-slate-500">{fmtFte(bench)} / {quota > 0 ? quota : '?'} FTE</div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pctBench, 100)}%` }} />
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">Chưa phân bổ (quota − dự án − overhead)</div>
      </div>
    </div>
  );
}

// ── Internal member table (Delivery or Overhead sub-tab) ──────────────────────
type InternalMemberTableProps = {
  members: PortfolioMember[];
  loading: boolean;
  search: string;
  subCategory: 'delivery' | 'overhead';
  onUpdateField: (id: number, field: keyof PortfolioMember, value: string) => void;
  onSaveRow: (row: PortfolioMember) => void;
  onDeleteRow: (id: number) => void;
  onAddClick: () => void;
  onImportClick: () => void;
};

function InternalMemberTable({
  members, loading, search, subCategory,
  onUpdateField, onSaveRow, onDeleteRow, onAddClick, onImportClick,
}: InternalMemberTableProps) {
  const allInternal = members.filter(m => m.member_type === 'internal');
  const filtered = allInternal.filter(m => {
    const isMatch = subCategory === 'delivery'
      ? (m.member_category !== 'overhead')
      : (m.member_category === 'overhead');
    if (!isMatch) return false;
    const q = search.toLowerCase();
    return !q
      || m.name.toLowerCase().includes(q)
      || m.role.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.note.toLowerCase().includes(q);
  });
  const totalInCategory = allInternal.filter(m =>
    subCategory === 'delivery' ? m.member_category !== 'overhead' : m.member_category === 'overhead'
  ).length;

  const isDelivery = subCategory === 'delivery';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="text-xs text-slate-400">
          {filtered.length} / {totalInCategory} thành viên
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onImportClick} className="gap-2 h-8 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button onClick={onAddClick} className="bg-blue-600 hover:bg-blue-700 gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Member
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1e293b] text-white">
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left w-36">Role</th>
                <th className="px-3 py-3 text-left w-44">Name</th>
                <th className="px-3 py-3 text-left w-52">Email</th>
                <th className="px-3 py-3 text-left">Note</th>
                <th className="px-3 py-3 text-center w-24">Phân loại</th>
                {isDelivery && <th className="px-3 py-3 text-center w-24">Programs</th>}
                {!isDelivery && <th className="px-3 py-3 text-center w-28">Còn lại (FTE)</th>}
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    {totalInCategory === 0
                      ? 'Chưa có thành viên. Nhấn "Add Member" hoặc "Import" để bắt đầu.'
                      : 'Không tìm thấy thành viên phù hợp.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.role}
                        placeholder="Role"
                        onChange={e => onUpdateField(row.id, 'role', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs font-medium"
                        value={row.name}
                        placeholder="Name"
                        onChange={e => onUpdateField(row.id, 'name', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.email}
                        placeholder="email@company.com"
                        type="email"
                        onChange={e => onUpdateField(row.id, 'email', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.note}
                        placeholder="Note"
                        onChange={e => onUpdateField(row.id, 'note', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select
                        className="h-6 px-1.5 text-[11px] border rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={row.member_category || 'delivery'}
                        onChange={e => {
                          onUpdateField(row.id, 'member_category', e.target.value);
                          onSaveRow({ ...row, member_category: e.target.value });
                        }}
                      >
                        <option value="delivery">Delivery</option>
                        <option value="overhead">Overhead</option>
                      </select>
                    </td>
                    {isDelivery && (
                      <td className="px-3 py-2 text-center">
                        {Number(row.program_count) > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                            <Target className="h-2.5 w-2.5" />
                            {row.program_count}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}
                    {!isDelivery && (
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            className="w-14 h-6 px-1 text-xs border rounded text-center focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                            value={Number(row.overhead_remaining) || 0}
                            title="FTE không phân bổ vào dự án (0–1, e.g. 0.7 = 70%)"
                            onChange={e => {
                              const val = Math.min(1, Math.max(0, Number(e.target.value) || 0));
                              onUpdateField(row.id, 'overhead_remaining' as keyof PortfolioMember, String(val));
                            }}
                            onBlur={() => onSaveRow({ ...row, overhead_remaining: Number(row.overhead_remaining) || 0 })}
                          />
                          <span className="text-[10px] text-slate-400">FTE</span>
                        </div>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── External member table (unchanged) ─────────────────────────────────────────
type ExternalMemberTableProps = {
  members: PortfolioMember[];
  loading: boolean;
  search: string;
  onUpdateField: (id: number, field: keyof PortfolioMember, value: string) => void;
  onSaveRow: (row: PortfolioMember) => void;
  onDeleteRow: (id: number) => void;
  onAddClick: () => void;
  onImportClick: () => void;
};

function ExternalMemberTable({
  members, loading, search,
  onUpdateField, onSaveRow, onDeleteRow, onAddClick, onImportClick,
}: ExternalMemberTableProps) {
  const filtered = members.filter(m => {
    if (m.member_type !== 'external') return false;
    const q = search.toLowerCase();
    return !q
      || m.name.toLowerCase().includes(q)
      || m.role.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.note.toLowerCase().includes(q);
  });
  const total = members.filter(m => m.member_type === 'external').length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="text-xs text-slate-400">
          {filtered.length} / {total} thành viên
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onImportClick} className="gap-2 h-8 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button onClick={onAddClick} className="bg-blue-600 hover:bg-blue-700 gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Member
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1e293b] text-white">
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left w-36">Role</th>
                <th className="px-3 py-3 text-left w-44">Name</th>
                <th className="px-3 py-3 text-left w-52">Email</th>
                <th className="px-3 py-3 text-left">Note</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    {total === 0
                      ? 'No members yet. Click "Add Member" or "Import" to get started.'
                      : 'No members match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Input className="h-6 text-xs" value={row.role} placeholder="Role"
                        onChange={e => onUpdateField(row.id, 'role', e.target.value)}
                        onBlur={() => onSaveRow(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-6 text-xs font-medium" value={row.name} placeholder="Name"
                        onChange={e => onUpdateField(row.id, 'name', e.target.value)}
                        onBlur={() => onSaveRow(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-6 text-xs" value={row.email} placeholder="email@company.com" type="email"
                        onChange={e => onUpdateField(row.id, 'email', e.target.value)}
                        onBlur={() => onSaveRow(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <Input className="h-6 text-xs" value={row.note} placeholder="Note"
                        onChange={e => onUpdateField(row.id, 'note', e.target.value)}
                        onBlur={() => onSaveRow(row)} />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => onDeleteRow(row.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Program allocation tab ─────────────────────────────────────────────────────
function ProgramAllocationsTab({
  quota,
  allocations,
  loading,
  onSave,
}: {
  quota: number;
  allocations: ProgramAllocation[];
  loading: boolean;
  onSave: (programId: number, headcount: number) => void;
}) {
  const [localValues, setLocalValues] = useState<Record<number, string>>({});

  const totalAllocated = allocations.reduce((s, a) => s + (Number(a.allocated_headcount) || 0), 0);
  const totalActual = allocations.reduce((s, a) => s + (Number(a.actual_fte) || 0), 0);

  return (
    <div>
      {/* Quota summary */}
      <div className="flex items-center gap-4 flex-wrap bg-slate-50 border rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="text-xs text-slate-500 font-medium">Định biên khối:</span>
          <span className="text-xs font-bold text-slate-800">{quota}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="text-xs">
          <span className="text-slate-400">Tổng FTE phân bổ: </span>
          <span className="font-bold text-slate-700">{totalAllocated}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="text-xs">
          <span className="text-slate-400">Còn lại: </span>
          <span className={`font-bold ${totalAllocated > quota && quota > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {quota > 0 ? quota - totalAllocated : '—'}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#1e293b] text-white">
              <th className="px-3 py-3 text-left">#</th>
              <th className="px-3 py-3 text-left">Program</th>
              <th className="px-3 py-3 text-center w-40">Số FTE phân bổ</th>
              <th className="px-3 py-3 text-center w-40">Số FTE thực tế</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-10 text-slate-400">Loading...</td></tr>
            ) : allocations.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400">
                  Chưa có program nào. Tạo program trong mục Programs để bắt đầu.
                </td>
              </tr>
            ) : (
              allocations.map((row, i) => {
                const localVal = localValues[row.program_id] ?? String(row.allocated_headcount);
                const actualFte = Number(row.actual_fte) || 0;
                const allocated = Number(row.allocated_headcount) || 0;
                const overActual = actualFte > allocated && allocated > 0;
                return (
                  <tr key={row.program_id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{row.program_name}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        className="w-20 h-6 px-1.5 text-xs font-bold text-slate-800 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center bg-white"
                        value={localVal}
                        onChange={e => setLocalValues(v => ({ ...v, [row.program_id]: e.target.value }))}
                        onBlur={() => onSave(row.program_id, Math.max(0, Number(localVal) || 0))}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`font-bold tabular-nums ${overActual ? 'text-red-600' : actualFte > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {actualFte > 0 ? actualFte : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {allocations.length > 0 && (
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-slate-600">Tổng</td>
                <td className="px-3 py-2 text-center text-xs font-bold text-slate-800">{totalAllocated}</td>
                <td className="px-3 py-2 text-center text-xs font-bold text-emerald-700">
                  {totalActual > 0 ? totalActual : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default function PortfolioResourcesPage() {
  const [members, setMembers] = useState<PortfolioMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMemberType, setAddMemberType] = useState<'internal' | 'external'>('internal');
  const [addForm, setAddForm] = useState({ role: '', name: '', email: '', note: '', member_category: 'delivery' });
  const [addSaving, setAddSaving] = useState(false);
  const [quota, setQuota] = useState(0);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [innerTab, setInnerTab] = useState<'delivery' | 'overhead'>('delivery');

  // Program allocations
  const [programAllocations, setProgramAllocations] = useState<ProgramAllocation[]>([]);
  const [allocLoading, setAllocLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, quotaRes] = await Promise.all([
        fetch('/api/portfolio/members').then(r => r.json()),
        fetch('/api/portfolio/quota').then(r => r.json()),
      ]);
      setMembers(Array.isArray(membersRes) ? membersRes : []);
      setQuota(quotaRes.headcount_quota ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const allocRes = await fetch('/api/portfolio/program-allocations').then(r => r.json());
      setProgramAllocations(Array.isArray(allocRes) ? allocRes : []);
    } finally {
      setAllocLoading(false);
    }
  }, []);

  useEffect(() => { load(); loadAllocations(); }, [load, loadAllocations]);

  const updateField = (id: number, field: keyof PortfolioMember, value: string) => {
    setMembers(ms => ms.map(m => {
      if (m.id !== id) return m;
      if (field === 'overhead_remaining') return { ...m, overhead_remaining: Number(value) || 0 };
      return { ...m, [field]: value };
    }));
  };

  const saveRow = async (row: PortfolioMember) => {
    await fetch(`/api/portfolio/members/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
  };

  const deleteRow = async (id: number) => {
    await fetch(`/api/portfolio/members/${id}`, { method: 'DELETE' });
    setMembers(ms => ms.filter(m => m.id !== id));
    toast.success('Member removed');
  };

  const openAdd = (type: 'internal' | 'external') => {
    setAddMemberType(type);
    setAddForm({ role: '', name: '', email: '', note: '', member_category: 'delivery' });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { toast.error('Name is required'); return; }
    setAddSaving(true);
    try {
      const res = await fetch('/api/portfolio/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, member_type: addMemberType }),
      });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Member added');
      setAddOpen(false);
      load();
    } finally {
      setAddSaving(false);
    }
  };

  const saveQuota = async (value: number) => {
    if (quotaSaving) return;
    setQuotaSaving(true);
    try {
      await fetch('/api/portfolio/quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headcount_quota: value }),
      });
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleQuotaChange = (value: number) => {
    setQuota(value);
    saveQuota(value);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/portfolio/members');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ResourceManagement.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported successfully!');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleSaveProgramAlloc = async (programId: number, headcount: number) => {
    const res = await fetch('/api/portfolio/program-allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ program_id: programId, allocated_headcount: headcount }),
    });
    if (!res.ok) { toast.error('Lưu thất bại'); return; }
    toast.success('Đã cập nhật phân bổ');
    loadAllocations();
  };

  const internalMembers = members.filter(m => m.member_type === 'internal');
  const externalCount = members.filter(m => m.member_type === 'external').length;
  const internalCount = internalMembers.length;
  const deliveryCount = internalMembers.filter(m => m.member_category !== 'overhead').length;
  const overheadCount = internalMembers.filter(m => m.member_category === 'overhead').length;
  // Actual FTE: project allocations this month (all members) + overhead remaining (not in project)
  const allProjectFte = internalMembers.reduce((s, m) => s + (Number(m.current_month_fte) || 0), 0);
  const overheadRemainingFte = internalMembers
    .filter(m => m.member_category === 'overhead')
    .reduce((s, m) => s + (Number(m.overhead_remaining) || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Resource Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Quản lý nhân sự portfolio — phân bổ từ portfolio xuống program, từ program xuống project
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || members.length === 0}
            className="gap-2 h-9 text-sm text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export .xlsx'}
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="internal">
          <TabsList className="mb-4">
            <TabsTrigger value="internal" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Nhân sự trong khối
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{internalCount}</span>
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Nhân sự ngoài khối
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{externalCount}</span>
            </TabsTrigger>
            <TabsTrigger value="programs" className="gap-2">
              <Target className="h-3.5 w-3.5" />
              Phân bổ Program
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">{programAllocations.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── Internal tab ── */}
          <TabsContent value="internal">
            {/* Định biên quota editable */}
            <div className="flex items-center gap-3 mb-4 bg-slate-50 border rounded-xl px-4 py-2.5">
              <Target className="h-4 w-4 text-blue-500 shrink-0" />
              <span className="text-xs text-slate-500 font-medium">Định biên khối:</span>
              <input
                type="number"
                min={0}
                className="w-16 h-6 px-1.5 text-xs font-bold text-slate-800 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center bg-white"
                value={quota || ''}
                placeholder="0"
                onChange={e => handleQuotaChange(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {/* FTE KPI bar */}
            <FteKpiBar
              quota={quota > 0 ? quota : internalCount}
              allProjectFte={allProjectFte}
              overheadRemainingFte={overheadRemainingFte}
            />

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search name, role, email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Delivery / Overhead sub-tabs */}
            <div className="flex gap-1 mb-4 border-b">
              <button
                onClick={() => setInnerTab('delivery')}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  innerTab === 'delivery'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Briefcase className="h-3 w-3" />
                Delivery
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  innerTab === 'delivery' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>{deliveryCount}</span>
              </button>
              <button
                onClick={() => setInnerTab('overhead')}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
                  innerTab === 'overhead'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Shield className="h-3 w-3" />
                Overhead
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  innerTab === 'overhead' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                }`}>{overheadCount}</span>
              </button>
            </div>

            <InternalMemberTable
              members={members}
              loading={loading}
              search={search}
              subCategory={innerTab}
              onUpdateField={updateField}
              onSaveRow={saveRow}
              onDeleteRow={deleteRow}
              onAddClick={() => openAdd('internal')}
              onImportClick={() => setImportOpen(true)}
            />
          </TabsContent>

          {/* ── External tab ── */}
          <TabsContent value="external">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8 h-8 text-sm"
                  placeholder="Search name, role, email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">Nhân sự mượn ngoài khối — nguồn lực hỗ trợ từ bên ngoài tổ chức.</p>
            <ExternalMemberTable
              members={members}
              loading={loading}
              search={search}
              onUpdateField={updateField}
              onSaveRow={saveRow}
              onDeleteRow={deleteRow}
              onAddClick={() => openAdd('external')}
              onImportClick={() => setImportOpen(true)}
            />
          </TabsContent>

          {/* ── Programs tab ── */}
          <TabsContent value="programs">
            <p className="text-xs text-slate-400 mb-4">
              Phân bổ định biên từ portfolio xuống từng program. Trong mỗi program, PM có thể tiếp tục phân bổ xuống project.
            </p>
            <ProgramAllocationsTab
              quota={quota}
              allocations={programAllocations}
              loading={allocLoading}
              onSave={handleSaveProgramAlloc}
            />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-slate-400 mt-4">
          Nhân sự trong danh sách này có thể được chọn trực tiếp trong Resource Plan của từng project — gõ tên hoặc email để tìm kiếm.
        </p>
      </main>

      {/* Import Dialog */}
      <PortfolioImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {addMemberType === 'external' ? 'External' : 'Internal'} Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1.5"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <Label>Role</Label>
              <Input
                className="mt-1.5"
                value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Frontend Developer"
              />
            </div>
            {addMemberType === 'internal' && (
              <div>
                <Label>Phân loại</Label>
                <div className="relative mt-1.5">
                  <select
                    className="w-full h-9 px-3 pr-8 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    value={addForm.member_category}
                    onChange={e => setAddForm(f => ({ ...f, member_category: e.target.value }))}
                  >
                    <option value="delivery">Delivery</option>
                    <option value="overhead">Overhead</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input
                className="mt-1.5"
                value={addForm.note}
                onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Optional note"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving || !addForm.name.trim()} className="bg-blue-600 hover:bg-blue-700">
              {addSaving ? 'Saving…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
