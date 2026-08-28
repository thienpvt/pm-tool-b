'use client';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Flag, X } from 'lucide-react';
import type { ActivityItem, Milestone } from '../types';
import { fmt, statusColor } from './helpers';

type Props = {
  selected: Milestone | null;
  displayByPhase: Record<string, ActivityItem[]>;
  childrenByParent: Record<number, ActivityItem[]>;
  collapsedEpics: Set<number>;
  itemPct: (item: ActivityItem) => number;
  onOpenDetail: (item: ActivityItem) => void;
  onRemoveItem: (activityId: number) => void;
  onToggleEpic: (epicId: number) => void;
};

export function MilestoneTree({
  selected,
  displayByPhase,
  childrenByParent,
  collapsedEpics,
  itemPct,
  onOpenDetail,
  onRemoveItem,
  onToggleEpic,
}: Props) {
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <Flag className="h-12 w-12 mb-3 text-slate-200" />
        <p className="text-sm">Chọn một milestone để xem và quản lý</p>
      </div>
    );
  }

  const milestoneItems = Object.values(displayByPhase).flat();
  if (milestoneItems.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-400">
        <p className="text-sm">Milestone này chưa có item nào.</p>
        <p className="text-xs mt-1">Nhấn &quot;Thêm&quot; để gán activity vào milestone.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(displayByPhase).map(([phase, parents]) => (
        <div key={phase}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{phase}</p>
          <div className="space-y-2">
            {parents.map(parent => (
              <div key={parent.id}>
                <div
                  onClick={() => onOpenDetail(parent)}
                  className={`rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    parent.no === 'EPIC'
                      ? 'bg-orange-50/50 border-orange-200 hover:border-orange-400 hover:bg-orange-50'
                      : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                  }`}>
                  {parent.no === 'EPIC' && (childrenByParent[parent.id]?.length ?? 0) > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); onToggleEpic(parent.id); }}
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
                    onClick={e => { e.stopPropagation(); onRemoveItem(parent.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                    title="Xóa khỏi milestone"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {(childrenByParent[parent.id] ?? []).length > 0 && !collapsedEpics.has(parent.id) && (
                  <div className="ml-5 mt-1.5 space-y-1.5 pl-4 border-l-2 border-orange-100">
                    {(childrenByParent[parent.id] ?? []).map(child => (
                      <div key={child.id} onClick={() => onOpenDetail(child)} className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-3 hover:border-slate-400 hover:bg-slate-50 transition-colors cursor-pointer">
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
                          onClick={e => { e.stopPropagation(); onRemoveItem(child.id); }}
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
  );
}
