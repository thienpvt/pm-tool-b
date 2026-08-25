export type RiskItem = {
  id: number; description: string; priority: string; category: string;
  mitigation: string; owner: string; project_name: string; program_name: string;
};
export type MilestoneItem = {
  id: number; activity: string; deliverable: string; plan_end: string;
  completion_pct: number; project_name: string; program_name: string;
};
export type RecentDone = {
  id: number; activity: string; deliverable: string; actual_end: string;
  project_name: string; program_name: string;
};
export type CompletedActivity = { id: number; activity: string; deliverable: string; actual_end: string; };
export type CompletedGroup = { project_name: string; program_name: string; current_phase: string; activities: CompletedActivity[]; };
export type EpicStat = { phase: string; total: number; done: number; pct: number; start_date?: string | null; end_date?: string | null; };
export type ProjectRow = {
  id: number; name: string; program_name: string; client: string; pm_name: string;
  current_phase: string; completion_pct: number; open_risks: number; open_issues: number;
  days_until_deadline: number | null; rag: 'red' | 'amber' | 'green';
  total_activities: number; done_activities: number;
  in_progress_activities: number; not_started_activities: number;
  epicStats: EpicStat[];
};
export type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[]; };
export type PersonnelStats = {
  totalInternal: number;
  totalAllocated: number;
  projectAllocations: { projectName: string; memberCount: number }[];
  overallocated: { name: string; role: string; projects: string[] }[];
};
export type FteProgramRate = { programName: string; allocated: number; actual: number; fillRate: number; };
export type FteStats = {
  headcountQuota: number;
  deliveryFte: number;
  overheadProjectFte: number;
  overheadRemainingFte: number;
  benchFte: number;
  utilizationPct: number;
  blockFillRate: number;
  programFillRates: FteProgramRate[];
  peopleNeeded: number;
  currentMonth: string;
};
export type PortfolioReportData = {
  projects: ProjectRow[];
  programs: ProgramGroup[];
  noProgramProjects: ProjectRow[];
  kpi: {
    totalProjects: number; totalPrograms: number; avgCompletion: number;
    activeProjects: number; totalOpenRisks: number; totalOpenIssues: number;
  };
  topRisks: RiskItem[];
  topIssues: RiskItem[];
  upcomingMilestones: MilestoneItem[];
  recentlyCompleted: RecentDone[];
  completedByProject: Record<string, CompletedGroup>;
  personnelStats: PersonnelStats;
  fteStats?: FteStats | null;
  bugStats?: BugStats | null;
  portfolioMilestones?: PortfolioMilestone[];
  milestoneInfo?: MilestoneInfo[] | null;
  periodStart: string;
  periodEnd: string;
  reportDate: string;
};

export type BugProjectSummary = { projectId: number; projectName: string; total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; bySeverity: Record<string, number> };
export type BugStats = { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; bySeverity: Record<string, number>; byProject: BugProjectSummary[] };
export type PortfolioMilestone = { id: number; project_id: number; name: string; start_date: string; end_date: string; project_name: string; program_name: string };
export type MilestoneInfo = { id: number; name: string; project_name: string; program_name: string; start_date: string; end_date: string };
// milestoneInfo is an array when milestones are selected
export type SavedPrompt = { id: string; name: string; text: string };
export const SAVED_PROMPTS_KEY = 'portfolio_email_saved_prompts';
export const MAX_SAVED_PROMPTS = 5;
