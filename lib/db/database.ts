import type { ColumnType, Generated } from 'kysely';

export type Json = ColumnType<JsonValue, string, string>;
export type JsonArray = JsonValue[];
export type JsonObject = { [K in string]?: JsonValue };
export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Database {
  activities: ActivitiesTable;
  audit_logs: AuditLogsTable;
  budget_adjustments: BudgetAdjustmentsTable;
  budget_expenses: BudgetExpensesTable;
  budget_items: BudgetItemsTable;
  bug_import_mappings: BugImportMappingsTable;
  bugs: BugsTable;
  companies: CompaniesTable;
  company_jira_config: CompanyJiraConfigTable;
  company_rag_config: CompanyRagConfigTable;
  company_weekly_config: CompanyWeeklyConfigTable;
  customers: CustomersTable;
  dashboard_filter_state: DashboardFilterStateTable;
  demo_requests: DemoRequestsTable;
  document_catalog: DocumentCatalogTable;
  document_templates: DocumentTemplatesTable;
  documents: DocumentsTable;
  escalation_levels: EscalationLevelsTable;
  financial_benefits: FinancialBenefitsTable;
  issues: IssuesTable;
  jira_jql_presets: JiraJqlPresetsTable;
  jira_sync_mappings: JiraSyncMappingsTable;
  meetings: MeetingsTable;
  milestone_epics: MilestoneEpicsTable;
  milestones: MilestonesTable;
  nonfinancial_benefits: NonfinancialBenefitsTable;
  operations_budget_items: OperationsBudgetItemsTable;
  operations_expenses: OperationsExpensesTable;
  operations_incidents: OperationsIncidentsTable;
  operations_systems: OperationsSystemsTable;
  portfolio_budget_allocations: PortfolioBudgetAllocationsTable;
  portfolio_budget_categories: PortfolioBudgetCategoriesTable;
  portfolio_budgets: PortfolioBudgetsTable;
  portfolio_members: PortfolioMembersTable;
  portfolio_program_allocations: PortfolioProgramAllocationsTable;
  program_project_allocations: ProgramProjectAllocationsTable;
  project_dependencies: ProjectDependenciesTable;
  project_document_checklist: ProjectDocumentChecklistTable;
  project_fiscal_budgets: ProjectFiscalBudgetsTable;
  project_holidays: ProjectHolidaysTable;
  project_pm_assignments: ProjectPmAssignmentsTable;
  project_stakeholders: ProjectStakeholdersTable;
  projects: ProjectsTable;
  raid_due_date_history: RaidDueDateHistoryTable;
  risks: RisksTable;
  sessions: SessionsTable;
  settings: SettingsTable;
  team_members: TeamMembersTable;
  timeline_import_mappings: TimelineImportMappingsTable;
  user_roles: UserRolesTable;
  users: UsersTable;
  weekly_export_logs: WeeklyExportLogsTable;
  weekly_periods: WeeklyPeriodsTable;
  weekly_report_versions: WeeklyReportVersionsTable;
  weekly_reports: WeeklyReportsTable;
}

export interface ActivitiesTable {
  id: Generated<number>;
  project_id: number;
  phase: string;
  no: string | null;
  activity: string;
  deliverable: string | null;
  sign_off_doc: string | null;
  accountable: string | null;
  responsible: string | null;
  support: string | null;
  plan_start: string | null;
  plan_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: string | null;
  completion_pct: number | null;
  notes: string | null;
  order_idx: number | null;
  delay_owner: string | null;
  delay_reason: string | null;
  jira_key: string | null;
  sprint: string | null;
  priority: string | null;
  project_status: string | null;
  parent_id: number | null;
}

export interface AuditLogsTable {
  id: Generated<number>;
  company_id: number | null;
  actor_id: number | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string | null;
  before: Json | null;
  after: Json | null;
  created_at: Timestamp;
}

export interface BudgetAdjustmentsTable {
  id: Generated<number>;
  fiscal_budget_id: number;
  amount_vnd: number;
  effective_date: string;
  reason: string;
  created_by: number | null;
  created_at: Timestamp;
}

export interface BudgetExpensesTable {
  id: Generated<number>;
  budget_item_id: number;
  project_id: number;
  expense_date: string;
  description: string;
  amount: number;
  reference: string | null;
  created_at: Timestamp;
}

export interface BudgetItemsTable {
  id: Generated<number>;
  project_id: number;
  type: string;
  group_name: string;
  name: string;
  planned_amount: number;
  actual_amount: number;
  approved_amount: number | null;
  unit: string;
  notes: string | null;
  budget_status: string | null;
  created_at: Timestamp;
}

export interface BugImportMappingsTable {
  id: Generated<number>;
  name: string;
  mappings_json: string;
  company_id: number | null;
  created_at: Timestamp;
}

export interface BugsTable {
  id: Generated<number>;
  project_id: number;
  issue_type: string | null;
  issue_key: string | null;
  issue_id: string | null;
  summary: string;
  assignee: string | null;
  reporter: string | null;
  priority: string | null;
  severity: string | null;
  status: string | null;
  resolution: string | null;
  created: string | null;
  snapshot_date: string | null;
  created_at: Timestamp;
}

export interface CompaniesTable {
  id: Generated<number>;
  name: string;
  headcount_quota: number | null;
  created_at: Timestamp;
}

export interface CompanyJiraConfigTable {
  company_id: number;
  base_url_var: string;
  email_var: string;
  token_var: string;
}

export interface CompanyRagConfigTable {
  company_id: number;
  spi_red_threshold: number;
  spi_amber_threshold: number;
  deadline_red_days: number;
  deadline_amber_days: number;
  risks_red: number;
  risks_amber: number;
  issues_amber: number;
  low_progress_amber: number;
  updated_at: Timestamp;
}

export interface CompanyWeeklyConfigTable {
  company_id: number;
  due_weekday: number;
  due_time_utc: string;
  updated_at: Timestamp;
  updated_by: number | null;
}

export interface CustomersTable {
  id: Generated<number>;
  name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  notes: string | null;
  company_id: number | null;
  created_at: Timestamp;
}

export interface DashboardFilterStateTable {
  user_id: number;
  surface: string;
  filters_json: Json;
  updated_at: Timestamp;
}

export interface DemoRequestsTable {
  id: Generated<number>;
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  status: string;
  notes: string | null;
  created_at: Timestamp;
}

export interface DocumentCatalogTable {
  id: Generated<number>;
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DocumentTemplatesTable {
  id: Generated<number>;
  catalog_id: number;
  company_id: number;
  name: string;
  document_type: string;
  version: number;
  effective_date: string;
  guidance: string;
  template_url: string | null;
  retired_at: Timestamp | null;
  created_at: Timestamp;
}

export interface DocumentsTable {
  id: Generated<number>;
  project_id: number;
  type: string;
  title: string | null;
  content_json: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EscalationLevelsTable {
  id: Generated<number>;
  project_id: number;
  level: number;
  level_name: string | null;
  channel: string | null;
  participants: string | null;
  input: string | null;
  output: string | null;
}

export interface FinancialBenefitsTable {
  id: Generated<number>;
  project_id: number;
  fiscal_year: number;
  benefit_type: string;
  expected_vnd: number;
  actual_vnd: number | null;
}

export interface IssuesTable {
  id: Generated<number>;
  project_id: number;
  issue_id: string | null;
  code: string | null;
  description: string;
  root_cause: string | null;
  category: string | null;
  owner: string | null;
  trigger: string | null;
  mitigation: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  impact: string | null;
  affected_activity_id: number | null;
  technology_council: boolean | null;
  deactivated_at: Timestamp | null;
}

export interface JiraJqlPresetsTable {
  id: Generated<number>;
  name: string;
  jql: string;
  context: string | null;
  company_id: number | null;
  created_at: Timestamp;
}

export interface JiraSyncMappingsTable {
  id: Generated<number>;
  mappings_json: string;
  company_id: number | null;
  created_at: Timestamp;
}

export interface MeetingsTable {
  id: Generated<number>;
  project_id: number;
  name: string;
  frequency: string | null;
  content: string | null;
  participants: string | null;
  method: string | null;
  type: string | null;
}

export interface MilestoneEpicsTable {
  id: Generated<number>;
  milestone_id: number;
  activity_id: number;
}

export interface MilestonesTable {
  id: Generated<number>;
  project_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  plan_end: string | null;
  adjusted_end: string | null;
  cancelled_at: Timestamp | null;
  cancelled_by: number | null;
  created_at: Timestamp;
}

export interface NonfinancialBenefitsTable {
  id: Generated<number>;
  project_id: number;
  group_name: string;
  measure: string;
  target: string;
  actual_text: string | null;
  created_at: Timestamp;
}

export interface OperationsBudgetItemsTable {
  id: Generated<number>;
  operations_system_id: number;
  category: string;
  name: string;
  planned_amount: number;
  actual_amount: number;
  unit: string;
  period_label: string | null;
  notes: string | null;
}

export interface OperationsExpensesTable {
  id: Generated<number>;
  operations_system_id: number;
  expense_date: string;
  category: string | null;
  description: string;
  amount: number;
  reference: string | null;
  created_at: Timestamp;
}

export interface OperationsIncidentsTable {
  id: Generated<number>;
  operations_system_id: number;
  title: string;
  severity: string;
  description: string | null;
  reported_at: string;
  resolved_at: string | null;
  cost_impact: number | null;
  status: string;
  created_at: Timestamp;
}

export interface OperationsSystemsTable {
  id: Generated<number>;
  company_id: number | null;
  project_id: number | null;
  name: string;
  description: string | null;
  go_live_date: string | null;
  status: string;
  created_at: Timestamp;
}

export interface PortfolioBudgetAllocationsTable {
  id: Generated<number>;
  portfolio_budget_id: number;
  project_id: number | null;
  allocated_amount: number;
  notes: string | null;
  created_at: Timestamp;
}

export interface PortfolioBudgetCategoriesTable {
  id: Generated<number>;
  portfolio_budget_id: number;
  category: string;
  ceiling_amount: number;
  notes: string | null;
}

export interface PortfolioBudgetsTable {
  id: Generated<number>;
  company_id: number | null;
  period_type: string;
  period_label: string;
  start_date: string;
  end_date: string;
  total_amount: number;
  currency: string;
  status: string;
  notes: string | null;
  created_at: Timestamp;
}

export interface PortfolioMembersTable {
  id: Generated<number>;
  company_id: number | null;
  role: string | null;
  name: string;
  email: string | null;
  note: string | null;
  member_type: string | null;
  member_category: string | null;
  overhead_remaining: number | null;
  created_at: Timestamp;
}

export interface PortfolioProgramAllocationsTable {
  id: Generated<number>;
  company_id: number | null;
  program_id: number | null;
  allocated_headcount: number | null;
  created_at: Timestamp;
}

export interface ProgramProjectAllocationsTable {
  id: Generated<number>;
  program_id: number | null;
  project_id: number | null;
  allocated_headcount: number | null;
  created_at: Timestamp;
}

export interface ProjectDependenciesTable {
  id: Generated<number>;
  from_project_id: number;
  to_project_id: number;
  dependency_type: string;
  need_by: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_by: number | null;
  created_at: Timestamp;
}

export interface ProjectDocumentChecklistTable {
  id: Generated<number>;
  project_id: number;
  catalog_id: number;
  status: string;
  confluence_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  na_reason: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProjectFiscalBudgetsTable {
  id: Generated<number>;
  project_id: number;
  fiscal_year: number;
  cost_type: string;
  approved_amount_vnd: number;
  actual_amount_vnd: number;
  created_at: Timestamp;
}

export interface ProjectHolidaysTable {
  id: Generated<number>;
  project_id: number;
  date: string;
  name: string | null;
}

export interface ProjectPmAssignmentsTable {
  id: Generated<number>;
  project_id: number;
  user_id: number;
  role: string;
  effective_from: string;
  effective_to: string | null;
  created_at: Timestamp;
}

export interface ProjectStakeholdersTable {
  id: Generated<number>;
  project_id: number;
  stakeholder_role: string;
  user_id: number | null;
  external_name: string | null;
  external_email: string | null;
  effective_from: string;
  effective_to: string | null;
  created_at: Timestamp;
}

export interface ProjectsTable {
  id: Generated<number>;
  name: string;
  client: string | null;
  pm_name: string | null;
  pm_email: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  current_phase: string | null;
  description: string | null;
  objective: string | null;
  project_owner: string | null;
  budget: number | null;
  budget_currency: string | null;
  budget_status: string | null;
  headcount_quota: number | null;
  customer_id: number | null;
  company_id: number | null;
  project_code: string | null;
  portfolio_year: number | null;
  stage: string | null;
  status_reason: string | null;
  rag: string | null;
  progress_pct: number | null;
  weekly_report_enabled: boolean | null;
  weekly_report_start_period: string | null;
  plan_end: string | null;
  adjusted_end: string | null;
  actual_end: string | null;
  classification: string | null;
  governance: string | null;
  created_at: Timestamp;
}

export interface RaidDueDateHistoryTable {
  id: Generated<number>;
  entity_type: string;
  entity_id: string;
  old_due: string | null;
  new_due: string | null;
  changed_at: Timestamp;
  changed_by: number | null;
}

export interface RisksTable {
  id: Generated<number>;
  project_id: number;
  risk_id: string | null;
  code: string | null;
  description: string;
  category: string | null;
  owner: string | null;
  trigger: string | null;
  mitigation: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  impact: string | null;
  affected_activity_id: number | null;
  deactivated_at: Timestamp | null;
}

export interface SessionsTable {
  id: string;
  user_id: number;
  expires_at: string;
}

export interface SettingsTable {
  key: string;
  value: string;
}

export interface TeamMembersTable {
  id: Generated<number>;
  project_id: number;
  domain: string | null;
  role: string | null;
  name: string;
  email: string | null;
  capacity_json: string | null;
  notes: string | null;
}

export interface TimelineImportMappingsTable {
  id: Generated<number>;
  name: string;
  mappings_json: string;
  company_id: number | null;
  created_at: Timestamp;
}

export interface UserRolesTable {
  user_id: number;
  role: string;
  company_id: number | null;
}

export interface UsersTable {
  id: Generated<number>;
  username: string;
  password_hash: string;
  display_name: string | null;
  company_id: number | null;
  is_admin: number | null;
  onboarding_completed: number | null;
  email: string | null;
  status: string;
  locked_at: Timestamp | null;
  locked_by: number | null;
  deleted_at: Timestamp | null;
  created_at: Timestamp;
}

export interface WeeklyExportLogsTable {
  id: Generated<number>;
  period_id: number;
  company_id: number;
  exported_by: number;
  exported_at: Timestamp;
  format: string;
  data_version: number;
  project_ids: Json;
  period_display_name: string;
}

export interface WeeklyPeriodsTable {
  id: Generated<number>;
  company_id: number;
  iso_week: string;
  start_date: string;
  end_date: string;
  due_at: Timestamp;
  display_name: string;
  config_snapshot: Json;
  closed_at: Timestamp | null;
  created_by: number | null;
  created_at: Timestamp;
}

export interface WeeklyReportVersionsTable {
  id: Generated<number>;
  report_id: number;
  version: number;
  snapshot: Json;
  submitted_at: Timestamp | null;
  submitted_by: number | null;
  rag: string | null;
  progress_pct: number | null;
}

export interface WeeklyReportsTable {
  id: Generated<number>;
  period_id: number;
  project_id: number;
  status: string;
  first_submitted_at: Timestamp | null;
  first_lateness: string | null;
  latest_version: number;
  correction_open: boolean;
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: string | null;
  prev_week_rag: string | null;
  draft_raid_json: Json | null;
}
