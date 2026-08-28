'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Download, Upload, FileDown, AlertCircle, GanttChart, LayoutList,
  CalendarX2, ChevronsUpDown, RefreshCw, Filter, ChevronDown, Tag,
} from 'lucide-react';
import type { Activity, Project, DateMode } from '../types';
import { PROJECT_STATUS_COLOR, STATUS_COLOR } from '../types';
import { MO_SHORT } from './RoadmapHelpers';

export type TimelineToolbarProps = {
  project: Project | null;
  overdueCount: number;
  viewMode: 'table' | 'roadmap';
  setViewMode: (m: 'table' | 'roadmap') => void;
  filterPhase: string;
  setFilterPhase: (p: string) => void;
  setFilterStatuses: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  allPhases: string[];
  activities: Activity[];
  filterStatuses: Set<string>;
  statusFilterOpen: boolean;
  setStatusFilterOpen: (v: boolean | ((o: boolean) => boolean)) => void;
  statusFilterRef: React.RefObject<HTMLDivElement | null>;
  availableStatuses: string[];
  setJiraSyncOpen: (v: boolean) => void;
  phaseGroups: { phase: string; acts: Activity[] }[];
  allTableCollapsed: boolean;
  setCollapsedTablePhases: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  parentActivityIds: number[];
  allParentsCollapsed: boolean;
  setCollapsedParents: (s: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  handleDownloadTemplate: () => void;
  setImportOpen: (v: boolean) => void;
  handleExport: () => void;
  dateMode: DateMode;
  setDateMode: (m: DateMode) => void;
  allCollapsed: boolean;
  setCollapsedPhases: (s: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  roadmapYear: number | null;
  setRoadmapYear: (y: number | null) => void;
  dataYears: number[];
  roadmapPeriod: string;
  setRoadmapPeriod: (p: string) => void;
  handleExportPng: () => void;
  holidays: { id: number }[];
  setHolidayOpen: (v: boolean) => void;
  addActivity: () => void;
};

export function TimelineToolbar(props: TimelineToolbarProps) {
  const {
    project, overdueCount, viewMode, setViewMode, filterPhase, setFilterPhase, setFilterStatuses,
    allPhases, activities, filterStatuses, statusFilterOpen, setStatusFilterOpen, statusFilterRef,
    availableStatuses, setJiraSyncOpen, phaseGroups, allTableCollapsed, setCollapsedTablePhases,
    parentActivityIds, allParentsCollapsed, setCollapsedParents, handleDownloadTemplate,
    setImportOpen, handleExport, dateMode, setDateMode, allCollapsed, setCollapsedPhases,
    roadmapYear, setRoadmapYear, dataYears, roadmapPeriod, setRoadmapPeriod, handleExportPng,
    holidays, setHolidayOpen, addActivity,
  } = props;

  return (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">Project Timeline</h1>
            {project?.status && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${PROJECT_STATUS_COLOR[project.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {project.status}
              </span>
            )}
            {project?.current_phase && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                <Tag className="h-3 w-3 text-slate-400" />
                Current: {project.current_phase}
              </span>
            )}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> {overdueCount} overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <LayoutList className="h-3.5 w-3.5" /> Table
              </button>
              <button onClick={() => setViewMode('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'roadmap' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <GanttChart className="h-3.5 w-3.5" /> Roadmap
              </button>
            </div>

            <Select value={filterPhase} onValueChange={v => { setFilterPhase(v ?? 'All'); setFilterStatuses(new Set()); }}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Phases</SelectItem>
                {allPhases.filter(p => activities.some(a => a.phase === p)).map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Multi-select status filter */}
            <div className="relative" ref={statusFilterRef}>
              <button
                onClick={() => setStatusFilterOpen(o => !o)}
                className={`flex items-center gap-1.5 h-9 px-3 text-xs font-medium border rounded-lg transition-colors
                  ${filterStatuses.size > 0
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                <Filter className="h-3.5 w-3.5" />
                {filterStatuses.size > 0 ? `Status (${filterStatuses.size})` : 'Status'}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {statusFilterOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-2 min-w-[200px]">
                  <div className="flex items-center justify-between px-3 pb-2 border-b border-slate-100 mb-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Filter by Status</span>
                    {filterStatuses.size > 0 && (
                      <button
                        onClick={() => setFilterStatuses(new Set())}
                        className="text-[10px] text-blue-600 hover:underline font-medium"
                      >Clear all</button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {availableStatuses.length === 0
                      ? <p className="text-xs text-slate-400 text-center py-4 px-3">No statuses in current view</p>
                      : availableStatuses.map(s => (
                        <label key={s} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={filterStatuses.has(s)}
                            onChange={() => setFilterStatuses(prev => {
                              const next = new Set(prev);
                              if (next.has(s)) next.delete(s); else next.add(s);
                              return next;
                            })}
                            className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
                          />
                          <span className={`text-[11px] px-1.5 py-px rounded font-semibold ${STATUS_COLOR[s] ?? 'bg-slate-100 text-slate-500'}`}>{s}</span>
                        </label>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => setJiraSyncOpen(true)} className="gap-1.5 h-9">
              <RefreshCw className="h-3.5 w-3.5" /> Sync Jira
            </Button>

            {viewMode === 'table' && <>
              {phaseGroups.length > 1 && filterPhase === 'All' && (
                <button
                  onClick={() => setCollapsedTablePhases(allTableCollapsed ? new Set() : new Set(phaseGroups.map(g => g.phase)))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {allTableCollapsed ? 'Expand Phases' : 'Collapse Phases'}
                </button>
              )}
              {parentActivityIds.length > 0 && (
                <button
                  onClick={() => setCollapsedParents(allParentsCollapsed ? new Set() : new Set(parentActivityIds))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {allParentsCollapsed ? 'Expand Epics' : 'Collapse Epics'}
                </button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 h-9">
                <FileDown className="h-3.5 w-3.5" /> Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5 h-9">
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 h-9">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </>}

            {viewMode === 'roadmap' && <>
              {/* Plan/Actual/Both */}
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                {([
                  { key: 'plan',   label: 'Plan',   active: 'bg-blue-600 text-white shadow-sm' },
                  { key: 'actual', label: 'Actual', active: 'bg-slate-700 text-white shadow-sm' },
                  { key: 'both',   label: 'Both',   active: 'bg-white text-slate-800 shadow-sm' },
                ] as { key: DateMode; label: string; active: string }[]).map(({ key, label, active }) => (
                  <button key={key} onClick={() => setDateMode(key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${dateMode === key ? active : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCollapsedPhases(allCollapsed ? new Set() : new Set(phaseGroups.map(g => g.phase)))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>

              <Select
                value={roadmapYear === null ? 'auto' : String(roadmapYear)}
                onValueChange={v => { setRoadmapYear(v === 'auto' ? null : Number(v)); if (v === 'auto') setRoadmapPeriod('all'); }}
              >
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto Range</SelectItem>
                  {dataYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>

              {roadmapYear !== null && (
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                  {(['all', 'q1', 'q2', 'q3', 'q4'] as const).map(key => (
                    <button key={key} onClick={() => setRoadmapPeriod(key)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${roadmapPeriod === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {key === 'all' ? 'Year' : key.toUpperCase()}
                    </button>
                  ))}
                  <Select
                    value={roadmapPeriod.startsWith('m') ? roadmapPeriod : ''}
                    onValueChange={v => v && setRoadmapPeriod(v)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-2 w-[72px] focus:ring-0">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MO_SHORT.map((m, i) => <SelectItem key={i} value={`m${i}`}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleExportPng} className="gap-1.5 h-9 border-violet-200 text-violet-700 hover:bg-violet-50">
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </>}

            <Button
              variant="outline" size="sm"
              onClick={() => setHolidayOpen(true)}
              className={`gap-1.5 h-9 ${holidays.length ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
            >
              <CalendarX2 className="h-3.5 w-3.5" />
              Holidays{holidays.length > 0 ? ` (${holidays.length})` : ''}
            </Button>

            <Button onClick={addActivity} className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
              <Plus className="h-4 w-4" /> Add Activity
            </Button>
          </div>
        </div>
  );
}
