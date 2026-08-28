import { projectComplianceStatus } from '@/lib/documents/compliance';
import {
  applyDashboardFilters,
  type DashboardFilters,
  type FilterableProjectRow,
} from '@/lib/dashboards/filters';
import { listChecklistByProject } from '@/modules/documents/backend/repositories/project-document-checklist.repo';
import { listProjects } from '@/modules/projects/backend/repositories/projects.repo';
import { assertCompanyWrite, type AccessActor } from '@/lib/services/access';
import { ValidationError } from '@/lib/services/errors';

export const COMPLIANCE_FILTER_KEYS = ['stage', 'status', 'rag', 'program'] as const;
export type ComplianceFilterKey = (typeof COMPLIANCE_FILTER_KEYS)[number];

export function parseComplianceFilters(input: Record<string, string>): DashboardFilters {
  const filters: DashboardFilters = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(COMPLIANCE_FILTER_KEYS as readonly string[]).includes(key)) {
      throw new ValidationError(`Unknown filter key: ${key}`, key);
    }
    if (value === null || value === undefined || value === '') continue;
    if (key === 'program' && /^\d+$/.test(value)) {
      (filters as Record<string, unknown>)[key] = Number(value);
    } else {
      (filters as Record<string, unknown>)[key] = value;
    }
  }
  return filters;
}

export async function getDocumentCompliance(
  actor: AccessActor,
  query: Record<string, string>,
) {
  assertCompanyWrite(actor);

  const filters = parseComplianceFilters(query);
  const rawProjects = await listProjects(actor.company_id);
  const filtered = applyDashboardFilters(
    rawProjects as FilterableProjectRow[],
    filters,
  );

  const projects = await Promise.all(
    filtered.map(async (project) => {
      const rows = await listChecklistByProject(Number(project.id));
      const mandatory = rows.filter((row) => row.catalog_mandatory);
      return {
        project_id: Number(project.id),
        project_code: (project as Record<string, unknown>).project_code as string | null,
        name: (project as Record<string, unknown>).name as string,
        stage: project.stage ?? null,
        status: (project as Record<string, unknown>).status as string,
        rag: project.rag ?? null,
        compliance: projectComplianceStatus(mandatory),
      };
    }),
  );

  return { filters, projects };
}
