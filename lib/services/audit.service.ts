import { insertAuditLog, type AuditLogInput } from '@/lib/repositories/audit.repo';

export type { AuditLogInput };

/** Append-only audit log INSERT (D-08). No update or delete helpers. */
export async function auditLog(input: AuditLogInput): Promise<void> {
  await insertAuditLog(input);
}
