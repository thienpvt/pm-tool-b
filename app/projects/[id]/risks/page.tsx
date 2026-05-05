'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Link2, ShieldAlert, Bug, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Activity = { id: number; phase: string; activity: string; };

type Risk = {
  id: number; risk_id: string; description: string; category: string;
  owner: string; trigger: string; mitigation: string; due_date: string;
  status: string; priority: string; impact: string;
  affected_activity_id: number | null;
};

type Issue = {
  id: number; issue_id: string; description: string; root_cause: string;
  category: string; owner: string; trigger: string; mitigation: string;
  due_date: string; status: string; priority: string; impact: string;
  affected_activity_id: number | null;
};

type ItemType = 'risk' | 'issue';

type EditingItem = {
  _type: ItemType;
  id?: number;
  // shared
  description: string; category: string; owner: string;
  trigger: string; mitigation: string; due_date: string;
  status: string; priority: string; impact: string;
  affected_activity_id: number | null;
  // risk-specific
  risk_id?: string;
  // issue-specific
  issue_id?: string;
  root_cause?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITIES    = ['Critical', 'High', 'Medium', 'Low'] as const;
const IMPACTS       = ['Blocker', 'Critical', 'Major', 'Minor', 'Informational'] as const;
const RISK_STATUSES  = ['Open', 'In Progress', 'Mitigated', 'Closed'];
const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const CATEGORIES    = ['Technical', 'Resource', 'Schedule', 'Scope', 'Financial', 'External', 'Other'];

const PRIORITY_STYLE: Record<string, { badge: string; dot: string; label: string }> = {
  Critical: { badge: 'bg-red-100 text-red-700 border border-red-200',          dot: 'bg-red-600',    label: '🔴 Critical' },
  High:     { badge: 'bg-orange-100 text-orange-700 border border-orange-200', dot: 'bg-orange-500', label: '🟠 High' },
  Medium:   { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200', dot: 'bg-yellow-400', label: '🟡 Medium' },
  Low:      { badge: 'bg-slate-100 text-slate-500 border border-slate-200',    dot: 'bg-slate-400',  label: '⚪ Low' },
};
const IMPACT_STYLE: Record<string, { badge: string; label: string; desc: string }> = {
  Blocker:       { badge: 'bg-red-600 text-white',                                      label: '🚫 Blocker',  desc: 'Blocks all progress, must fix immediately' },
  Critical:      { badge: 'bg-red-100 text-red-700 border border-red-200',              label: '⚡ Critical', desc: 'Severe impact on scope / schedule / quality' },
  Major:         { badge: 'bg-orange-100 text-orange-700 border border-orange-200',     label: '⚠ Major',    desc: 'Significant impact on deliverables' },
  Minor:         { badge: 'bg-yellow-100 text-yellow-700 border border-yellow-200',     label: '↘ Minor',    desc: 'Limited impact, workaround available' },
  Informational: { badge: 'bg-blue-100 text-blue-700 border border-blue-200',           label: 'ℹ Info',     desc: 'For awareness only, no action needed now' },
};
const STATUS_STYLE: Record<string, string> = {
  'Open':        'bg-red-100 text-red-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Mitigated':   'bg-blue-100 text-blue-700',
  'Resolved':    'bg-blue-100 text-blue-700',
  'Closed':      'bg-green-100 text-green-700',
};

function pStyle(p: string) { return PRIORITY_STYLE[p] ?? PRIORITY_STYLE.Medium; }
function iStyle(i: string) { return IMPACT_STYLE[i] ?? IMPACT_STYLE.Major; }

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

// ─── Unified Item Dialog ──────────────────────────────────────────────────────
function ItemDialog({
  editing, setEditing, activities, projectId,
  onSaved,
}: {
  editing: EditingItem | null;
  setEditing: (v: EditingItem | null) => void;
  activities: Activity[];
  projectId: string;
  onSaved: (item: Risk | Issue, type: ItemType, isNew: boolean) => void;
}) {
  const isRisk = editing?._type === 'risk';
  const statuses = isRisk ? RISK_STATUSES : ISSUE_STATUSES;

  const switchType = (t: ItemType) => {
    if (!editing || editing.id) return; // lock type when editing existing
    setEditing({
      ...editing,
      _type: t,
      status: 'Open',
      risk_id: '',
      issue_id: '',
      root_cause: '',
    });
  };

  const save = async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const endpoint = `/api/projects/${projectId}/${isRisk ? 'risks' : 'issues'}`;
    const res = await fetch(endpoint, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const saved = await res.json();
    onSaved(saved, editing._type, isNew);
    setEditing(null);
    toast.success(isNew
      ? `${isRisk ? 'Risk' : 'Issue'} created`
      : `${isRisk ? 'Risk' : 'Issue'} updated`);
  };

  return (
    <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
      <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRisk
              ? <ShieldAlert className="h-4 w-4 text-red-500" />
              : <Bug className="h-4 w-4 text-violet-500" />}
            {editing?.id
              ? `Edit ${isRisk ? 'Risk' : 'Issue'}`
              : `Add New ${isRisk ? 'Risk' : 'Issue'}`}
          </DialogTitle>
        </DialogHeader>

        {editing && (
          <div className="space-y-5 py-1">

            {/* ── Type Selector ── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-600">Type</Label>
              <div className={`flex rounded-xl border overflow-hidden ${editing.id ? 'opacity-60 pointer-events-none' : ''}`}>
                <button
                  type="button"
                  onClick={() => switchType('risk')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors
                    ${isRisk
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  <ShieldAlert className="h-4 w-4" />
                  Risk
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isRisk ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    Chưa xảy ra
                  </span>
                </button>
                <div className="w-px bg-slate-200" />
                <button
                  type="button"
                  onClick={() => switchType('issue')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors
                    ${!isRisk
                      ? 'bg-violet-600 text-white'
                      : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  <Bug className="h-4 w-4" />
                  Issue
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${!isRisk ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    Đã xảy ra
                  </span>
                </button>
              </div>
              {editing.id && (
                <p className="text-[11px] text-slate-400">Không thể đổi type khi đang chỉnh sửa.</p>
              )}
            </div>

            {/* ── Row 1: ID + Category + Status ── */}
            <div className="grid grid-cols-3 gap-4">
              <FieldRow label={isRisk ? 'Risk ID' : 'Issue ID'}>
                <Input
                  className="h-9 text-sm"
                  value={(isRisk ? editing.risk_id : editing.issue_id) ?? ''}
                  onChange={e => setEditing(isRisk
                    ? { ...editing, risk_id: e.target.value }
                    : { ...editing, issue_id: e.target.value })}
                  placeholder="Auto if blank"
                />
              </FieldRow>
              <FieldRow label="Category">
                <Select value={editing.category ?? ''} onValueChange={v => setEditing({ ...editing, category: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Status">
                <Select value={editing.status ?? 'Open'} onValueChange={v => setEditing({ ...editing, status: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </FieldRow>
            </div>

            {/* ── Row 2: Priority + Impact ── */}
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Priority">
                <Select value={editing.priority ?? 'Medium'} onValueChange={v => setEditing({ ...editing, priority: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${pStyle(p).dot}`} />
                          <span className="font-medium">{p}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Impact / Severity">
                <Select value={editing.impact ?? 'Major'} onValueChange={v => setEditing({ ...editing, impact: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPACTS.map(i => (
                      <SelectItem key={i} value={i}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-px rounded ${iStyle(i).badge}`}>{i}</span>
                          <span className="text-xs text-slate-400">{iStyle(i).desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>

            {/* ── Description (full width) ── */}
            <FieldRow label="Description *">
              <Textarea
                className="text-sm min-h-[80px]"
                value={editing.description ?? ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder={isRisk ? 'Mô tả chi tiết rủi ro...' : 'Mô tả chi tiết issue...'}
              />
            </FieldRow>

            {/* ── Issue only: Root Cause ── */}
            {!isRisk && (
              <FieldRow label="Root Cause (nguyên nhân gốc rễ)">
                <Textarea
                  className="text-sm min-h-[70px]"
                  value={editing.root_cause ?? ''}
                  onChange={e => setEditing({ ...editing, root_cause: e.target.value })}
                  placeholder="Nguyên nhân dẫn đến issue này..."
                />
              </FieldRow>
            )}

            {/* ── Owner + Due Date ── */}
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Owner">
                <Input
                  className="h-9 text-sm"
                  value={editing.owner ?? ''}
                  onChange={e => setEditing({ ...editing, owner: e.target.value })}
                  placeholder="Người phụ trách"
                />
              </FieldRow>
              <FieldRow label="Due Date">
                <Input
                  className="h-9 text-sm" type="date"
                  value={editing.due_date ?? ''}
                  onChange={e => setEditing({ ...editing, due_date: e.target.value })}
                />
              </FieldRow>
            </div>

            {/* ── Trigger + Mitigation / Resolution ── */}
            <div className="grid grid-cols-2 gap-4">
              <FieldRow label="Trigger (điều kiện kích hoạt)">
                <Textarea
                  className="text-sm min-h-[80px]"
                  value={editing.trigger ?? ''}
                  onChange={e => setEditing({ ...editing, trigger: e.target.value })}
                  placeholder="Khi nào / điều kiện gì kích hoạt?"
                />
              </FieldRow>
              <FieldRow label={isRisk ? 'Mitigation Plan' : 'Resolution Plan'}>
                <Textarea
                  className="text-sm min-h-[80px]"
                  value={editing.mitigation ?? ''}
                  onChange={e => setEditing({ ...editing, mitigation: e.target.value })}
                  placeholder={isRisk ? 'Kế hoạch giảm thiểu rủi ro...' : 'Kế hoạch xử lý issue...'}
                />
              </FieldRow>
            </div>

            {/* ── Affected Activity ── */}
            <FieldRow label="🔗 Affected Activity (từ Project Timeline)">
              <Select
                value={editing.affected_activity_id ? String(editing.affected_activity_id) : 'none'}
                onValueChange={v => setEditing({ ...editing, affected_activity_id: v === 'none' ? null : Number(v) })}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Chọn activity bị ảnh hưởng..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none"><span className="text-slate-400 italic">— Không link activity —</span></SelectItem>
                  {activities.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      <span className="text-slate-400 text-xs mr-1">[{a.phase}]</span>{a.activity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
          <Button
            className={isRisk ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}
            onClick={save}
            disabled={!editing?.description?.trim()}
          >
            {editing?.id
              ? `Cập nhật ${isRisk ? 'Risk' : 'Issue'}`
              : `Tạo ${isRisk ? 'Risk' : 'Issue'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Risk Table ───────────────────────────────────────────────────────────────
function RiskTable({
  projectId, activities, editing, setEditing, onSaved,
}: {
  projectId: string; activities: Activity[];
  editing: EditingItem | null;
  setEditing: (v: EditingItem | null) => void;
  onSaved: (item: Risk | Issue, type: ItemType, isNew: boolean) => void;
}) {
  const [rows, setRows]           = useState<Risk[]>([]);
  const [filterStatus, setFilterStatus]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/risks`).then(r => r.json()).then(setRows);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  // refresh when something saved
  useEffect(() => { load(); }, [editing, load]);

  const openNew = () => setEditing({
    _type: 'risk', risk_id: '', description: '', category: '', owner: '',
    trigger: '', mitigation: '', due_date: '', status: 'Open',
    priority: 'High', impact: 'Major', affected_activity_id: null,
  });

  const openEdit = (row: Risk) => setEditing({ _type: 'risk', ...row });

  const del = async (id: number) => {
    await fetch(`/api/projects/${projectId}/risks?rowId=${id}`, { method: 'DELETE' });
    setRows(r => r.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const toggle = (id: number) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const actMap = Object.fromEntries(activities.map(a => [a.id, a]));
  const filtered = rows.filter(r =>
    (filterStatus === 'All' || r.status === filterStatus) &&
    (filterPriority === 'All' || r.priority === filterPriority)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['Open','In Progress','Mitigated','Closed'].map(s => (
            <Badge key={s} className={`${STATUS_STYLE[s]} cursor-pointer ${filterStatus === s ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
              onClick={() => setFilterStatus(filterStatus === s ? 'All' : s)}>
              {s}: {rows.filter(r => r.status === s).length}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterPriority} onValueChange={v => setFilterPriority(v ?? 'All')}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Priorities</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="bg-red-600 hover:bg-red-700 gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Risk
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-white py-16 text-center text-slate-400">
          <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No risks logged yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map(row => {
          const act = row.affected_activity_id ? actMap[row.affected_activity_id] : null;
          const isExpanded = expanded.has(row.id);
          const ps = pStyle(row.priority);
          const is = iStyle(row.impact);
          return (
            <div key={row.id} className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className={`h-1 rounded-t-xl ${ps.dot}`} />
              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-slate-100 text-slate-600 font-mono">{row.risk_id || '—'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.badge}`}>{ps.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${is.badge}`}>{is.label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status] ?? ''}`}>{row.status}</span>
                      {row.category && <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{row.category}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug mb-2">{row.description || <span className="italic text-slate-400">No description</span>}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {row.owner && <span>👤 {row.owner}</span>}
                      {row.due_date && <span>📅 {row.due_date}</span>}
                      {act && (
                        <Link href={`/projects/${projectId}/timeline`} className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Link2 className="h-3 w-3" /><span className="truncate max-w-[200px]">{act.phase} › {act.activity}</span>
                        </Link>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-2 text-xs border-t border-slate-100 pt-3">
                        {row.trigger && <div><span className="font-semibold text-slate-600">🎯 Trigger: </span><span className="text-slate-700">{row.trigger}</span></div>}
                        {row.mitigation && <div><span className="font-semibold text-slate-600">🛡 Mitigation: </span><span className="text-slate-700">{row.mitigation}</span></div>}
                        {iStyle(row.impact).desc && <div className="text-slate-400 italic">{iStyle(row.impact).desc}</div>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggle(row.id)} className="p-1.5 text-slate-300 hover:text-slate-600 rounded transition-colors">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(row)} className="p-1.5 text-slate-300 hover:text-blue-500 rounded transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(row.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Issue Table ──────────────────────────────────────────────────────────────
function IssueTable({
  projectId, activities, editing, setEditing, onSaved,
}: {
  projectId: string; activities: Activity[];
  editing: EditingItem | null;
  setEditing: (v: EditingItem | null) => void;
  onSaved: (item: Risk | Issue, type: ItemType, isNew: boolean) => void;
}) {
  const [rows, setRows]           = useState<Issue[]>([]);
  const [filterStatus, setFilterStatus]   = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [expanded, setExpanded]   = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/issues`).then(r => r.json()).then(setRows);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [editing, load]);

  const openNew = () => setEditing({
    _type: 'issue', issue_id: '', description: '', root_cause: '', category: '',
    owner: '', trigger: '', mitigation: '', due_date: '', status: 'Open',
    priority: 'High', impact: 'Major', affected_activity_id: null,
  });

  const openEdit = (row: Issue) => setEditing({ _type: 'issue', ...row });

  const del = async (id: number) => {
    await fetch(`/api/projects/${projectId}/issues?rowId=${id}`, { method: 'DELETE' });
    setRows(r => r.filter(x => x.id !== id));
    toast.success('Deleted');
  };

  const toggle = (id: number) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const actMap = Object.fromEntries(activities.map(a => [a.id, a]));
  const filtered = rows.filter(r =>
    (filterStatus === 'All' || r.status === filterStatus) &&
    (filterPriority === 'All' || r.priority === filterPriority)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {['Open','In Progress','Resolved','Closed'].map(s => (
            <Badge key={s} className={`${STATUS_STYLE[s]} cursor-pointer ${filterStatus === s ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
              onClick={() => setFilterStatus(filterStatus === s ? 'All' : s)}>
              {s}: {rows.filter(r => r.status === s).length}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filterPriority} onValueChange={v => setFilterPriority(v ?? 'All')}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Priorities</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="bg-violet-600 hover:bg-violet-700 gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Issue
          </Button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-white py-16 text-center text-slate-400">
          <Bug className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No issues logged yet.</p>
        </div>
      )}
      <div className="space-y-3">
        {filtered.map(row => {
          const act = row.affected_activity_id ? actMap[row.affected_activity_id] : null;
          const isExpanded = expanded.has(row.id);
          const ps = pStyle(row.priority);
          const is = iStyle(row.impact);
          return (
            <div key={row.id} className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className={`h-1 rounded-t-xl ${ps.dot}`} />
              <div className="px-5 py-4">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block px-2 py-0.5 text-xs font-bold rounded-md bg-violet-50 text-violet-600 font-mono">{row.issue_id || '—'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ps.badge}`}>{ps.label}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${is.badge}`}>{is.label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status] ?? ''}`}>{row.status}</span>
                      {row.category && <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{row.category}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug mb-2">{row.description || <span className="italic text-slate-400">No description</span>}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {row.owner && <span>👤 {row.owner}</span>}
                      {row.due_date && <span>📅 {row.due_date}</span>}
                      {act && (
                        <Link href={`/projects/${projectId}/timeline`} className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Link2 className="h-3 w-3" /><span className="truncate max-w-[200px]">{act.phase} › {act.activity}</span>
                        </Link>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="mt-3 space-y-2 text-xs border-t border-slate-100 pt-3">
                        {row.root_cause && <div><span className="font-semibold text-slate-600">🔍 Root Cause: </span><span className="text-slate-700">{row.root_cause}</span></div>}
                        {row.trigger && <div><span className="font-semibold text-slate-600">🎯 Trigger: </span><span className="text-slate-700">{row.trigger}</span></div>}
                        {row.mitigation && <div><span className="font-semibold text-slate-600">🛡 Resolution: </span><span className="text-slate-700">{row.mitigation}</span></div>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggle(row.id)} className="p-1.5 text-slate-300 hover:text-slate-600 rounded transition-colors">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <button onClick={() => openEdit(row)} className="p-1.5 text-slate-300 hover:text-blue-500 rounded transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(row.id)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RisksPage() {
  const { id } = useParams<{ id: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editing, setEditing]       = useState<EditingItem | null>(null);
  const [activeTab, setActiveTab]   = useState<'risks' | 'issues'>('risks');

  useEffect(() => {
    fetch(`/api/projects/${id}/activities`).then(r => r.json()).then(setActivities);
  }, [id]);

  const handleSaved = (_item: Risk | Issue, _type: ItemType, _isNew: boolean) => {};

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Risks & Issues
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quản lý rủi ro và vấn đề phát sinh, liên kết với các công việc trong Project Timeline.
            </p>
          </div>

          {/* Impact legend */}
          <div className="flex flex-wrap gap-2 mb-5 p-3 bg-white rounded-xl border text-xs">
            <span className="text-slate-500 font-semibold mr-1 self-center">Impact:</span>
            {IMPACTS.map(i => (
              <span key={i} title={iStyle(i).desc} className={`px-2 py-0.5 rounded-full font-semibold cursor-help ${iStyle(i).badge}`}>
                {iStyle(i).label}
              </span>
            ))}
            <span className="text-slate-300 mx-1">|</span>
            <span className="text-slate-500 font-semibold mr-1 self-center">Priority:</span>
            {PRIORITIES.map(p => (
              <span key={p} className={`px-2 py-0.5 rounded-full font-semibold ${pStyle(p).badge}`}>{pStyle(p).label}</span>
            ))}
          </div>

          {/* Custom tab switcher */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setActiveTab('risks')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all shadow-sm ${
                activeTab === 'risks'
                  ? 'bg-red-600 border-red-600 text-white shadow-red-200 shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <ShieldAlert className="h-4 w-4" />
              Risk Register
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all shadow-sm ${
                activeTab === 'issues'
                  ? 'bg-violet-600 border-violet-600 text-white shadow-violet-200 shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              <Bug className="h-4 w-4" />
              Issue Log
            </button>
          </div>

          {activeTab === 'risks' && (
            <RiskTable projectId={id} activities={activities} editing={editing} setEditing={setEditing} onSaved={handleSaved} />
          )}
          {activeTab === 'issues' && (
            <IssueTable projectId={id} activities={activities} editing={editing} setEditing={setEditing} onSaved={handleSaved} />
          )}

          {/* Shared dialog — rendered once at page level */}
          <ItemDialog
            editing={editing}
            setEditing={setEditing}
            activities={activities}
            projectId={id}
            onSaved={handleSaved}
          />
        </div>
      </main>
    </div>
  );
}
