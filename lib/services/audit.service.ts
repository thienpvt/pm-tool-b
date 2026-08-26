import {
  insertAuditLog,
  listAuditLogs as listAuditLogsRepo,
  type AuditListFilters,
  type AuditLogInput,
} from '@/lib/repositories/audit.repo';
import { assertCompanyWrite, type AccessActor } from './access';

export type { AuditLogInput, AuditListFilters };

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit) || limit < 1) return 50;
  return Math.min(Math.floor(limit), 200);
}

/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}

/** Company-scoped audit read — CPMO with non-null company_id only (D-05, D-06). */
export async function listAuditLogs(actor: AccessActor, filters: AuditListFilters = {}) {
  assertCompanyWrite(actor);
  return listAuditLogsRepo(actor.company_id!, { ...filters, limit: clampLimit(filters.limit) });
}
