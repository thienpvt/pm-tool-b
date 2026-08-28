'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CalendarX2, Plus, Trash2, Eye, Copy, FolderPlus } from 'lucide-react';
import ImportMappingDialog from '@/modules/jira/ui/timeline-import/ImportMappingDialog';
import JiraSyncDialog from '@/modules/jira/ui/JiraSyncDialog';
import type { Activity, TeamMember, Holiday, ContextMenuState } from '../types';
import { ActivityDetail } from './ActivityDetail';

export type TimelineDialogsProps = {
  id: string;
  teamMembers: TeamMember[];
  holidays: Holiday[];
  holidayOpen: boolean;
  setHolidayOpen: (v: boolean) => void;
  newHDate: string;
  setNewHDate: (v: string) => void;
  newHName: string;
  setNewHName: (v: string) => void;
  addHoliday: () => void;
  removeHoliday: (hid: number) => void;
  detailActivity: Activity | null;
  setDetailActivity: (a: Activity | null) => void;
  childrenByParent: Map<number, Activity[]>;
  createChildFromDetail: (parentId: number, name: string) => Promise<Activity>;
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  deleteRow: (rowId: number) => void;
  importOpen: boolean;
  setImportOpen: (v: boolean) => void;
  projectPhase: string;
  load: () => void;
  jiraSyncOpen: boolean;
  setJiraSyncOpen: (v: boolean) => void;
  contextMenu: ContextMenuState;
  setContextMenu: (m: ContextMenuState) => void;
  duplicateActivity: (a: Activity) => void;
  createChild: (parentId: number) => void;
};

export function TimelineDialogs(props: TimelineDialogsProps) {
  const {
    id, teamMembers, holidays, holidayOpen, setHolidayOpen, newHDate, setNewHDate,
    newHName, setNewHName, addHoliday, removeHoliday, detailActivity, setDetailActivity,
    childrenByParent, createChildFromDetail, setActivities, deleteRow, importOpen,
    setImportOpen, projectPhase, load, jiraSyncOpen, setJiraSyncOpen, contextMenu,
    setContextMenu, duplicateActivity, createChild,
  } = props;

  return (
    <>
      <datalist id={`team-${id}`}>
        {teamMembers.map(m => <option key={m.id} value={m.name}>{m.role} — {m.domain}</option>)}
      </datalist>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[168px]"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 180) }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setDetailActivity(contextMenu.activity); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" /> View detail
          </button>
          <button
            onClick={() => { duplicateActivity(contextMenu.activity); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" /> Duplicate
          </button>
          {!contextMenu.activity.parent_id && (
            <button
              onClick={() => { createChild(contextMenu.activity.id); setContextMenu(null); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-slate-400" /> Create child
            </button>
          )}
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => { deleteRow(contextMenu.activity.id); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Holiday Dialog */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarX2 className="h-4 w-4 text-orange-500" /> Ngày nghỉ lễ dự án
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              Thứ 7 và Chủ nhật được tự động cảnh báo. Thêm các ngày nghỉ lễ khác bên dưới.
            </p>
            <div className="flex gap-2">
              <input type="date" className="h-8 text-xs border border-slate-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={newHDate} onChange={e => setNewHDate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHoliday()} />
              <input className="h-8 text-xs border border-slate-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Tên ngày nghỉ..." value={newHName} onChange={e => setNewHName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHoliday()} />
              <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 px-3" onClick={addHoliday} disabled={!newHDate}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {holidays.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có ngày nghỉ lễ nào được thêm</p>
              )}
              {holidays.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                  <div className="text-xs font-mono text-orange-700 shrink-0 tabular-nums">{h.date}</div>
                  <div className="text-xs text-slate-600 flex-1 truncate">{h.name || <span className="text-slate-400 italic">—</span>}</div>
                  <button onClick={() => removeHoliday(h.id)} className="text-slate-300 hover:text-red-500 shrink-0 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Detail Dialog (Jira-like) */}
      <Dialog open={!!detailActivity} onOpenChange={o => { if (!o) setDetailActivity(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-7xl p-0 gap-0 overflow-hidden" style={{ maxWidth: 'min(98vw, 1400px)', maxHeight: '94vh' }}>
          {detailActivity && (
            <ActivityDetail
              key={detailActivity.id}
              activity={detailActivity}
              teamMembers={teamMembers}
              projectId={id}
              childActivities={childrenByParent.get(detailActivity.id) ?? []}
              onCreateChild={(name) => createChildFromDetail(detailActivity.id, name)}
              onViewChild={(child) => setDetailActivity(child)}
              onSave={updated => {
                setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
                setDetailActivity(null);
              }}
              onDelete={rowId => { deleteRow(rowId); setDetailActivity(null); }}
              onClose={() => setDetailActivity(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ImportMappingDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={id}
        projectPhase={projectPhase}
        onImported={load}
      />
      <JiraSyncDialog
        open={jiraSyncOpen}
        onOpenChange={setJiraSyncOpen}
        projectId={id}
        mode="timeline"
        onSynced={load}
      />
    </>
  );
}
