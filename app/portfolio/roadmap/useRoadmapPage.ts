'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EpicNode, MilestoneItem, MilestoneRow, RoadmapData } from './types';

export type UseRoadmapPageParams = {
  viewMode: 'phase' | 'milestone';
  selectedMilestoneId: number | null;
};

export function useRoadmapPage({ viewMode, selectedMilestoneId }: UseRoadmapPageParams) {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<MilestoneRow[] | null>(null);
  const [milestoneItems, setMilestoneItems] = useState<MilestoneItem[] | null>(null);
  const [epicsByProject, setEpicsByProject] = useState<Record<number, EpicNode[] | 'loading'>>({});

  useEffect(() => {
    fetch('/api/portfolio/roadmap').then(r => r.json()).then((d: RoadmapData) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (viewMode === 'milestone' && milestones === null) {
      fetch('/api/portfolio/milestones').then(r => r.json()).then((d: MilestoneRow[]) => setMilestones(d));
    }
  }, [viewMode, milestones]);

  const selectedMilestone = useMemo(
    () => milestones?.find(m => m.id === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId],
  );

  useEffect(() => {
    if (!selectedMilestone) { setMilestoneItems(null); return; }
    setMilestoneItems(null);
    fetch(`/api/projects/${selectedMilestone.project_id}/milestones/${selectedMilestone.id}/epics`)
      .then(r => r.json())
      .then((d: MilestoneItem[]) => setMilestoneItems(d));
  }, [selectedMilestone]);

  const loadEpics = useCallback(async (projectId: number) => {
    let already = false;
    setEpicsByProject(prev => {
      if (prev[projectId]) { already = true; return prev; }
      return { ...prev, [projectId]: 'loading' };
    });
    if (already) return;
    const d = await fetch(`/api/portfolio/roadmap/epics?project_id=${projectId}`).then(r => r.json());
    setEpicsByProject(prev => ({ ...prev, [projectId]: (d.epics ?? []) as EpicNode[] }));
  }, []);

  return {
    data, loading,
    milestones,
    milestoneItems, setMilestoneItems,
    selectedMilestone,
    epicsByProject,
    loadEpics,
  };
}
