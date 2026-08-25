import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Activity, Project, Holiday } from './types';
import { DEFAULT_PHASES, DONE_STATUSES } from './types';
import { calcLag } from './_components/LagCalc';
import { activitiesToCSV, downloadCSV, escapeCSV, TEMPLATE_ROWS, CSV_HEADERS } from './_components/CsvHelpers';

export function useTimelineActions(
  projectId: string,
  activities: Activity[],
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>,
  project: Project | null,
  holidays: Holiday[],
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>,
  filteredActivities: Activity[],
  setCollapsedParents: React.Dispatch<React.SetStateAction<Set<number>>>,
  roadmapRef: React.RefObject<HTMLDivElement | null>,
) {
  const newActivityIdRef = useRef<number | null>(null);

  const generateKey = useCallback(() => {
    if (!project) return '';
    const prefix = (project.name.replace(/[^a-zA-Z]/g, '').slice(0, 3) || project.name.slice(0, 3)).toUpperCase();
    const maxNum = activities.reduce((max, a) => {
      if (!a.jira_key) return max;
      const m = a.jira_key.match(/-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
  }, [project, activities]);

  const updateField = (rowId: number, field: string, value: string | number) =>
    setActivities(a => a.map(r => r.id === rowId ? { ...r, [field]: value } : r));

  const saveRow = async (row: Activity) => {
    await fetch(`/api/projects/${projectId}/activities`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
    });
  };

  const deleteRow = async (rowId: number) => {
    await fetch(`/api/projects/${projectId}/activities?rowId=${rowId}`, { method: 'DELETE' });
    setActivities(a => a.filter(r => r.id !== rowId));
    toast.success('Deleted');
  };

  const addActivity = async () => {
    const phase = project?.current_phase ?? activities[0]?.phase ?? DEFAULT_PHASES[0];
    const res = await fetch(`/api/projects/${projectId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, activity: '', jira_key: generateKey(), sprint: '', project_status: project?.status ?? '', parent_id: null }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    newActivityIdRef.current = row.id;
    return row.id;
  };

  const createChild = async (parentId: number) => {
    const parent = activities.find(a => a.id === parentId);
    if (!parent) return;
    const res = await fetch(`/api/projects/${projectId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: parent.phase, activity: 'New Task', parent_id: parentId, status: 'To-do', jira_key: generateKey(), project_status: project?.status ?? '' }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    setCollapsedParents(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    toast.success('Child task created');
  };

  const duplicateActivity = async (activity: Activity) => {
    const { id: _id, order_idx: _order, ...fields } = activity;
    const res = await fetch(`/api/projects/${projectId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, activity: `${activity.activity} (copy)`, jira_key: generateKey() }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    toast.success('Duplicated');
  };

  const createChildFromDetail = useCallback(async (parentId: number, name: string): Promise<Activity> => {
    const parent = activities.find(a => a.id === parentId);
    const res = await fetch(`/api/projects/${projectId}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: parent?.phase ?? DEFAULT_PHASES[0],
        activity: name,
        parent_id: parentId,
        status: 'To-do',
        jira_key: generateKey(),
        project_status: project?.status ?? '',
      }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    setCollapsedParents(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    return row;
  }, [projectId, activities, generateKey, project, setActivities, setCollapsedParents]);

  const handleExport = () => {
    if (!filteredActivities.length) { toast.error('No activities to export'); return; }
    downloadCSV(activitiesToCSV(filteredActivities), 'project-timeline.csv');
    toast.success(`Exported ${filteredActivities.length} activities`);
  };

  const handleDownloadTemplate = () => {
    const lines = [CSV_HEADERS.join(','), ...TEMPLATE_ROWS.map(r => r.map(escapeCSV).join(','))];
    downloadCSV(lines.join('\r\n'), 'timeline-template.csv');
    toast.success('Template downloaded');
  };

  const addHoliday = async (newHDate: string, newHName: string) => {
    if (!newHDate) return;
    const res = await fetch(`/api/projects/${projectId}/holidays`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newHDate, name: newHName }),
    });
    if (res.status === 409) { toast.error('Ngày này đã được thêm rồi'); return; }
    const row = await res.json();
    setHolidays(h => [...h, row].sort((a, b) => a.date.localeCompare(b.date)));
    toast.success('Đã thêm ngày nghỉ');
  };

  const removeHoliday = async (hid: number) => {
    await fetch(`/api/projects/${projectId}/holidays?hid=${hid}`, { method: 'DELETE' });
    setHolidays(h => h.filter(x => x.id !== hid));
  };

  const handleExportPng = async () => {
    if (!roadmapRef.current) { toast.error('Roadmap chưa render'); return; }
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(roadmapRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = 'roadmap.png'; a.href = dataUrl; a.click();
      toast.success('Exported roadmap.png');
    } catch {
      toast.error('Export PNG thất bại');
    }
  };

  return {
    newActivityIdRef, generateKey, updateField, saveRow, deleteRow,
    addActivity, createChild, duplicateActivity, createChildFromDetail,
    handleExport, handleDownloadTemplate, addHoliday, removeHoliday, handleExportPng,
  };
}
