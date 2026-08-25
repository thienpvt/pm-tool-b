export type ProjectRow = {
  id: number; name: string; client: string; customer_id: number | null;
  program_name: string; program_industry: string;
  pm_name: string; start_date: string; end_date: string;
  current_phase: string; description: string;
  open_risks: number; open_issues: number;
  completion_pct: number; total_activities: number; done_activities: number;
  rag: 'red' | 'amber' | 'green';
  days_until_deadline: number | null;
};
export type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
export type PortfolioData = {
  projects: ProjectRow[];
  programs: ProgramGroup[];
  noProgramProjects: ProjectRow[];
  phaseDist: { phase: string; count: number }[];
  programBar: { name: string; count: number; active: number }[];
  kpi: {
    totalProjects: number; totalPrograms: number;
    totalOpenRisks: number; totalOpenIssues: number;
    avgCompletion: number; activeProjects: number;
  };
};
export type MeUser = { display_name: string; username: string; onboarding_completed: number };
