'use client';

export type Milestone = {
  id: number;
  project_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type ActivityItem = {
  id: number;
  phase: string;
  no: string;
  activity: string;
  status: string;
  completion_pct: number;
  plan_start: string | null;
  plan_end: string | null;
  jira_key: string;
  parent_id: number | null;
};

export type Activity = {
  id: number; phase: string; no: string; activity: string; deliverable: string;
  sign_off_doc: string; accountable: string; responsible: string; support: string;
  plan_start: string; plan_end: string; actual_start: string; actual_end: string;
  status: string; completion_pct: number; notes: string; order_idx: number;
  delay_owner: string; delay_reason: string;
  jira_key: string; sprint: string; project_status: string;
  parent_id: number | null;
  priority: string;
};

export type TeamMember = { id: number; name: string; role: string; domain: string; };

export type PickerPhase = {
  epics: { epic: ActivityItem; children: ActivityItem[] }[];
  standalone: ActivityItem[];
  orphanChildren: ActivityItem[];
};

export type Project = {
  id: number; name: string; status: string;
  current_phase: string; client: string; pm_name: string;
};
