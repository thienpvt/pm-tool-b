'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import type { Activity, DateMode, ContextMenuState } from './types';
import { useTimelinePage } from './useTimelinePage';
import { useTimelineActions } from './useTimelineActions';
import {
  usePhaseGroups, useTablePagination, useChildrenMap, useParentActivityIds, useDataYears,
} from './_components/PhaseGroups';
import { RoadmapView } from './_components/RoadmapView';
import { TimelineToolbar } from './_components/TimelineToolbar';
import { TimelineTable } from './_components/TimelineTable';
import { TimelineDialogs } from './_components/TimelineDialogs';

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const {
    activities, setActivities, teamMembers, project, holidays, setHolidays, load,
  } = useTimelinePage(id);

  const [filterPhase, setFilterPhase] = useState('All');
  const [saving, setSaving] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [jiraSyncOpen, setJiraSyncOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'roadmap'>('table');
  const [dateMode, setDateMode] = useState<DateMode>('both');
  const roadmapRef = useRef<HTMLDivElement>(null);
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [roadmapYear, setRoadmapYear] = useState<number | null>(null);
  const [roadmapPeriod, setRoadmapPeriod] = useState<string>('all');
  const [collapsedTablePhases, setCollapsedTablePhases] = useState<Set<string>>(new Set());
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(30);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [newHDate, setNewHDate] = useState('');
  const [newHName, setNewHName] = useState('');
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!statusFilterOpen) return;
    const handler = (e: MouseEvent) => {
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node))
        setStatusFilterOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusFilterOpen]);

  const { filteredActivities, availableStatuses, phaseGroups, allPhases, overdueCount } =
    usePhaseGroups(activities, filterPhase, filterStatuses);
  const { totalTableRows, totalTablePages, pagedParentIds } =
    useTablePagination(phaseGroups, collapsedTablePhases, currentPage, rowsPerPage);
  const childrenByParent = useChildrenMap(activities);
  const parentActivityIds = useParentActivityIds(activities);
  const dataYears = useDataYears(activities);

  const actions = useTimelineActions(
    id, activities, setActivities, project, holidays, setHolidays,
    filteredActivities, setCollapsedParents, roadmapRef,
  );

  const togglePhase = useCallback((phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  }, []);

  const toggleTablePhase = useCallback((phase: string) => {
    setCollapsedTablePhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
    setCurrentPage(1);
  }, []);

  const toggleParent = useCallback((parentId: number) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }, []);

  const allCollapsed = collapsedPhases.size === phaseGroups.length && phaseGroups.length > 0;
  const allTableCollapsed = collapsedTablePhases.size === phaseGroups.length && phaseGroups.length > 0;
  const allParentsCollapsed = parentActivityIds.length > 0 && parentActivityIds.every(pid => collapsedParents.has(pid));

  const initializedRef = useRef(false);
  useEffect(() => {
    if (activities.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setCollapsedTablePhases(new Set(phaseGroups.map(g => g.phase)));
      setCollapsedParents(new Set(parentActivityIds));
    }
  }, [activities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCurrentPage(1); }, [filterPhase, filterStatuses, rowsPerPage]);

  const saveRowWithSaving = async (row: Activity) => {
    setSaving(row.id);
    await actions.saveRow(row);
    setSaving(null);
  };

  const addActivityWithEdit = async () => {
    const rowId = await actions.addActivity();
    setEditingActivityId(rowId);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        <TimelineToolbar
          project={project}
          overdueCount={overdueCount}
          viewMode={viewMode}
          setViewMode={setViewMode}
          filterPhase={filterPhase}
          setFilterPhase={setFilterPhase}
          setFilterStatuses={setFilterStatuses}
          allPhases={allPhases}
          activities={activities}
          filterStatuses={filterStatuses}
          statusFilterOpen={statusFilterOpen}
          setStatusFilterOpen={setStatusFilterOpen}
          statusFilterRef={statusFilterRef}
          availableStatuses={availableStatuses}
          setJiraSyncOpen={setJiraSyncOpen}
          phaseGroups={phaseGroups}
          allTableCollapsed={allTableCollapsed}
          setCollapsedTablePhases={setCollapsedTablePhases}
          parentActivityIds={parentActivityIds}
          allParentsCollapsed={allParentsCollapsed}
          setCollapsedParents={setCollapsedParents}
          handleDownloadTemplate={actions.handleDownloadTemplate}
          setImportOpen={setImportOpen}
          handleExport={actions.handleExport}
          dateMode={dateMode}
          setDateMode={setDateMode}
          allCollapsed={allCollapsed}
          setCollapsedPhases={setCollapsedPhases}
          roadmapYear={roadmapYear}
          setRoadmapYear={setRoadmapYear}
          dataYears={dataYears}
          roadmapPeriod={roadmapPeriod}
          setRoadmapPeriod={setRoadmapPeriod}
          handleExportPng={actions.handleExportPng}
          holidays={holidays}
          setHolidayOpen={setHolidayOpen}
          addActivity={addActivityWithEdit}
        />

        {viewMode === 'roadmap' && (
          <RoadmapView
            phaseGroups={phaseGroups}
            innerRef={roadmapRef}
            holidays={holidays}
            dateMode={dateMode}
            collapsedPhases={collapsedPhases}
            onTogglePhase={togglePhase}
            collapsedParents={collapsedParents}
            onToggleParent={toggleParent}
            onOpenDetail={setDetailActivity}
            viewYear={roadmapYear}
            viewPeriod={roadmapPeriod}
          />
        )}

        {viewMode === 'table' && (
          <TimelineTable
            filterPhase={filterPhase}
            phaseGroups={phaseGroups}
            collapsedTablePhases={collapsedTablePhases}
            toggleTablePhase={toggleTablePhase}
            pagedParentIds={pagedParentIds}
            filteredActivities={filteredActivities}
            totalTableRows={totalTableRows}
            totalTablePages={totalTablePages}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            setCurrentPage={setCurrentPage}
            setRowsPerPage={setRowsPerPage}
            handleDownloadTemplate={actions.handleDownloadTemplate}
            setImportOpen={setImportOpen}
            addActivity={addActivityWithEdit}
            projectId={id}
            activities={activities}
            childrenByParent={childrenByParent}
            collapsedParents={collapsedParents}
            editingActivityId={editingActivityId}
            newActivityIdRef={actions.newActivityIdRef}
            updateField={actions.updateField}
            saveRow={saveRowWithSaving}
            setEditingActivityId={setEditingActivityId}
            setDetailActivity={setDetailActivity}
            setContextMenu={setContextMenu}
            toggleParent={toggleParent}
          />
        )}
      </main>

      <TimelineDialogs
        id={id}
        teamMembers={teamMembers}
        holidays={holidays}
        holidayOpen={holidayOpen}
        setHolidayOpen={setHolidayOpen}
        newHDate={newHDate}
        setNewHDate={setNewHDate}
        newHName={newHName}
        setNewHName={setNewHName}
        addHoliday={() => { actions.addHoliday(newHDate, newHName); setNewHDate(''); setNewHName(''); }}
        removeHoliday={actions.removeHoliday}
        detailActivity={detailActivity}
        setDetailActivity={setDetailActivity}
        childrenByParent={childrenByParent}
        createChildFromDetail={actions.createChildFromDetail}
        setActivities={setActivities}
        deleteRow={actions.deleteRow}
        importOpen={importOpen}
        setImportOpen={setImportOpen}
        projectPhase={project?.current_phase ?? ''}
        load={load}
        jiraSyncOpen={jiraSyncOpen}
        setJiraSyncOpen={setJiraSyncOpen}
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        duplicateActivity={actions.duplicateActivity}
        createChild={actions.createChild}
      />
    </div>
  );
}
