'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Flag, ChevronRight, ChevronDown, X, Search, Layers, ChevronsDownUp, ChevronsUpDown, FileDown } from 'lucide-react';
import { statusPct, weightedProgress } from '@/lib/status-weights';

// ─── Types ─────────────────────────────────────────────────────────────────
type Milestone = {
  id: number;
  project_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type ActivityItem = {
  id: number;
  phase: string;
  no: string;
  activity: string;
  status: string;
  completion_pct: number;
  plan_start: string | null;
  plan_end: string | null;
  jira_key: string;
  parent_id: number | null;
};

type PickerPhase = {
  epics: { epic: ActivityItem; children: ActivityItem[] }[];
  standalone: ActivityItem[];
  orphanChildren: ActivityItem[];
};

type Project = {
  id: number; name: string; status: string;
  current_phase: string; client: string; pm_name: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  'Done':        'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'To-do':       'bg-slate-100 text-slate-500',
  'To Do':       'bg-slate-100 text-slate-500',
  'Blocked':     'bg-red-100 text-red-700',
  'Deferred':    'bg-purple-100 text-purple-700',
};

function statusColor(s: string) { return STATUS_COLOR[s] ?? 'bg-slate-100 text-slate-500'; }

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function blank(): Omit<Milestone, 'id' | 'project_id' | 'created_at'> {
  return { name: '', start_date: '', end_date: '' };
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function MilestonesPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selected, setSelected] = useState<Milestone | null>(null);
  const [milestoneItems, setMilestoneItems] = useState<ActivityItem[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityItem[]>([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(blank());
  const [editingId, setEditingId] = useState<number | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [epicConfirmOpen, setEpicConfirmOpen] = useState(false);
  const [pendingEpic, setPendingEpic] = useState<ActivityItem | null>(null);
  const [collapsedEpics, setCollapsedEpics] = useState<Set<number>>(new Set());

  // picker collapse state
  const [pickerCollapsedPhases, setPickerCollapsedPhases] = useState<Set<string>>(new Set());
  const [pickerCollapsedEpics, setPickerCollapsedEpics] = useState<Set<number>>(new Set());

  // ── loaders ─────────────────────────────────────────────────────────────
  const loadMilestones = useCallback(async () => {
    const data = await fetch(`/api/projects/${id}/milestones`).then(r => r.json());
    setMilestones(data);
  }, [id]);

  const loadMilestoneItems = useCallback(async (milestoneId: number) => {
    const data = await fetch(`/api/projects/${id}/milestones/${milestoneId}/epics`).then(r => r.json());
    setMilestoneItems(data);
  }, [id]);

  const loadAllActivities = useCallback(async () => {
    const data = await fetch(`/api/projects/${id}/activities`).then(r => r.json());
    setAllActivities(data);
  }, [id]);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject);
    loadMilestones();
    loadAllActivities();
  }, [id, loadMilestones, loadAllActivities]);

  useEffect(() => {
    if (selected) { loadMilestoneItems(selected.id); setCollapsedEpics(new Set()); }
  }, [selected, loadMilestoneItems]);

  // ── milestone CRUD ───────────────────────────────────────────────────────
  function openCreate() {
    setEditingId(null); setEditForm(blank()); setEditOpen(true);
  }

  function openEdit(m: Milestone) {
    setEditingId(m.id);
    setEditForm({ name: m.name, start_date: m.start_date ?? '', end_date: m.end_date ?? '' });
    setEditOpen(true);
  }

  async function saveMilestone() {
    if (!editForm.name.trim()) { toast.error('Tên milestone không được để trống'); return; }
    const url = editingId
      ? `/api/projects/${id}/milestones/${editingId}`
      : `/api/projects/${id}/milestones`;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    if (!res.ok) { toast.error('Lỗi khi lưu milestone'); return; }
    const saved: Milestone = await res.json();
    setEditOpen(false);
    await loadMilestones();
    if (!editingId) setSelected(saved);
    else if (selected?.id === editingId) setSelected(saved);
    toast.success(editingId ? 'Đã cập nhật milestone' : 'Đã tạo milestone');
  }

  async function deleteMilestone(m: Milestone) {
    if (!confirm(`Xóa milestone "${m.name}"?`)) return;
    await fetch(`/api/projects/${id}/milestones/${m.id}`, { method: 'DELETE' });
    if (selected?.id === m.id) { setSelected(null); setMilestoneItems([]); }
    await loadMilestones();
    toast.success('Đã xóa milestone');
  }

  // ── item management ──────────────────────────────────────────────────────
  async function postToMilestone(activityId: number) {
    if (!selected) return;
    await fetch(`/api/projects/${id}/milestones/${selected.id}/epics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: activityId }),
    });
  }

  async function handlePickerClick(activity: ActivityItem) {
    if (activity.no === 'EPIC') {
      setPendingEpic(activity);
      setEpicConfirmOpen(true);
    } else {
      if (!selected) return;
      await postToMilestone(activity.id);
      await loadMilestoneItems(selected.id);
      toast.success('Đã thêm vào milestone');
    }
  }

  async function confirmBulkAdd() {
    if (!selected || !pendingEpic) return;
    const alreadyIn = new Set(milestoneItems.map(e => e.id));
    const children = allActivities.filter(a => a.parent_id === pendingEpic.id);
    const toAdd = [pendingEpic.id, ...children.map(c => c.id)].filter(xid => !alreadyIn.has(xid));
    await Promise.all(toAdd.map(actId => postToMilestone(actId)));
    await loadMilestoneItems(selected.id);
    setEpicConfirmOpen(false);
    setPendingEpic(null);
    toast.success(`Đã thêm ${toAdd.length} item vào milestone`);
  }

  async function removeItem(activityId: number) {
    if (!selected) return;
    await fetch(`/api/projects/${id}/milestones/${selected.id}/epics?activity_id=${activityId}`, { method: 'DELETE' });
    await loadMilestoneItems(selected.id);
    toast.success('Đã xóa khỏi milestone');
  }

  function toggleEpic(epicId: number) {
    setCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
      return next;
    });
  }

  function collapseAll(epicIds: number[]) {
    setCollapsedEpics(new Set(epicIds));
  }

  function expandAll() {
    setCollapsedEpics(new Set());
  }

  // picker collapse/expand helpers
  function togglePickerPhase(phase: string) {
    setPickerCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  }

  function togglePickerEpic(epicId: number) {
    setPickerCollapsedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
      return next;
    });
  }

  function pickerCollapseAll(phases: string[], epicIds: number[]) {
    setPickerCollapsedPhases(new Set(phases));
    setPickerCollapsedEpics(new Set(epicIds));
  }

  function pickerExpandAll() {
    setPickerCollapsedPhases(new Set());
    setPickerCollapsedEpics(new Set());
  }

  // ── export PDF (print window) ──────────────────────────────────────────────
  function exportPDF() {
    if (!selected) return;

    const rows: string[] = [];
    for (const [phase, parents] of Object.entries(displayByPhase)) {
      rows.push(`<tr class="phase-header"><td colspan="5">${phase}</td></tr>`);
      for (const parent of parents) {
        const isEpic = parent.no === 'EPIC';
        const label = isEpic
          ? `<span class="badge-epic">EPIC</span> ${parent.activity}`
          : `${parent.jira_key ? `<span class="badge-jira">${parent.jira_key}</span> ` : ''}${parent.activity}`;
        rows.push(`<tr class="${isEpic ? 'epic-row' : ''}">
          <td class="indent-0">${label}</td>
          <td><span class="status">${parent.status}</span></td>
          <td>${itemPct(parent)}%</td>
          <td>${fmt(parent.plan_start)}</td>
          <td>${fmt(parent.plan_end)}</td>
        </tr>`);
        for (const child of (childrenByParent[parent.id] ?? [])) {
          rows.push(`<tr class="child-row">
            <td class="indent-1">↳ ${child.jira_key ? `<span class="badge-jira">${child.jira_key}</span> ` : ''}${child.activity}</td>
            <td><span class="status">${child.status}</span></td>
            <td>${itemPct(child)}%</td>
            <td>${fmt(child.plan_start)}</td>
            <td>${fmt(child.plan_end)}</td>
          </tr>`);
        }
      }
    }

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>${selected.name}</title>
<style>
  @page { margin: 20mm; size: A4 landscape; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #ea580c; }
  .meta { font-size: 11px; color: #64748b; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700; color: #475569; border-bottom: 2px solid #e2e8f0; }
  td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .phase-header td { background: #fff7ed; font-weight: 700; font-size: 10px; color: #c2410c; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; border-top: 1px solid #fed7aa; }
  .epic-row td { background: #fff7ed; }
  .child-row td { background: #fafafa; }
  .indent-1 { padding-left: 24px !important; }
  .badge-epic { background: #fed7aa; color: #c2410c; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; margin-right: 4px; }
  .badge-jira { background: #dbeafe; color: #1d4ed8; font-size: 9px; font-family: monospace; padding: 1px 5px; border-radius: 3px; margin-right: 4px; }
  .status { font-size: 9px; padding: 2px 6px; border-radius: 10px; background: #f1f5f9; color: #475569; }
  @media print { button { display: none; } }
</style>
</head>
<body>
<h1>${selected.name}</h1>
<div class="meta">
  Project: <strong>${project?.name ?? ''}</strong> &nbsp;|&nbsp;
  Thời gian: <strong>${fmt(selected.start_date)} → ${fmt(selected.end_date)}</strong> &nbsp;|&nbsp;
  Tổng: <strong>${milestoneItems.length} item</strong> &nbsp;|&nbsp;
  Tiến độ (weighted): <strong>${milestonePct}%</strong> &nbsp;|&nbsp;
  Xuất lúc: <strong>${new Date().toLocaleDateString('vi-VN')}</strong>
</div>
<table>
  <thead><tr>
    <th style="width:45%">Activity</th>
    <th style="width:15%">Trạng thái</th>
    <th style="width:8%">%</th>
    <th style="width:14%">Bắt đầu</th>
    <th style="width:14%">Kết thúc</th>
  </tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>
</body></html>`;

    const win = window.open('', '_blank', 'width=1100,height=800');
    if (!win) { toast.error('Vui lòng cho phép popup để xuất PDF'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  }

  // ── computed ─────────────────────────────────────────────────────────────
  const inMilestoneIds = new Set(milestoneItems.map(e => e.id));

  // ── picker structure ─────────────────────────────────────────────────────
  const q = search.toLowerCase().trim();

  const available = allActivities.filter(a => !inMilestoneIds.has(a.id));

  const pickerPhases: Record<string, PickerPhase> = {};

  // First pass: create epic groups per phase
  for (const a of available) {
    if (!pickerPhases[a.phase]) pickerPhases[a.phase] = { epics: [], standalone: [], orphanChildren: [] };
    if (a.no === 'EPIC') pickerPhases[a.phase].epics.push({ epic: a, children: [] });
  }

  // Second pass: assign children and standalone
  for (const a of available) {
    if (a.no === 'EPIC') continue;
    if (!pickerPhases[a.phase]) pickerPhases[a.phase] = { epics: [], standalone: [], orphanChildren: [] };
    if (a.parent_id) {
      const epicGroup = pickerPhases[a.phase].epics.find(eg => eg.epic.id === a.parent_id);
      if (epicGroup) {
        epicGroup.children.push(a);
      } else {
        pickerPhases[a.phase].orphanChildren.push(a);
      }
    } else {
      pickerPhases[a.phase].standalone.push(a);
    }
  }

  function matchesQ(a: ActivityItem): boolean {
    if (!q) return true;
    return (
      a.activity.toLowerCase().includes(q) ||
      a.phase.toLowerCase().includes(q) ||
      (a.jira_key ?? '').toLowerCase().includes(q) ||
      (a.no ?? '').toLowerCase().includes(q)
    );
  }

  const filteredPickerEntries = Object.entries(pickerPhases).filter(([, g]) =>
    g.epics.some(eg => matchesQ(eg.epic) || eg.children.some(matchesQ)) ||
    g.standalone.some(matchesQ) ||
    g.orphanChildren.some(matchesQ)
  );

  // ── display tree ─────────────────────────────────────────────────────────
  // Items whose parent IS in the milestone → shown as children
  const childrenByParent: Record<number, ActivityItem[]> = {};
  for (const item of milestoneItems) {
    if (item.parent_id && inMilestoneIds.has(item.parent_id)) {
      (childrenByParent[item.parent_id] = childrenByParent[item.parent_id] ?? []).push(item);
    }
  }

  // ── weighted progress (%) ──────────────────────────────────────────────────
  // Mỗi story/task: % = trọng số trạng thái × 100 (Done=100, In Testing=60, ...).
  // EPIC: trung bình cộng % của các child trong milestone.
  function itemPct(item: ActivityItem): number {
    if (item.no === 'EPIC') {
      const kids = childrenByParent[item.id] ?? [];
      return kids.length > 0 ? weightedProgress(kids.map(k => k.status)) : statusPct(item.status);
    }
    return statusPct(item.status);
  }

  // Tiến độ tổng milestone = Σ(trọng số trạng thái) / tổng số leaf activity (EPIC không tính).
  const milestoneLeaves = milestoneItems.filter(i => i.no !== 'EPIC');
  const milestonePct = weightedProgress(milestoneLeaves.map(i => i.status));

  // Top-level: no parent, or parent not in milestone
  const topLevelItems = milestoneItems.filter(
    item => !item.parent_id || !inMilestoneIds.has(item.parent_id)
  );

  const displayByPhase: Record<string, ActivityItem[]> = {};
  for (const item of topLevelItems) {
    (displayByPhase[item.phase] = displayByPhase[item.phase] ?? []).push(item);
  }

  // ── pending epic children count ───────────────────────────────────────────
  const pendingEpicNewChildren = pendingEpic
    ? allActivities.filter(a => a.parent_id === pendingEpic.id && !inMilestoneIds.has(a.id))
    : [];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">{project?.name}</p>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Flag className="h-5 w-5 text-orange-500" />
                Milestones
              </h1>
            </div>
            <Button onClick={openCreate} className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4" />
              Tạo Milestone
            </Button>
          </div>
        </div>

        <div className="flex gap-0 h-[calc(100vh-73px)]">
          {/* Left panel — milestone list */}
          <div className="w-80 border-r border-slate-200 bg-white overflow-y-auto shrink-0">
            {milestones.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Flag className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Chưa có milestone nào.</p>
                <p className="text-xs mt-1">Nhấn "+ Tạo Milestone" để bắt đầu.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {milestones.map(m => (
                  <li
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={`px-4 py-3 cursor-pointer hover:bg-orange-50 transition-colors ${selected?.id === m.id ? 'bg-orange-50 border-l-2 border-orange-500' : 'border-l-2 border-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-800 text-sm truncate">{m.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmt(m.start_date)} → {fmt(m.end_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); openEdit(m); }} className="p-1 rounded hover:bg-slate-200 text-slate-500">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteMilestone(m); }} className="p-1 rounded hover:bg-red-100 text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right panel — milestone items tree */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Flag className="h-12 w-12 mb-3 text-slate-200" />
                <p className="text-sm">Chọn một milestone để xem và quản lý</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-slate-800">{selected.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {fmt(selected.start_date)} → {fmt(selected.end_date)}
                      <span className="ml-3 text-orange-600 font-medium">{milestoneItems.length} item</span>
                    </p>
                    {milestoneLeaves.length > 0 && (
                      <div className="flex items-center gap-3 mt-2 max-w-md">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${milestonePct}%` }} />
                        </div>
                        <span className="text-sm font-bold text-orange-600 tabular-nums shrink-0">{milestonePct}%</span>
                        <span className="text-xs text-slate-400 shrink-0">tiến độ (weighted)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const epicIds = topLevelItems.filter(i => i.no === 'EPIC' && (childrenByParent[i.id]?.length ?? 0) > 0).map(i => i.id);
                      const allCollapsed = epicIds.length > 0 && epicIds.every(eid => collapsedEpics.has(eid));
                      if (epicIds.length === 0) return null;
                      return allCollapsed ? (
                        <Button variant="ghost" size="sm" onClick={expandAll} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2">
                          <ChevronsUpDown className="h-3.5 w-3.5" />
                          Expand All
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => collapseAll(epicIds)} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2">
                          <ChevronsDownUp className="h-3.5 w-3.5" />
                          Collapse All
                        </Button>
                      );
                    })()}
                    <Button
                      onClick={exportPDF}
                      variant="outline"
                      className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50"
                    >
                      <FileDown className="h-4 w-4" />
                      Export PDF
                    </Button>
                    <Button
                      onClick={() => { setSearch(''); setPickerCollapsedPhases(new Set()); setPickerCollapsedEpics(new Set()); setPickerOpen(true); }}
                      variant="outline"
                      className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm
                    </Button>
                  </div>
                </div>

                {milestoneItems.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-400">
                    <p className="text-sm">Milestone này chưa có item nào.</p>
                    <p className="text-xs mt-1">Nhấn "Thêm" để gán activity vào milestone.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(displayByPhase).map(([phase, parents]) => (
                      <div key={phase}>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{phase}</p>
                        <div className="space-y-2">
                          {parents.map(parent => (
                            <div key={parent.id}>
                              {/* Parent / standalone row */}
                              <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors ${
                                parent.no === 'EPIC'
                                  ? 'bg-orange-50/50 border-orange-200 hover:border-orange-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}>
                                {parent.no === 'EPIC' && (childrenByParent[parent.id]?.length ?? 0) > 0 && (
                                  <button
                                    onClick={() => toggleEpic(parent.id)}
                                    className="p-0.5 rounded text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                    title={collapsedEpics.has(parent.id) ? 'Expand' : 'Collapse'}
                                  >
                                    {collapsedEpics.has(parent.id)
                                      ? <ChevronRight className="h-4 w-4" />
                                      : <ChevronDown className="h-4 w-4" />}
                                  </button>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {parent.no === 'EPIC' && (
                                      <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                                    )}
                                    {parent.jira_key && (
                                      <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{parent.jira_key}</span>
                                    )}
                                    {parent.no && parent.no !== 'EPIC' && (
                                      <span className="text-xs text-slate-400">#{parent.no}</span>
                                    )}
                                    <span className="text-sm font-medium text-slate-800 truncate">{parent.activity}</span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    <Badge className={`text-xs px-1.5 py-0 ${statusColor(parent.status)}`}>{parent.status}</Badge>
                                    <span className="text-xs text-slate-400">{itemPct(parent)}%</span>
                                    {(parent.plan_start || parent.plan_end) && (
                                      <span className="text-xs text-slate-400">{fmt(parent.plan_start)} → {fmt(parent.plan_end)}</span>
                                    )}
                                    {(childrenByParent[parent.id]?.length ?? 0) > 0 && (
                                      <span className="text-xs text-orange-500">{childrenByParent[parent.id].length} sub-item</span>
                                    )}
                                  </div>
                                </div>
                                <div className="w-20 shrink-0">
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${itemPct(parent)}%` }} />
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeItem(parent.id)}
                                  className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                  title="Xóa khỏi milestone"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              {/* Children rows — indented */}
                              {(childrenByParent[parent.id] ?? []).length > 0 && !collapsedEpics.has(parent.id) && (
                                <div className="ml-5 mt-1.5 space-y-1.5 pl-4 border-l-2 border-orange-100">
                                  {(childrenByParent[parent.id] ?? []).map(child => (
                                    <div key={child.id} className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-3 hover:border-slate-300 transition-colors">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {child.jira_key && (
                                            <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{child.jira_key}</span>
                                          )}
                                          {child.no && child.no !== 'EPIC' && (
                                            <span className="text-xs text-slate-400">{child.no}</span>
                                          )}
                                          <span className="text-sm text-slate-700 truncate">{child.activity}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                          <Badge className={`text-xs px-1.5 py-0 ${statusColor(child.status)}`}>{child.status}</Badge>
                                          <span className="text-xs text-slate-400">{itemPct(child)}%</span>
                                          {(child.plan_start || child.plan_end) && (
                                            <span className="text-xs text-slate-400">{fmt(child.plan_start)} → {fmt(child.plan_end)}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-16 shrink-0">
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-orange-300 rounded-full" style={{ width: `${itemPct(child)}%` }} />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => removeItem(child.id)}
                                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                                        title="Xóa khỏi milestone"
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── Milestone create/edit dialog ──────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Chỉnh sửa Milestone' : 'Tạo Milestone mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tên Milestone <span className="text-red-500">*</span></Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                placeholder="VD: Phase 1 Completion, MVP Release..."
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ngày bắt đầu</Label>
                <Input type="date" value={editForm.start_date ?? ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Ngày kết thúc</Label>
                <Input type="date" value={editForm.end_date ?? ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button onClick={saveMilestone} className="bg-orange-500 hover:bg-orange-600 text-white">
              {editingId ? 'Lưu thay đổi' : 'Tạo Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Activity picker dialog ────────────────────────────────────────────── */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Thêm vào &quot;{selected?.name}&quot;</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Tìm kiếm theo tên, phase, Jira key..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            {filteredPickerEntries.length > 0 && (
              (() => {
                const allPhases = filteredPickerEntries.map(([p]) => p);
                const allEpicIds = filteredPickerEntries.flatMap(([, g]) => g.epics.map(eg => eg.epic.id));
                const allCollapsed = allPhases.every(p => pickerCollapsedPhases.has(p));
                return allCollapsed ? (
                  <Button variant="ghost" size="sm" onClick={pickerExpandAll} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2 shrink-0">
                    <ChevronsUpDown className="h-3.5 w-3.5" />
                    Expand All
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => pickerCollapseAll(allPhases, allEpicIds)} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2 shrink-0">
                    <ChevronsDownUp className="h-3.5 w-3.5" />
                    Collapse All
                  </Button>
                );
              })()
            )}
          </div>
          <div className="overflow-y-auto flex-1 mt-2 -mx-1 px-1">
            {filteredPickerEntries.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                {search ? 'Không tìm thấy activity phù hợp.' : 'Tất cả activities đã được gán vào milestone này.'}
              </p>
            ) : (
              <div className="space-y-5">
                {filteredPickerEntries.map(([phase, group]) => {
                  const phaseCollapsed = pickerCollapsedPhases.has(phase);
                  return (
                  <div key={phase}>
                    <button
                      onClick={() => togglePickerPhase(phase)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1 hover:text-orange-500 transition-colors"
                    >
                      {phaseCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {phase}
                    </button>
                    {!phaseCollapsed && (
                    <div className="space-y-2">

                      {/* Epics with their children */}
                      {group.epics
                        .filter(eg => !q || matchesQ(eg.epic) || eg.children.some(matchesQ))
                        .map(eg => {
                          const epicCollapsed = pickerCollapsedEpics.has(eg.epic.id);
                          const filteredChildren = eg.children.filter(c => !q || matchesQ(c));
                          return (
                          <div key={eg.epic.id}>
                            {/* Epic row — left side collapses children, right side adds */}
                            <div className="bg-orange-50 border border-orange-200 hover:border-orange-400 rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2">
                              {filteredChildren.length > 0 && (
                                <button
                                  onClick={() => togglePickerEpic(eg.epic.id)}
                                  className="p-0.5 rounded text-orange-400 hover:text-orange-600 shrink-0"
                                  title={epicCollapsed ? 'Expand children' : 'Collapse children'}
                                >
                                  {epicCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </button>
                              )}
                              {filteredChildren.length === 0 && <Layers className="h-4 w-4 text-orange-500 shrink-0" />}
                              <button
                                onClick={() => handlePickerClick(eg.epic)}
                                className="flex-1 text-left min-w-0"
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                                  {eg.epic.jira_key && (
                                    <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{eg.epic.jira_key}</span>
                                  )}
                                  <span className="text-sm text-slate-800 font-medium truncate">{eg.epic.activity}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <Badge className={`text-xs px-1.5 py-0 ${statusColor(eg.epic.status)}`}>{eg.epic.status}</Badge>
                                  <span className="text-xs text-slate-400">{eg.children.length > 0 ? weightedProgress(eg.children.map(c => c.status)) : statusPct(eg.epic.status)}%</span>
                                  {(eg.epic.plan_start || eg.epic.plan_end) && (
                                    <span className="text-xs text-slate-400">{fmt(eg.epic.plan_start)} → {fmt(eg.epic.plan_end)}</span>
                                  )}
                                  {filteredChildren.length > 0 && (
                                    <span className="text-xs text-orange-500">{filteredChildren.length} children</span>
                                  )}
                                </div>
                              </button>
                            </div>

                            {/* Children under this epic */}
                            {filteredChildren.length > 0 && !epicCollapsed && (
                              <div className="ml-5 mt-1 space-y-1 pl-4 border-l-2 border-orange-100">
                                {filteredChildren.map(child => (
                                  <button
                                    key={child.id}
                                    onClick={() => handlePickerClick(child)}
                                    className="w-full text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-lg px-4 py-2 transition-colors flex items-center gap-3"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {child.jira_key && (
                                          <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{child.jira_key}</span>
                                        )}
                                        {child.no && child.no !== 'EPIC' && (
                                          <span className="text-xs text-slate-500">{child.no}</span>
                                        )}
                                        <span className="text-sm text-slate-700 truncate">{child.activity}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-xs text-orange-400">Epic: {eg.epic.activity}</span>
                                        <Badge className={`text-xs px-1.5 py-0 ${statusColor(child.status)}`}>{child.status}</Badge>
                                        <span className="text-xs text-slate-400">{statusPct(child.status)}%</span>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}

                      {/* Orphan children (epic is already in milestone or different phase) */}
                      {group.orphanChildren.filter(c => !q || matchesQ(c)).map(c => {
                        const epicName = c.parent_id
                          ? allActivities.find(a => a.id === c.parent_id)?.activity ?? null
                          : null;
                        return (
                          <button
                            key={c.id}
                            onClick={() => handlePickerClick(c)}
                            className="w-full text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-3"
                          >
                            <Plus className="h-4 w-4 text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {c.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{c.jira_key}</span>}
                                {c.no && c.no !== 'EPIC' && <span className="text-xs text-slate-500">{c.no}</span>}
                                <span className="text-sm text-slate-800 font-medium truncate">{c.activity}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {epicName && <span className="text-xs text-orange-400">Epic: {epicName}</span>}
                                <Badge className={`text-xs px-1.5 py-0 ${statusColor(c.status)}`}>{c.status}</Badge>
                                <span className="text-xs text-slate-400">{statusPct(c.status)}%</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}

                      {/* Standalone activities (no parent) */}
                      {group.standalone.filter(a => !q || matchesQ(a)).map(a => (
                        <button
                          key={a.id}
                          onClick={() => handlePickerClick(a)}
                          className="w-full text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-3"
                        >
                          <Plus className="h-4 w-4 text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{a.jira_key}</span>}
                              {a.no && <span className="text-xs text-slate-400">#{a.no}</span>}
                              <span className="text-sm text-slate-800 font-medium truncate">{a.activity}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <Badge className={`text-xs px-1.5 py-0 ${statusColor(a.status)}`}>{a.status}</Badge>
                              <span className="text-xs text-slate-400">{statusPct(a.status)}%</span>
                              {(a.plan_start || a.plan_end) && (
                                <span className="text-xs text-slate-400">{fmt(a.plan_start)} → {fmt(a.plan_end)}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                    </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setPickerOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Epic bulk-add confirm dialog ──────────────────────────────────────── */}
      <Dialog
        open={epicConfirmOpen}
        onOpenChange={open => { if (!open) { setEpicConfirmOpen(false); setPendingEpic(null); } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Thêm Epic vào Milestone</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-slate-700">
              Tất cả các child sẽ đưa vào milestone, bạn có đồng ý?
            </p>
            {pendingEpic && (
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                  <span className="text-sm font-medium text-slate-800">{pendingEpic.activity}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {pendingEpicNewChildren.length > 0
                    ? `${pendingEpicNewChildren.length} child sẽ được thêm vào`
                    : 'Không có child nào'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEpicConfirmOpen(false); setPendingEpic(null); }}>
              NO
            </Button>
            <Button onClick={confirmBulkAdd} className="bg-orange-500 hover:bg-orange-600 text-white">
              YES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
