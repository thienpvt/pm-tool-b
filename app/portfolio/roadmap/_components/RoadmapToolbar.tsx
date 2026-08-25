'use client';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download, Filter, Flag, Map, X } from 'lucide-react';
import type { ProgramGroup, ProjectRow, RoadmapData } from '../types';
import { MONTH_NAMES } from './helpers';
import { QUICK_VIEWS } from './QuickViewPresets';

export type RoadmapToolbarProps = {
  viewMode: 'phase' | 'milestone';
  onViewModeChange: (mode: 'phase' | 'milestone') => void;
  totalProjects: number;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (y: number) => void;
  viewMonths: [number, number];
  onViewMonthsChange: (v: [number, number]) => void;
  monthCount: number;
  data: RoadmapData | null;
  filterProgram: number | null;
  filterProject: number | null;
  onFilterProgramChange: (v: number | null) => void;
  onFilterProjectChange: (v: number | null) => void;
  availableProjects: ProjectRow[];
  exporting: boolean;
  onExportPng: () => void;
};

export function RoadmapToolbar({
  viewMode, onViewModeChange, totalProjects,
  selectedYear, availableYears, onYearChange,
  viewMonths, onViewMonthsChange, monthCount,
  data, filterProgram, filterProject,
  onFilterProgramChange, onFilterProjectChange, availableProjects,
  exporting, onExportPng,
}: RoadmapToolbarProps) {
  const curYearIdx = availableYears.indexOf(selectedYear);

  return (
    <>
      <div className="shrink-0 px-6 py-3 bg-white border-b flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Map className="h-5 w-5 text-blue-500" />
            Portfolio Roadmap
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {viewMode === 'phase'
              ? <>{totalProjects} project{totalProjects !== 1 ? 's' : ''} · phase bars from activity dates</>
              : <>Xem theo milestone · tiến độ weighted theo trạng thái</>}
          </p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => onViewModeChange('phase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              viewMode === 'phase' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Map className="h-3.5 w-3.5" /> Theo Phase
          </button>
          <button
            onClick={() => onViewModeChange('milestone')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              viewMode === 'milestone' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Flag className="h-3.5 w-3.5" /> Theo Milestone
          </button>
        </div>

        {viewMode === 'phase' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => curYearIdx > 0 && onYearChange(availableYears[curYearIdx - 1])}
              disabled={curYearIdx <= 0}
              className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {availableYears.map(y => (
                <button
                  key={y}
                  onClick={() => onYearChange(y)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    y === selectedYear ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
            <button
              onClick={() => curYearIdx < availableYears.length - 1 && onYearChange(availableYears[curYearIdx + 1])}
              disabled={curYearIdx >= availableYears.length - 1}
              className="p-1.5 rounded-lg border hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'phase' && (
            <button
              onClick={onExportPng}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting…' : 'Export PNG'}
            </button>
          )}
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
        </div>
      </div>

      {viewMode === 'phase' && (
        <div className="shrink-0 px-6 py-2 bg-slate-50 border-b flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">View:</span>
          <div className="flex items-center gap-1">
            {QUICK_VIEWS.map(opt => {
              const active = viewMonths[0] === opt.v[0] && viewMonths[1] === opt.v[1];
              return (
                <button
                  key={opt.label}
                  onClick={() => onViewMonthsChange(opt.v)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    active ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 shrink-0">From</span>
            <select
              value={viewMonths[0]}
              onChange={e => {
                const s = +e.target.value;
                onViewMonthsChange([s, Math.max(s, viewMonths[1])]);
              }}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <span className="text-slate-400 text-xs">→</span>
            <select
              value={viewMonths[1]}
              onChange={e => {
                const e2 = +e.target.value;
                onViewMonthsChange([Math.min(viewMonths[0], e2), e2]);
              }}
              className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <span className="text-[11px] text-slate-400 ml-1">{monthCount} month{monthCount !== 1 ? 's' : ''} shown</span>
          <span className="text-slate-300">|</span>
          <Filter className="h-3 w-3 text-slate-400 shrink-0" />
          <select
            value={filterProgram ?? ''}
            onChange={e => {
              const val = e.target.value === '' ? null : +e.target.value;
              onFilterProgramChange(val);
              onFilterProjectChange(null);
            }}
            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Tất cả Program</option>
            {data?.programs.map((p: ProgramGroup) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {data?.noProgramProjects.length ? <option value={0}>Unassigned</option> : null}
          </select>
          <select
            value={filterProject ?? ''}
            onChange={e => onFilterProjectChange(e.target.value === '' ? null : +e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-1.5 py-1 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="">Tất cả Project</option>
            {availableProjects.map((p: ProjectRow) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {(filterProgram !== null || filterProject !== null) && (
            <button
              onClick={() => { onFilterProgramChange(null); onFilterProjectChange(null); }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <X className="h-3 w-3" />
              Xóa filter
            </button>
          )}
        </div>
      )}
    </>
  );
}
