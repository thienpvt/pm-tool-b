import {
  insertAuditLog,
  listAuditLogs as listAuditLogsRepo,
  type AuditListFilters,
  type AuditLogInput,
} from '@/lib/repositories/audit.repo';
import { parseIsoDate } from '@/lib/fiscal/iso-date';
import { assertCompanyWrite, type AccessActor } from './access';

export type { AuditLogInput, AuditListFilters };

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit) || limit < 1) return 50;
  return Math.min(Math.floor(limit), 200);
}

function parseDateFilters(filters: AuditListFilters): AuditListFilters {
  const parsed: AuditListFilters = { ...filters, limit: clampLimit(filters.limit) };
  if (filters.from !== undefined) {
    parsed.from = parseIsoDate(filters.from, 'from');
  }
  if (filters.to !== undefined) {
    parsed.to = parseIsoDate(filters.to, 'to');
  }
  return parsed;
}

/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}

/** Company-scoped audit read — CPMO with non-null company_id only (D-05, D-06). */
export async function listAuditLogs(actor: AccessActor, filters: AuditListFilters = {}) {
  assertCompanyWrite(actor);
  const parsed = parseDateFilters(filters);
  return listAuditLogsRepo(actor.company_id!, parsed);
}
