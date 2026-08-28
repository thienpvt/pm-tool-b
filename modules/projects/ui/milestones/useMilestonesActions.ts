import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import type { Activity, ActivityItem, Milestone, Project } from './types';
import { blank, fmt } from './_components/helpers';
import { statusPct, weightedProgress } from '@/lib/status-weights';

type EditForm = Omit<Milestone, 'id' | 'project_id' | 'created_at'>;

export function useMilestonesActions(
  projectId: string,
  project: Project | null,
  selected: Milestone | null,
  milestoneItems: ActivityItem[],
  allActivities: Activity[],
  setAllActivities: Dispatch<SetStateAction<Activity[]>>,
  setMilestoneItems: Dispatch<SetStateAction<ActivityItem[]>>,
  setSelected: Dispatch<SetStateAction<Milestone | null>>,
  loadMilestones: () => Promise<void>,
  loadMilestoneItems: (milestoneId: number) => Promise<ActivityItem[]>,
  setDetailActivity: Dispatch<SetStateAction<Activity | null>>,
  setEditOpen: Dispatch<SetStateAction<boolean>>,
  setEditForm: Dispatch<SetStateAction<EditForm>>,
  setEditingId: Dispatch<SetStateAction<number | null>>,
  setEpicConfirmOpen: Dispatch<SetStateAction<boolean>>,
  setPendingEpic: Dispatch<SetStateAction<ActivityItem | null>>,
  editingId: number | null,
  editForm: EditForm,
  pendingEpic: ActivityItem | null,
) {
  const openDetail = useCallback((item: ActivityItem) => {
    const full = allActivities.find(a => a.id === item.id);
    if (full) setDetailActivity(full);
  }, [allActivities, setDetailActivity]);

  const handleDetailSave = useCallback((updated: Activity) => {
    setAllActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
    if (selected) loadMilestoneItems(selected.id).then(setMilestoneItems);
    setDetailActivity(updated);
  }, [selected, loadMilestoneItems, setAllActivities, setDetailActivity, setMilestoneItems]);

  const openCreate = useCallback(() => {
    setEditingId(null); setEditForm(blank()); setEditOpen(true);
  }, [setEditingId, setEditForm, setEditOpen]);

  const openEdit = useCallback((m: Milestone) => {
    setEditingId(m.id);
    setEditForm({ name: m.name, start_date: m.start_date ?? '', end_date: m.end_date ?? '' });
    setEditOpen(true);
  }, [setEditingId, setEditForm, setEditOpen]);

  const saveMilestone = useCallback(async () => {
    if (!editForm.name.trim()) { toast.error('Tên milestone không được để trống'); return; }
    const url = editingId
      ? `/api/projects/${projectId}/milestones/${editingId}`
      : `/api/projects/${projectId}/milestones`;
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    if (!res.ok) { toast.error('Lỗi khi lưu milestone'); return; }
    const saved: Milestone = await res.json();
    setEditOpen(false);
    await loadMilestones();
    if (!editingId) setSelected(saved);
    else setSelected(prev => prev?.id === editingId ? saved : prev);
    toast.success(editingId ? 'Đã cập nhật milestone' : 'Đã tạo milestone');
  }, [editForm, editingId, projectId, loadMilestones, setEditOpen, setSelected]);

  const deleteMilestone = useCallback(async (m: Milestone) => {
    if (!confirm(`Xóa milestone "${m.name}"?`)) return;
    await fetch(`/api/projects/${projectId}/milestones/${m.id}`, { method: 'DELETE' });
    setSelected(prev => {
      if (prev?.id === m.id) { setMilestoneItems([]); return null; }
      return prev;
    });
    await loadMilestones();
    toast.success('Đã xóa milestone');
  }, [projectId, loadMilestones, setSelected, setMilestoneItems]);

  const postToMilestone = useCallback(async (activityId: number) => {
    if (!selected) return;
    await fetch(`/api/projects/${projectId}/milestones/${selected.id}/epics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_id: activityId }),
    });
  }, [projectId, selected]);

  const handlePickerClick = useCallback(async (activity: ActivityItem) => {
    if (activity.no === 'EPIC') {
      setPendingEpic(activity);
      setEpicConfirmOpen(true);
    } else {
      if (!selected) return;
      await postToMilestone(activity.id);
      const items = await loadMilestoneItems(selected.id);
      setMilestoneItems(items);
      toast.success('Đã thêm vào milestone');
    }
  }, [selected, postToMilestone, loadMilestoneItems, setMilestoneItems, setPendingEpic, setEpicConfirmOpen]);

  const confirmBulkAdd = useCallback(async () => {
    if (!selected || !pendingEpic) return;
    const alreadyIn = new Set(milestoneItems.map(e => e.id));
    const children = allActivities.filter(a => a.parent_id === pendingEpic.id);
    const toAdd = [pendingEpic.id, ...children.map(c => c.id)].filter(xid => !alreadyIn.has(xid));
    await Promise.all(toAdd.map(actId => postToMilestone(actId)));
    const items = await loadMilestoneItems(selected.id);
    setMilestoneItems(items);
    setEpicConfirmOpen(false);
    setPendingEpic(null);
    toast.success(`Đã thêm ${toAdd.length} item vào milestone`);
  }, [selected, pendingEpic, milestoneItems, allActivities, postToMilestone, loadMilestoneItems, setMilestoneItems, setEpicConfirmOpen, setPendingEpic]);

  const removeItem = useCallback(async (activityId: number) => {
    if (!selected) return;
    await fetch(`/api/projects/${projectId}/milestones/${selected.id}/epics?activity_id=${activityId}`, { method: 'DELETE' });
    const items = await loadMilestoneItems(selected.id);
    setMilestoneItems(items);
    toast.success('Đã xóa khỏi milestone');
  }, [projectId, selected, loadMilestoneItems, setMilestoneItems]);

  const exportPDF = useCallback((
    displayByPhase: Record<string, ActivityItem[]>,
    childrenByParent: Record<number, ActivityItem[]>,
    itemPct: (item: ActivityItem) => number,
    milestonePct: number,
  ) => {
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
  }, [selected, project, milestoneItems]);

  return {
    openDetail,
    handleDetailSave,
    openCreate,
    openEdit,
    saveMilestone,
    deleteMilestone,
    handlePickerClick,
    confirmBulkAdd,
    removeItem,
    exportPDF,
  };
}

export function computeItemPct(
  item: ActivityItem,
  childrenByParent: Record<number, ActivityItem[]>,
): number {
  if (item.no === 'EPIC') {
    const kids = childrenByParent[item.id] ?? [];
    return kids.length > 0 ? weightedProgress(kids.map(k => k.status)) : statusPct(item.status);
  }
  return statusPct(item.status);
}
