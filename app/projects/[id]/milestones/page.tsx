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
import { Plus, Pencil, Trash2, Flag, ChevronRight, X, Search, Layers } from 'lucide-react';

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
    if (selected) loadMilestoneItems(selected.id);
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
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{selected.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {fmt(selected.start_date)} → {fmt(selected.end_date)}
                      <span className="ml-3 text-orange-600 font-medium">{milestoneItems.length} item</span>
                    </p>
                  </div>
                  <Button
                    onClick={() => { setSearch(''); setPickerOpen(true); }}
                    variant="outline"
                    className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm
                  </Button>
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
                                    <span className="text-xs text-slate-400">{parent.completion_pct ?? 0}%</span>
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
                                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${parent.completion_pct ?? 0}%` }} />
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
                              {(childrenByParent[parent.id] ?? []).length > 0 && (
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
                                          <span className="text-xs text-slate-400">{child.completion_pct ?? 0}%</span>
                                          {(child.plan_start || child.plan_end) && (
                                            <span className="text-xs text-slate-400">{fmt(child.plan_start)} → {fmt(child.plan_end)}</span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-16 shrink-0">
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-orange-300 rounded-full" style={{ width: `${child.completion_pct ?? 0}%` }} />
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
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Tìm kiếm theo tên, phase, Jira key..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto flex-1 mt-2 -mx-1 px-1">
            {filteredPickerEntries.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                {search ? 'Không tìm thấy activity phù hợp.' : 'Tất cả activities đã được gán vào milestone này.'}
              </p>
            ) : (
              <div className="space-y-5">
                {filteredPickerEntries.map(([phase, group]) => (
                  <div key={phase}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">{phase}</p>
                    <div className="space-y-2">

                      {/* Epics with their children */}
                      {group.epics
                        .filter(eg => !q || matchesQ(eg.epic) || eg.children.some(matchesQ))
                        .map(eg => (
                          <div key={eg.epic.id}>
                            {/* Epic row — clicking triggers bulk-add confirm */}
                            <button
                              onClick={() => handlePickerClick(eg.epic)}
                              className="w-full text-left bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-400 rounded-lg px-4 py-2.5 transition-colors flex items-center gap-3"
                            >
                              <Layers className="h-4 w-4 text-orange-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                                  {eg.epic.jira_key && (
                                    <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{eg.epic.jira_key}</span>
                                  )}
                                  <span className="text-sm text-slate-800 font-medium truncate">{eg.epic.activity}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <Badge className={`text-xs px-1.5 py-0 ${statusColor(eg.epic.status)}`}>{eg.epic.status}</Badge>
                                  <span className="text-xs text-slate-400">{eg.epic.completion_pct ?? 0}%</span>
                                  {(eg.epic.plan_start || eg.epic.plan_end) && (
                                    <span className="text-xs text-slate-400">{fmt(eg.epic.plan_start)} → {fmt(eg.epic.plan_end)}</span>
                                  )}
                                  {eg.children.length > 0 && (
                                    <span className="text-xs text-orange-500">{eg.children.length} children</span>
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Children under this epic */}
                            {eg.children.filter(c => !q || matchesQ(c)).length > 0 && (
                              <div className="ml-5 mt-1 space-y-1 pl-4 border-l-2 border-orange-100">
                                {eg.children.filter(c => !q || matchesQ(c)).map(child => (
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
                                        <span className="text-xs text-slate-400">{child.completion_pct ?? 0}%</span>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}

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
                                <span className="text-xs text-slate-400">{c.completion_pct ?? 0}%</span>
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
                              <span className="text-xs text-slate-400">{a.completion_pct ?? 0}%</span>
                              {(a.plan_start || a.plan_end) && (
                                <span className="text-xs text-slate-400">{fmt(a.plan_start)} → {fmt(a.plan_end)}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}

                    </div>
                  </div>
                ))}
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
