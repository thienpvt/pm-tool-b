'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import Sidebar from '@/components/layout/Sidebar';
import { statusPct, weightedProgress } from '@/lib/status-weights';
import type { EpicDetailData, MilestoneItem, ProgramGroup, ProjectRow } from './types';
import { useRoadmapPage } from './useRoadmapPage';
import { buildYearTimeline } from './_components/helpers';
import { projectInYear } from './_components/ProjectInYearCheck';
import { RoadmapToolbar } from './_components/RoadmapToolbar';
import { RoadmapGrid } from './_components/RoadmapGrid';
import { EpicDetailDialog } from './_components/EpicDetailDialog';

export default function RoadmapPage() {
  const [openSet, setOpenSet] = useState<Set<number>>(new Set());
  const [selectedYear, setYear] = useState(() => new Date().getFullYear());
  const [viewMonths, setViewMonths] = useState<[number, number]>([0, 11]);
  const [exporting, setExporting] = useState(false);
  const [filterProgram, setFilterProgram] = useState<number | null>(null);
  const [filterProject, setFilterProject] = useState<number | null>(null);
  const roadmapRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<'phase' | 'milestone'>('phase');
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [epicDetail, setEpicDetail] = useState<EpicDetailData | null>(null);

  const [selectedMilestoneId, setSelectedMilestoneId] = useState<number | null>(null);
  const [collapsedMsEpics, setCollapsedMsEpics] = useState<Set<number>>(new Set());

  const {
    data, loading, milestones, milestoneItems,
    selectedMilestone, epicsByProject, loadEpics,
  } = useRoadmapPage({ viewMode, selectedMilestoneId });

  useEffect(() => {
    if (data) {
      setOpenSet(new Set([...data.programs.map((c: ProgramGroup) => c.id), 0]));
    }
  }, [data]);

  useEffect(() => {
    if (selectedMilestone) setCollapsedMsEpics(new Set());
  }, [selectedMilestone]);

  const togglePhaseExpand = useCallback((projectId: number, phase: string) => {
    const key = `${projectId}:${phase}`;
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    loadEpics(projectId);
  }, [loadEpics]);

  const availableYears = useMemo(() => {
    const cur = new Date().getFullYear();
    let minY = cur - 1;
    let maxY = cur + 2;

    if (data) {
      const all = [...data.programs.flatMap((c: ProgramGroup) => c.projects), ...data.noProgramProjects];
      for (const p of all) {
        const toY = (s: string) => new Date(s + 'T00:00:00').getFullYear();
        if (p.start_date) { minY = Math.min(minY, toY(p.start_date) - 1); maxY = Math.max(maxY, toY(p.start_date) + 1); }
        if (p.end_date)   { minY = Math.min(minY, toY(p.end_date)   - 1); maxY = Math.max(maxY, toY(p.end_date)   + 1); }
        for (const ph of p.phases) {
          if (ph.start_date) { minY = Math.min(minY, toY(ph.start_date) - 1); maxY = Math.max(maxY, toY(ph.start_date) + 1); }
          if (ph.end_date)   { minY = Math.min(minY, toY(ph.end_date)   - 1); maxY = Math.max(maxY, toY(ph.end_date)   + 1); }
        }
      }
    }

    const years: number[] = [];
    for (let y = minY; y <= maxY; y++) years.push(y);
    return years;
  }, [data]);

  const tl = useMemo(() => buildYearTimeline(selectedYear, viewMonths[0], viewMonths[1]), [selectedYear, viewMonths]);

  const rawPct = useCallback((dateStr: string, eod = false) => {
    const ms = new Date(dateStr + (eod ? 'T23:59:59' : 'T00:00:00')).getTime();
    return (ms - tl.rStart.getTime()) / tl.totalMs * 100;
  }, [tl]);

  const availableProjects = useMemo((): ProjectRow[] => {
    if (!data) return [];
    if (filterProgram === null) {
      return [
        ...data.programs.flatMap((p: ProgramGroup) => p.projects),
        ...data.noProgramProjects,
      ].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (filterProgram === 0) {
      return [...data.noProgramProjects].sort((a, b) => a.name.localeCompare(b.name));
    }
    const prog = data.programs.find((p: ProgramGroup) => p.id === filterProgram);
    return (prog?.projects ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [data, filterProgram]);

  const groups = useMemo((): ProgramGroup[] => {
    if (!data) return [];
    const yearFilter = (ps: ProjectRow[]) =>
      ps.filter(p => filterProject === p.id ? true : projectInYear(p, selectedYear));

    let result: ProgramGroup[] = [
      ...data.programs
        .map((c: ProgramGroup) => ({ ...c, projects: yearFilter(c.projects) }))
        .filter((c: ProgramGroup) => c.projects.length > 0),
      ...((() => {
        const ps = yearFilter(data.noProgramProjects);
        return ps.length ? [{ id: 0, name: 'Unassigned', industry: '', projects: ps }] : [];
      })()),
    ];

    if (filterProgram !== null) {
      result = result.filter(g => g.id === filterProgram);
    }
    if (filterProject !== null) {
      result = result
        .map(g => ({ ...g, projects: g.projects.filter((p: ProjectRow) => p.id === filterProject) }))
        .filter(g => g.projects.length > 0);
    }

    return result;
  }, [data, selectedYear, filterProgram, filterProject]);

  const setYearAndReset = useCallback((y: number) => {
    setYear(y);
    setViewMonths([0, 11]);
  }, []);

  const toggleProgram = useCallback((id: number) => {
    setOpenSet(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleExportPng = useCallback(async () => {
    if (!roadmapRef.current) return;
    setExporting(true);
    try {
      const el = roadmapRef.current;
      const dataUrl = await toPng(el, {
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: { overflow: 'visible' },
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.download = `portfolio-roadmap-${selectedYear}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('PNG export failed', err);
    } finally {
      setExporting(false);
    }
  }, [selectedYear]);

  const ms = useMemo(() => {
    if (!milestoneItems) return null;
    const inIds = new Set(milestoneItems.map(i => i.id));
    const childrenByParent: Record<number, MilestoneItem[]> = {};
    for (const it of milestoneItems) {
      if (it.parent_id && inIds.has(it.parent_id)) {
        (childrenByParent[it.parent_id] = childrenByParent[it.parent_id] ?? []).push(it);
      }
    }
    const leaves = milestoneItems.filter(i => i.no !== 'EPIC');
    const overallPct = weightedProgress(leaves.map(i => i.status));
    const topLevel = milestoneItems.filter(i => !i.parent_id || !inIds.has(i.parent_id));
    const byPhase: Record<string, MilestoneItem[]> = {};
    for (const it of topLevel) (byPhase[it.phase] = byPhase[it.phase] ?? []).push(it);
    const itemPct = (it: MilestoneItem): number => {
      if (it.no === 'EPIC') {
        const kids = childrenByParent[it.id] ?? [];
        return kids.length > 0 ? weightedProgress(kids.map(k => k.status)) : statusPct(it.status);
      }
      return statusPct(it.status);
    };
    return { childrenByParent, overallPct, byPhase, itemPct, count: milestoneItems.length };
  }, [milestoneItems]);

  const toggleMsEpic = useCallback((epicId: number) => {
    setCollapsedMsEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId); else next.add(epicId);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading roadmap…</p>
          </div>
        </main>
      </div>
    );
  }

  const totalProjects = groups.reduce((s, g) => s + g.projects.length, 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <RoadmapToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          totalProjects={totalProjects}
          selectedYear={selectedYear}
          availableYears={availableYears}
          onYearChange={setYearAndReset}
          viewMonths={viewMonths}
          onViewMonthsChange={setViewMonths}
          monthCount={tl.months.length}
          data={data}
          filterProgram={filterProgram}
          filterProject={filterProject}
          onFilterProgramChange={setFilterProgram}
          onFilterProjectChange={setFilterProject}
          availableProjects={availableProjects}
          exporting={exporting}
          onExportPng={handleExportPng}
        />

        <RoadmapGrid
          viewMode={viewMode}
          groups={groups}
          tl={tl}
          selectedYear={selectedYear}
          openSet={openSet}
          expandedPhases={expandedPhases}
          epicsByProject={epicsByProject}
          roadmapRef={roadmapRef}
          rawPct={rawPct}
          onToggleProgram={toggleProgram}
          onTogglePhaseExpand={togglePhaseExpand}
          onEpicDetail={setEpicDetail}
          milestones={milestones}
          selectedMilestoneId={selectedMilestoneId}
          onSelectMilestone={setSelectedMilestoneId}
          selectedMilestone={selectedMilestone}
          ms={ms}
          collapsedMsEpics={collapsedMsEpics}
          onToggleMsEpic={toggleMsEpic}
        />
      </main>

      <EpicDetailDialog epicDetail={epicDetail} onClose={() => setEpicDetail(null)} />
    </div>
  );
}
