export type PhaseInfo = {
  phase: string;
  start_date: string | null;
  end_date:   string | null;
  total:      number;
  done:       number;
  completion_pct: number;
  epic_key:   string | null;
};
export type ProjectRow = {
  id: number; name: string; pm_name: string;
  customer_id: number | null;
  start_date: string; end_date: string;
  current_phase: string; completion_pct: number;
  rag: 'red' | 'amber' | 'green';
  phases: PhaseInfo[];
};
export type ProgramGroup = { id: number; name: string; industry: string; projects: ProjectRow[] };
export type RoadmapData = { programs: ProgramGroup[]; noProgramProjects: ProjectRow[] };

export type EpicChild = {
  id: number; no: string; activity: string; status: string;
  plan_start: string | null; plan_end: string | null; jira_key: string | null;
  weighted_pct: number;
};
export type EpicNode = {
  id: number; phase: string; no: string; activity: string; status: string;
  plan_start: string | null; plan_end: string | null; jira_key: string | null;
  child_count: number; weighted_pct: number; children: EpicChild[];
};

export type MilestoneRow = {
  id: number; project_id: number; name: string;
  start_date: string | null; end_date: string | null;
  project_name: string; program_name: string | null;
};
export type MilestoneItem = {
  id: number; phase: string; no: string; activity: string; status: string;
  completion_pct: number; plan_start: string | null; plan_end: string | null;
  jira_key: string; parent_id: number | null;
};

// Dữ liệu chung cho dialog chi tiết Epic (dùng cả ở phase-mode lẫn milestone-mode)
export type EpicDetailData = {
  projectName: string;
  epicActivity: string;
  jira_key: string | null;
  status: string;
  children: { id: number; jira_key: string | null; no: string; activity: string; status: string; plan_start: string | null; plan_end: string | null }[];
};
