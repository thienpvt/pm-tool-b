'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Activity, Milestone, Project, TeamMember } from './types';

export function useMilestonesPage(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  const loadMilestones = useCallback(async () => {
    const data = await fetch(`/api/projects/${projectId}/milestones`).then(r => r.json());
    setMilestones(data);
  }, [projectId]);

  const loadAllActivities = useCallback(async () => {
    const data = await fetch(`/api/projects/${projectId}/activities`).then(r => r.json());
    setAllActivities(data);
  }, [projectId]);

  const loadMilestoneItems = useCallback(async (milestoneId: number) => {
    const data = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}/epics`).then(r => r.json());
    return data;
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then(r => r.json()).then(setProject);
    fetch(`/api/projects/${projectId}/team`).then(r => r.json()).then(setTeamMembers);
    loadMilestones();
    loadAllActivities();
  }, [projectId, loadMilestones, loadAllActivities]);

  return {
    project,
    milestones, setMilestones,
    allActivities, setAllActivities,
    teamMembers,
    loadMilestones,
    loadAllActivities,
    loadMilestoneItems,
  };
}
