import type { PortfolioReportData } from '../types';

function filterDataByProjects(data: PortfolioReportData, ids: Set<number>): PortfolioReportData {
  if (ids.size === 0) return data;
  const programs = data.programs
    .map(prog => ({ ...prog, projects: prog.projects.filter(p => ids.has(p.id)) }))
    .filter(prog => prog.projects.length > 0);
  const noProgramProjects = data.noProgramProjects.filter(p => ids.has(p.id));
  const allFiltered = [...programs.flatMap(c => c.projects), ...noProgramProjects];
  const nameSet = new Set(allFiltered.map(p => p.name));
  const kpi = {
    totalProjects: allFiltered.length,
    totalPrograms: programs.length,
    avgCompletion: allFiltered.length > 0 ? Math.round(allFiltered.reduce((s, p) => s + p.completion_pct, 0) / allFiltered.length) : 0,
    activeProjects: allFiltered.filter(p => p.current_phase !== 'Closing').length,
    totalOpenRisks: allFiltered.reduce((s, p) => s + p.open_risks, 0),
    totalOpenIssues: allFiltered.reduce((s, p) => s + p.open_issues, 0),
  };
  return {
    ...data,
    projects: data.projects.filter(p => ids.has(p.id)),
    programs,
    noProgramProjects,
    kpi,
    topRisks: data.topRisks.filter(r => nameSet.has(r.project_name)),
    topIssues: data.topIssues.filter(r => nameSet.has(r.project_name)),
    upcomingMilestones: data.upcomingMilestones.filter(m => nameSet.has(m.project_name)),
    recentlyCompleted: data.recentlyCompleted.filter(r => nameSet.has(r.project_name)),
    completedByProject: Object.fromEntries(Object.entries(data.completedByProject).filter(([k]) => nameSet.has(k))),
  };
}

export { filterDataByProjects };
