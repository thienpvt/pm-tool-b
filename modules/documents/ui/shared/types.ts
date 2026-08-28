export type CatalogRow = {
  id: number;
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateRow = {
  id: number;
  catalog_id: number;
  company_id: number;
  name: string;
  document_type: string;
  version: number;
  effective_date: string;
  guidance: string;
  template_url: string | null;
  retired_at: string | null;
  created_at: string;
};

export type ChecklistStatus =
  | 'none'
  | 'drafting'
  | 'pending_approval'
  | 'approved'
  | 'not_applicable';

export type ChecklistItem = {
  id: number;
  project_id: number;
  catalog_id: number;
  status: ChecklistStatus;
  confluence_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  na_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  catalog_name: string;
  catalog_stage: string;
  catalog_mandatory: boolean;
  catalog_active: boolean;
};

export type ComplianceStatus = 'compliant' | 'not_compliant' | 'not_applicable';

export type ComplianceFilters = {
  stage?: string;
  status?: string;
  rag?: string;
  program?: string | number;
};

export type ComplianceProject = {
  project_id: number;
  project_code: string | null;
  name: string;
  stage: string | null;
  status: string;
  rag: string | null;
  compliance: ComplianceStatus;
};

export type CompliancePayload = {
  filters: ComplianceFilters;
  projects: ComplianceProject[];
};

export type AuditLogRow = {
  id: number;
  company_id: number | null;
  actor_id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  before: unknown;
  after: unknown;
  created_at: string;
};

export type AuditFilters = {
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
  limit?: number;
};
