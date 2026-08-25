'use client';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Flag } from 'lucide-react';
import { statusPct } from '@/lib/status-weights';
import type { EpicDetailData, MilestoneItem, MilestoneRow } from '../types';
import { statusColor } from './EpicColours';
import { fmt } from './helpers';

export type MilestoneComputed = {
  childrenByParent: Record<number, MilestoneItem[]>;
  overallPct: number;
  byPhase: Record<string, MilestoneItem[]>;
  itemPct: (it: MilestoneItem) => number;
  count: number;
};

export type RoadmapMilestoneViewProps = {
  milestones: MilestoneRow[] | null;
  selectedMilestoneId: number | null;
  onSelectMilestone: (id: number | null) => void;
  selectedMilestone: MilestoneRow | null;
  ms: MilestoneComputed | null;
  collapsedMsEpics: Set<number>;
  onToggleMsEpic: (epicId: number) => void;
  onEpicDetail: (detail: EpicDetailData) => void;
};

export function RoadmapMilestoneView({
  milestones, selectedMilestoneId, onSelectMilestone,
  selectedMilestone, ms, collapsedMsEpics, onToggleMsEpic, onEpicDetail,
}: RoadmapMilestoneViewProps) {
  return (
    <>
      <div className="shrink-0 px-6 py-2.5 bg-slate-50 border-b flex items-center gap-3 flex-wrap">
        <Flag className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">Milestone:</span>
        <select
          value={selectedMilestoneId ?? ''}
          onChange={e => onSelectMilestone(e.target.value === '' ? null : +e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 min-w-[280px]"
        >
          <option value="">— Chọn milestone —</option>
          {(() => {
            if (!milestones) return null;
            const byProject: Record<string, MilestoneRow[]> = {};
            for (const m of milestones) (byProject[m.project_name] = byProject[m.project_name] ?? []).push(m);
            return Object.entries(byProject).map(([proj, list]) => (
              <optgroup key={proj} label={proj}>
                {list.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </optgroup>
            ));
          })()}
        </select>
        {milestones && milestones.length === 0 && (
          <span className="text-xs text-slate-400">Chưa có milestone nào. Tạo milestone trong từng project.</span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {!selectedMilestone ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
            <Flag className="h-12 w-12 text-slate-200" />
            <p className="text-sm">Chọn một milestone để xem Epic, child và tiến độ.</p>
          </div>
        ) : !ms ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Flag className="h-5 w-5 text-orange-500 shrink-0" />
                    {selectedMilestone.name}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    <Link href={`/projects/${selectedMilestone.project_id}/milestones`} className="text-blue-600 hover:underline">
                      {selectedMilestone.project_name}
                    </Link>
                    {selectedMilestone.program_name && <span className="text-slate-400"> · {selectedMilestone.program_name}</span>}
                    <span className="mx-2 text-slate-300">|</span>
                    {fmt(selectedMilestone.start_date)} → {fmt(selectedMilestone.end_date)}
                    <span className="ml-2 text-orange-600 font-medium">{ms.count} item</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${ms.overallPct}%` }} />
                  </div>
                  <span className="text-lg font-bold text-orange-600 tabular-nums shrink-0">{ms.overallPct}%</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">Tiến độ tổng = weighted theo trạng thái (EPIC không tính vào leaf).</p>
            </div>

            {ms.count === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-lg p-10 text-center text-slate-400">
                <p className="text-sm">Milestone này chưa có item nào.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(ms.byPhase).map(([phase, parents]) => (
                  <div key={phase}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">{phase}</p>
                    <div className="space-y-2">
                      {parents.map(parent => {
                        const kids = ms.childrenByParent[parent.id] ?? [];
                        const isEpic = parent.no === 'EPIC';
                        const collapsed = collapsedMsEpics.has(parent.id);
                        const pct = ms.itemPct(parent);
                        return (
                          <div key={parent.id}>
                            <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 transition-colors ${
                              isEpic ? 'bg-orange-50/50 border-orange-200 hover:border-orange-300' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}>
                              {isEpic && kids.length > 0 && (
                                <button
                                  onClick={() => onToggleMsEpic(parent.id)}
                                  className="p-0.5 rounded text-slate-400 hover:text-orange-500 transition-colors shrink-0"
                                >
                                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {isEpic && <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>}
                                  {parent.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{parent.jira_key}</span>}
                                  {parent.no && parent.no !== 'EPIC' && <span className="text-xs text-slate-400">#{parent.no}</span>}
                                  <span className="text-sm font-medium text-slate-800 truncate">{parent.activity}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                  <Badge className={`text-xs px-1.5 py-0 ${statusColor(parent.status)}`}>{parent.status}</Badge>
                                  <span className="text-xs text-slate-400">{pct}%</span>
                                  {(parent.plan_start || parent.plan_end) && (
                                    <span className="text-xs text-slate-400">{fmt(parent.plan_start)} → {fmt(parent.plan_end)}</span>
                                  )}
                                  {kids.length > 0 && <span className="text-xs text-orange-500">{kids.length} sub-item</span>}
                                </div>
                              </div>
                              <div className="w-20 shrink-0">
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                              {isEpic && (
                                <button
                                  onClick={() => onEpicDetail({
                                    projectName: selectedMilestone.project_name,
                                    epicActivity: parent.activity,
                                    jira_key: parent.jira_key || null,
                                    status: parent.status,
                                    children: kids.map(c => ({
                                      id: c.id, jira_key: c.jira_key || null, no: c.no, activity: c.activity,
                                      status: c.status, plan_start: c.plan_start, plan_end: c.plan_end,
                                    })),
                                  })}
                                  className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline shrink-0"
                                >
                                  Chi tiết
                                </button>
                              )}
                            </div>

                            {kids.length > 0 && !collapsed && (
                              <div className="ml-5 mt-1.5 space-y-1.5 pl-4 border-l-2 border-orange-100">
                                {kids.map(child => (
                                  <div key={child.id} className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {child.jira_key && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{child.jira_key}</span>}
                                        {child.no && child.no !== 'EPIC' && <span className="text-xs text-slate-400">{child.no}</span>}
                                        <span className="text-sm text-slate-700 truncate">{child.activity}</span>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        <Badge className={`text-xs px-1.5 py-0 ${statusColor(child.status)}`}>{child.status}</Badge>
                                        <span className="text-xs text-slate-400">{statusPct(child.status)}%</span>
                                        {(child.plan_start || child.plan_end) && (
                                          <span className="text-xs text-slate-400">{fmt(child.plan_start)} → {fmt(child.plan_end)}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="w-16 shrink-0">
                                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-300 rounded-full" style={{ width: `${statusPct(child.status)}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
