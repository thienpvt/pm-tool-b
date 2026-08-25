import { useMemo, useCallback } from 'react';
import type { Activity } from '../types';
import { DEFAULT_PHASES, STATUSES, DONE_STATUSES } from '../types';
import { calcLag } from './LagCalc';

export function usePhaseGroups(
  activities: Activity[],
  filterPhase: string,
  filterStatuses: Set<string>,
) {
  const filteredActivities = useMemo(() => {
    let list = filterPhase === 'All' ? activities : activities.filter(a => a.phase === filterPhase);
    if (filterStatuses.size > 0) list = list.filter(a => filterStatuses.has(a.status));
    return list;
  }, [activities, filterPhase, filterStatuses]);

  const availableStatuses = useMemo(() => {
    const base = filterPhase === 'All' ? activities : activities.filter(a => a.phase === filterPhase);
    const seen = new Set<string>();
    for (const a of base) if (a.status) seen.add(a.status);
    return STATUSES.filter(s => seen.has(s));
  }, [activities, filterPhase]);

  const phaseGroups = useMemo((): { phase: string; acts: Activity[] }[] => {
    const seenPhases = new Set<string>();
    const groups: { phase: string; acts: Activity[] }[] = [];
    for (const a of filteredActivities) {
      if (!seenPhases.has(a.phase)) {
        seenPhases.add(a.phase);
        groups.push({ phase: a.phase, acts: filteredActivities.filter(x => x.phase === a.phase) });
      }
    }
    return groups;
  }, [filteredActivities]);

  const allPhases = useMemo(() => {
    const seen = new Set<string>(); const result: string[] = [];
    for (const a of activities) {
      if (a.phase && !seen.has(a.phase)) { seen.add(a.phase); result.push(a.phase); }
    }
    for (const p of DEFAULT_PHASES) { if (!seen.has(p)) result.push(p); }
    return result;
  }, [activities]);

  const overdueCount = activities.filter(a => !DONE_STATUSES.has(a.status) && calcLag(a.plan_end, a.actual_end, a.status) > 0).length;

  return { filteredActivities, availableStatuses, phaseGroups, allPhases, overdueCount };
}

export function useTablePagination(
  phaseGroups: { phase: string; acts: Activity[] }[],
  collapsedTablePhases: Set<string>,
  currentPage: number,
  rowsPerPage: number,
) {
  const visibleParents = useMemo(() => {
    return phaseGroups.flatMap(({ phase, acts }) => {
      if (collapsedTablePhases.has(phase)) return [];
      return acts.filter(a => !a.parent_id);
    });
  }, [phaseGroups, collapsedTablePhases]);

  const totalTableRows = visibleParents.length;
  const totalTablePages = Math.max(1, Math.ceil(totalTableRows / rowsPerPage));

  const pagedParentIds = useMemo(() => {
    const slice = visibleParents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    return new Set(slice.map(a => a.id));
  }, [visibleParents, currentPage, rowsPerPage]);

  return { visibleParents, totalTableRows, totalTablePages, pagedParentIds };
}

export function useChildrenMap(activities: Activity[]) {
  return useMemo(() => {
    const map = new Map<number, Activity[]>();
    for (const a of activities) {
      if (a.parent_id) {
        if (!map.has(a.parent_id)) map.set(a.parent_id, []);
        map.get(a.parent_id)!.push(a);
      }
    }
    return map;
  }, [activities]);
}

export function useParentActivityIds(activities: Activity[]) {
  return useMemo(() =>
    activities.filter(a => !a.parent_id && activities.some(c => c.parent_id === a.id)).map(a => a.id),
  [activities]);
}

export function useDataYears(activities: Activity[]) {
  return useMemo(() => {
    const years = new Set<number>();
    for (const a of activities) {
      [a.plan_start, a.plan_end, a.actual_start, a.actual_end].forEach(d => {
        if (d) { const y = new Date(d + 'T00:00:00').getFullYear(); if (!isNaN(y)) years.add(y); }
      });
    }
    years.add(new Date().getFullYear());
    return [...years].sort();
  }, [activities]);
}
