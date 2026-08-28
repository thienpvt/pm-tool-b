import {
  addMissingTeamMembersToPortfolio,
  createCompany,
  deleteCompany,
  deleteDemoRequest,
  listCompaniesWithUserCounts,
  listDemoRequests,
  resourceAudit,
  updateCompany,
  updateDemoRequest,
} from '@/lib/repositories/admin.repo';
import { ConflictError } from '@/lib/services/errors';

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = (err as { code?: string }).code;
  if (code === '23505') return true;
  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('UNIQUE constraint failed');
}

export async function listCompaniesPlatform() {
  return listCompaniesWithUserCounts(null, true);
}

export async function createCompanyPlatform(name: string) {
  try {
    return await createCompany(name);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ConflictError('Company name already exists');
    }
    throw err;
  }
}

export async function updateCompanyPlatform(id: number | string, name: string) {
  return updateCompany(id, name);
}

export async function deleteCompanyPlatform(id: number | string) {
  return deleteCompany(id);
}

export async function listDemoRequestsPlatform() {
  return listDemoRequests();
}

export async function updateDemoRequestPlatform(
  id: number | string,
  status: string | null,
  notes: string | null,
) {
  return updateDemoRequest(id, status, notes);
}

export async function deleteDemoRequestPlatform(id: number | string) {
  return deleteDemoRequest(id);
}

export async function getResourceAudit(companyId: number | null) {
  return resourceAudit(companyId);
}

export async function addMissingTeamMembersToPortfolioForCompany(companyId: number | null) {
  return addMissingTeamMembersToPortfolio(companyId);
}
