import type {
  AuditLogRow,
  CatalogRow,
  ChecklistItem,
  CompliancePayload,
  ComplianceProject,
  TemplateRow,
} from './types';

export const catalogFixture: CatalogRow[] = [
  {
    id: 1,
    company_id: 1,
    name: 'Charter',
    purpose: 'Signed charter',
    stage: 'L2',
    mandatory: true,
    active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    company_id: 1,
    name: 'SoW',
    purpose: 'Statement of work',
    stage: 'ALL',
    mandatory: false,
    active: false,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
];

export function emptyCatalogFixture(): CatalogRow[] {
  return [];
}

export const templatesFixture: TemplateRow[] = [
  {
    id: 1,
    catalog_id: 1,
    company_id: 1,
    name: 'Charter template v1',
    document_type: 'charter',
    version: 1,
    effective_date: '2026-01-01',
    guidance: 'Use the company charter template',
    template_url: 'https://example.com/templates/charter',
    retired_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  },
];

export function emptyTemplatesFixture(): TemplateRow[] {
  return [];
}

export const checklistFixture: ChecklistItem[] = [
  {
    id: 1,
    project_id: 10,
    catalog_id: 1,
    status: 'drafting',
    confluence_url: null,
    approved_at: null,
    approved_by: null,
    na_reason: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    catalog_name: 'Charter',
    catalog_stage: 'L2',
    catalog_mandatory: true,
    catalog_active: true,
  },
  {
    id: 2,
    project_id: 10,
    catalog_id: 2,
    status: 'approved',
    confluence_url: 'https://example.com/confluence/123',
    approved_at: '2026-01-15',
    approved_by: 'user1',
    na_reason: null,
    notes: null,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-15T00:00:00.000Z',
    catalog_name: 'SoW',
    catalog_stage: 'ALL',
    catalog_mandatory: false,
    catalog_active: true,
  },
];

export function emptyChecklistFixture(): ChecklistItem[] {
  return [];
}

export const complianceFixture: CompliancePayload = {
  filters: {},
  projects: [
    {
      project_id: 1,
      project_code: 'PRJ-001',
      name: 'Alpha Project',
      stage: 'L2',
      status: 'Active',
      rag: 'Green',
      compliance: 'compliant',
    },
    {
      project_id: 2,
      project_code: 'PRJ-002',
      name: 'Beta Project',
      stage: 'L3',
      status: 'Active',
      rag: 'Amber',
      compliance: 'not_compliant',
    },
  ],
};

export const complianceProjects150: ComplianceProject[] = Array.from({ length: 150 }, (_, i) => ({
  project_id: i + 1,
  project_code: `PRJ-${String(i + 1).padStart(3, '0')}`,
  name: `Project ${i + 1}`,
  stage: 'L2',
  status: 'Active',
  rag: 'Green',
  compliance: 'compliant' as const,
}));

export const auditRowsFixture: AuditLogRow[] = [
  {
    id: 1,
    company_id: 1,
    actor_id: 10,
    entity_type: 'document_catalog',
    entity_id: '1',
    action: 'create',
    before: null,
    after: { name: 'Charter', stage: 'L2' },
    created_at: '2026-01-01T10:00:00.000Z',
  },
  {
    id: 2,
    company_id: 1,
    actor_id: 10,
    entity_type: 'project_document_checklist',
    entity_id: '5',
    action: 'update',
    before: { status: 'drafting' },
    after: { status: 'approved' },
    created_at: '2026-01-02T11:00:00.000Z',
  },
];

export const auditRows150: AuditLogRow[] = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1,
  company_id: 1,
  actor_id: 10,
  entity_type: 'document_catalog',
  entity_id: String(i + 1),
  action: 'update',
  before: { version: i },
  after: { version: i + 1 },
  created_at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
}));
