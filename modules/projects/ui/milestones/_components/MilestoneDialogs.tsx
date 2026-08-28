'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Layers, Plus, Search,
} from 'lucide-react';
import { statusPct, weightedProgress } from '@/lib/status-weights';
import type { Activity, ActivityItem, Milestone, PickerPhase, TeamMember } from '../types';
import { ActivityDetail } from './ActivityDetail';
import { fmt, statusColor } from './helpers';

type EditForm = Omit<Milestone, 'id' | 'project_id' | 'created_at'>;

type MilestoneEditDialogProps = {
  open: boolean;
  editingId: number | null;
  editForm: EditForm;
  onOpenChange: (open: boolean) => void;
  onFormChange: (form: EditForm) => void;
  onSave: () => void;
};

export function MilestoneEditDialog({
  open, editingId, editForm, onOpenChange, onFormChange, onSave,
}: MilestoneEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Chỉnh sửa Milestone' : 'Tạo Milestone mới'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Tên Milestone <span className="text-red-500">*</span></Label>
            <Input
              value={editForm.name}
              onChange={e => onFormChange({ ...editForm, name: e.target.value })}
              placeholder="VD: Phase 1 Completion, MVP Release..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ngày bắt đầu</Label>
              <Input type="date" value={editForm.start_date ?? ''} onChange={e => onFormChange({ ...editForm, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ngày kết thúc</Label>
              <Input type="date" value={editForm.end_date ?? ''} onChange={e => onFormChange({ ...editForm, end_date: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={onSave} className="bg-orange-500 hover:bg-orange-600 text-white">
            {editingId ? 'Lưu thay đổi' : 'Tạo Milestone'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ActivityPickerDialogProps = {
  open: boolean;
  selected: Milestone | null;
  search: string;
  filteredPickerEntries: [string, PickerPhase][];
  allActivities: Activity[];
  pickerCollapsedPhases: Set<string>;
  pickerCollapsedEpics: Set<number>;
  matchesQ: (a: ActivityItem) => boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (q: string) => void;
  onPickerClick: (activity: ActivityItem) => void;
  onTogglePickerPhase: (phase: string) => void;
  onTogglePickerEpic: (epicId: number) => void;
  onPickerCollapseAll: (phases: string[], epicIds: number[]) => void;
  onPickerExpandAll: () => void;
};

export function ActivityPickerDialog({
  open, selected, search, filteredPickerEntries, allActivities,
  pickerCollapsedPhases, pickerCollapsedEpics, matchesQ,
  onOpenChange, onSearchChange, onPickerClick,
  onTogglePickerPhase, onTogglePickerEpic, onPickerCollapseAll, onPickerExpandAll,
}: ActivityPickerDialogProps) {
  const q = search.toLowerCase().trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              onChange={e => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          {filteredPickerEntries.length > 0 && (() => {
            const allPhases = filteredPickerEntries.map(([p]) => p);
            const allEpicIds = filteredPickerEntries.flatMap(([, g]) => g.epics.map(eg => eg.epic.id));
            const allCollapsed = allPhases.every(p => pickerCollapsedPhases.has(p));
            return allCollapsed ? (
              <Button variant="ghost" size="sm" onClick={onPickerExpandAll} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2 shrink-0">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand All
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onPickerCollapseAll(allPhases, allEpicIds)} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2 shrink-0">
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse All
              </Button>
            );
          })()}
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
                      onClick={() => onTogglePickerPhase(phase)}
                      className="w-full flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1 hover:text-orange-500 transition-colors"
                    >
                      {phaseCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {phase}
                    </button>
                    {!phaseCollapsed && (
                      <div className="space-y-2">
                        {group.epics
                          .filter(eg => !q || matchesQ(eg.epic) || eg.children.some(matchesQ))
                          .map(eg => {
                            const epicCollapsed = pickerCollapsedEpics.has(eg.epic.id);
                            const filteredChildren = eg.children.filter(c => !q || matchesQ(c));
                            return (
                              <div key={eg.epic.id}>
                                <div className="bg-orange-50 border border-orange-200 hover:border-orange-400 rounded-lg px-3 py-2.5 transition-colors flex items-center gap-2">
                                  {filteredChildren.length > 0 && (
                                    <button
                                      onClick={() => onTogglePickerEpic(eg.epic.id)}
                                      className="p-0.5 rounded text-orange-400 hover:text-orange-600 shrink-0"
                                    >
                                      {epicCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                  {filteredChildren.length === 0 && <Layers className="h-4 w-4 text-orange-500 shrink-0" />}
                                  <button onClick={() => onPickerClick(eg.epic)} className="flex-1 text-left min-w-0">
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
                                {filteredChildren.length > 0 && !epicCollapsed && (
                                  <div className="ml-5 mt-1 space-y-1 pl-4 border-l-2 border-orange-100">
                                    {filteredChildren.map(child => (
                                      <button
                                        key={child.id}
                                        onClick={() => onPickerClick(child)}
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
                        {group.orphanChildren.filter(c => !q || matchesQ(c)).map(c => {
                          const epicName = c.parent_id
                            ? allActivities.find(a => a.id === c.parent_id)?.activity ?? null
                            : null;
                          return (
                            <button
                              key={c.id}
                              onClick={() => onPickerClick(c)}
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
                        {group.standalone.filter(a => !q || matchesQ(a)).map(a => (
                          <button
                            key={a.id}
                            onClick={() => onPickerClick(a)}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ActivityDetailDialogProps = {
  detailActivity: Activity | null;
  teamMembers: TeamMember[];
  projectId: string;
  allActivities: Activity[];
  onClose: () => void;
  onSave: (updated: Activity) => void;
  onViewChild: (child: Activity) => void;
};

export function ActivityDetailDialog({
  detailActivity, teamMembers, projectId, allActivities, onClose, onSave, onViewChild,
}: ActivityDetailDialogProps) {
  return (
    <Dialog open={!!detailActivity} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="sm:max-w-7xl p-0 gap-0 overflow-hidden" style={{ maxWidth: 'min(98vw, 1400px)', maxHeight: '94vh' }}>
        {detailActivity && (
          <ActivityDetail
            key={detailActivity.id}
            activity={detailActivity}
            teamMembers={teamMembers}
            projectId={projectId}
            childActivities={allActivities.filter(a => a.parent_id === detailActivity.id)}
            onViewChild={onViewChild}
            onSave={onSave}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type EpicConfirmDialogProps = {
  open: boolean;
  pendingEpic: ActivityItem | null;
  pendingEpicNewChildrenCount: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EpicConfirmDialog({
  open, pendingEpic, pendingEpicNewChildrenCount, onOpenChange, onConfirm, onCancel,
}: EpicConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                {pendingEpicNewChildrenCount > 0
                  ? `${pendingEpicNewChildrenCount} child sẽ được thêm vào`
                  : 'Không có child nào'}
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>NO</Button>
          <Button onClick={onConfirm} className="bg-orange-500 hover:bg-orange-600 text-white">YES</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
