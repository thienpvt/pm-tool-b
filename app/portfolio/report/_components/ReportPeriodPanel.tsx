'use client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CalendarRange, ChevronDown, CheckCircle2, Building2, Calendar } from 'lucide-react';
import type { PortfolioReportData, PortfolioMilestone } from '../types';
import { fmtDateShort } from './helpers';

export type ReportPeriodPanelProps = {
  data: PortfolioReportData | null;
  loading: boolean;
  reportMode: 'daterange' | 'milestone';
  setReportMode: (m: 'daterange' | 'milestone') => void;
  selectedMilestoneIds: Set<number>;
  setSelectedMilestoneIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  showMilestoneSelector: boolean;
  setShowMilestoneSelector: React.Dispatch<React.SetStateAction<boolean>>;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  loadData: () => void;
};

export function ReportPeriodPanel(props: ReportPeriodPanelProps) {
  const {
    data, loading, reportMode, setReportMode, selectedMilestoneIds, setSelectedMilestoneIds,
    showMilestoneSelector, setShowMilestoneSelector, periodStart, setPeriodStart, periodEnd, setPeriodEnd, loadData,
  } = props;

  return (
    <div className="bg-white border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <CalendarRange className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-600">Reporting Period:</span>
        <div className="flex items-center rounded-lg border overflow-hidden text-xs">
          <button
            className={`px-3 py-1.5 transition-colors ${reportMode === 'daterange' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setReportMode('daterange')}
          >
            Khoảng thời gian
          </button>
          <button
            className={`px-3 py-1.5 transition-colors ${reportMode === 'milestone' ? 'bg-blue-600 text-white font-semibold' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setReportMode('milestone')}
          >
            Milestone
          </button>
        </div>

        {reportMode === 'daterange' ? (
          <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5">
            <label className="text-xs text-slate-400">From</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="text-sm border-none outline-none bg-transparent" />
            <span className="text-xs text-slate-300">→</span>
            <label className="text-xs text-slate-400">To</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="text-sm border-none outline-none bg-transparent" />
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setShowMilestoneSelector(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors min-w-[180px]"
            >
              <span className="text-slate-600">
                {selectedMilestoneIds.size === 0 ? 'Chọn Milestone' : `${selectedMilestoneIds.size} milestone đã chọn`}
              </span>
              {selectedMilestoneIds.size > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-200">
                  {selectedMilestoneIds.size}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 ml-auto transition-transform ${showMilestoneSelector ? 'rotate-180' : ''}`} />
            </button>
            {showMilestoneSelector && (
              <div className="absolute z-50 top-full mt-1 left-0 w-80 bg-white border rounded-xl shadow-lg p-3 space-y-2">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <button onClick={() => setSelectedMilestoneIds(new Set((data?.portfolioMilestones ?? []).map(m => m.id)))} className="text-xs text-blue-600 hover:underline font-medium">Chọn tất cả</button>
                  <span className="text-slate-200">|</span>
                  <button onClick={() => setSelectedMilestoneIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">Bỏ chọn tất cả</button>
                  <button onClick={() => setShowMilestoneSelector(false)} className="ml-auto text-xs text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {(data?.portfolioMilestones ?? []).length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">Không có milestone nào</p>
                  )}
                  {Object.entries(
                    (data?.portfolioMilestones ?? []).reduce<Record<string, PortfolioMilestone[]>>((acc, ms) => {
                      const key = ms.project_name + (ms.program_name ? ` [${ms.program_name}]` : '');
                      (acc[key] ??= []).push(ms);
                      return acc;
                    }, {})
                  ).map(([projectLabel, milestones]) => (
                    <div key={projectLabel}>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1 pt-1">{projectLabel}</div>
                      {milestones.map(ms => {
                        const checked = selectedMilestoneIds.has(ms.id);
                        return (
                          <label key={ms.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-xs ${checked ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50 border border-transparent'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setSelectedMilestoneIds(prev => {
                                  const next = new Set(prev);
                                  e.target.checked ? next.add(ms.id) : next.delete(ms.id);
                                  return next;
                                });
                              }}
                              className="mt-0.5 w-3.5 h-3.5 rounded accent-violet-600 shrink-0"
                            />
                            <span className="flex-1">
                              <span className={`font-medium ${checked ? 'text-violet-800' : 'text-slate-700'}`}>{ms.name}</span>
                              {(ms.start_date || ms.end_date) && (
                                <span className="block text-[10px] text-slate-400 mt-0.5">{ms.start_date} → {ms.end_date}</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={loadData} variant="outline" className="h-8 gap-1.5 text-xs" disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </Button>
        <span className="text-xs text-slate-400 ml-auto">
          {data ? `${Object.values(data.completedByProject).reduce((s, g) => s + g.activities.length, 0)} activities completed in period` : ''}
        </span>
      </div>

      {data?.milestoneInfo && data.milestoneInfo.length > 0 && (
        <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-200 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-violet-700">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{data.milestoneInfo.length} milestone đã chọn</span>
            <span className="ml-auto text-violet-500">{data.periodStart} → {data.periodEnd}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.milestoneInfo.map(ms => (
              <span key={ms.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 border border-violet-200 text-violet-700">
                <span className="font-medium">{ms.name}</span>
                <span className="text-violet-400">·</span>
                <span>{ms.project_name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {data && Object.keys(data.completedByProject).length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-800 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-bold text-white">
              II. Completed in Period — {fmtDateShort(data.periodStart || periodStart)} → {fmtDateShort(data.periodEnd || periodEnd)}
            </span>
            <Badge className="ml-auto bg-green-600 text-white border-0 text-[10px]">
              {Object.values(data.completedByProject).reduce((s, g) => s + g.activities.length, 0)} items
            </Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {Object.values(data.completedByProject).map((group, i) => (
              <div key={i} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-700">{group.project_name}</span>
                  {group.program_name && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Building2 className="h-3 w-3" />{group.program_name}
                    </span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 ml-auto">{group.current_phase}</span>
                </div>
                <ul className="space-y-1">
                  {group.activities.map(a => (
                    <li key={a.id} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700">{a.activity}</span>
                      {a.deliverable && <span className="text-slate-400">→ {a.deliverable}</span>}
                      {a.actual_end && <span className="text-slate-300 ml-auto shrink-0">{a.actual_end}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {data && Object.keys(data.completedByProject).length === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-lg text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5" />
          No completed activities in {fmtDateShort(data.periodStart || periodStart)} → {fmtDateShort(data.periodEnd || periodEnd)}
        </div>
      )}
    </div>
  );
}
