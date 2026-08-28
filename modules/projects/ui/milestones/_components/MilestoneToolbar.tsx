'use client';
import { ChevronsDownUp, ChevronsUpDown, FileDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActivityItem, Milestone } from '../types';
import { fmt } from './helpers';

type Props = {
  selected: Milestone;
  milestoneItems: ActivityItem[];
  milestonePct: number;
  milestoneLeavesCount: number;
  topLevelItems: ActivityItem[];
  childrenByParent: Record<number, ActivityItem[]>;
  collapsedEpics: Set<number>;
  onExpandAll: () => void;
  onCollapseAll: (epicIds: number[]) => void;
  onExportPDF: () => void;
  onOpenPicker: () => void;
};

export function MilestoneToolbar({
  selected,
  milestoneItems,
  milestonePct,
  milestoneLeavesCount,
  topLevelItems,
  childrenByParent,
  collapsedEpics,
  onExpandAll,
  onCollapseAll,
  onExportPDF,
  onOpenPicker,
}: Props) {
  const epicIds = topLevelItems
    .filter(i => i.no === 'EPIC' && (childrenByParent[i.id]?.length ?? 0) > 0)
    .map(i => i.id);
  const allCollapsed = epicIds.length > 0 && epicIds.every(eid => collapsedEpics.has(eid));

  return (
    <div className="flex items-center justify-between mb-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold text-slate-800">{selected.name}</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          {fmt(selected.start_date)} → {fmt(selected.end_date)}
          <span className="ml-3 text-orange-600 font-medium">{milestoneItems.length} item</span>
        </p>
        {milestoneLeavesCount > 0 && (
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
        {epicIds.length > 0 && (
          allCollapsed ? (
            <Button variant="ghost" size="sm" onClick={onExpandAll} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2">
              <ChevronsUpDown className="h-3.5 w-3.5" />
              Expand All
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onCollapseAll(epicIds)} className="gap-1.5 text-slate-500 hover:text-slate-700 text-xs px-2">
              <ChevronsDownUp className="h-3.5 w-3.5" />
              Collapse All
            </Button>
          )
        )}
        <Button onClick={onExportPDF} variant="outline" className="gap-1.5 border-slate-300 text-slate-600 hover:bg-slate-50">
          <FileDown className="h-4 w-4" />
          Export PDF
        </Button>
        <Button onClick={onOpenPicker} variant="outline" className="gap-1.5 border-orange-300 text-orange-600 hover:bg-orange-50">
          <Plus className="h-4 w-4" />
          Thêm
        </Button>
      </div>
    </div>
  );
}
