import { useCallback, useEffect, useState } from 'react';
import type { Activity, TeamMember, Project, Holiday } from './types';

export function useTimelinePage(projectId: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/activities`).then(r => r.json()).then(setActivities);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`/api/projects/${projectId}`).then(r => r.json()).then(setProject); }, [projectId]);
  useEffect(() => { fetch(`/api/projects/${projectId}/team`).then(r => r.json()).then(setTeamMembers); }, [projectId]);
  useEffect(() => { fetch(`/api/projects/${projectId}/holidays`).then(r => r.json()).then(setHolidays); }, [projectId]);

  return {
    activities, setActivities,
    teamMembers,
    project,
    holidays, setHolidays,
    load,
  };
}
