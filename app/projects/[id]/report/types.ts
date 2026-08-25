// ─── Types ────────────────────────────────────────────────────────────────────
export type Milestone = { id: number; name: string; start_date: string; end_date: string };
export type MilestoneStat = { id: number; name: string; start_date: string | null; end_date: string | null; total: number; done: number; pct: number };
export type EpicStat = { phase: string; total: number; done: number; pct: number; plan_start?: string | null; plan_end?: string | null };
export type RiskIssue = { id: number; description: string; priority: string; status: string; mitigation?: string; owner?: string };
export type ActivityRow = { id: number; activity: string; deliverable?: string; plan_end?: string; actual_end?: string; status: string };
export type ProjectReportData = {
  project: {
    id: number; name: string; customer_name?: string; program_name?: string;
    pm_name?: string; current_phase: string; end_date?: string;
    start_date?: string; rag: 'red' | 'amber' | 'green'; days_until_deadline: number | null;
  };
  milestones: Milestone[];
  selectedMilestone?: Milestone | null;
  periodStart: string;
  periodEnd: string;
  stats: { total: number; done: number; inProgress: number; notStarted: number; completion_pct: number };
  epicStats: EpicStat[];
  completedInPeriod: ActivityRow[];
  upcomingActivities: ActivityRow[];
  openRisks: RiskIssue[];
  openIssues: RiskIssue[];
  bugStats?: { total: number; byStatus: Record<string, number>; byPriority: Record<string, number>; snapshotDate?: string | null } | null;
  teamStats?: {
    total: number; currentMonth: string; fullTime: number; partTime: number;
    overloaded: { name: string; domain: string; role: string; capacity: number }[];
    byDomain: { domain: string; members: { name: string; role: string; capacity: number }[] }[];
    taskAllocation: { name: string; count: number; pct: number; role: string; domain: string }[];
    totalPeriodTasks: number;
  } | null;
  milestoneStats?: MilestoneStat[];
};
export type SavedPrompt = { id: string; name: string; text: string };
export const SAVED_PROMPTS_KEY = 'project_report_saved_prompts';
export const MAX_SAVED_PROMPTS = 5;
