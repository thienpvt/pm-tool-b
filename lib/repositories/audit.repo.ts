import { getDb } from '@/lib/db';

export type AuditLogInput = {
  actor_id: number;
  company_id: number | null;
  entity_type: string;
  entity_id: string;
  action: string;
  before: unknown;
  after: unknown;
};

export type AuditListFilters = {
  entity_type?: string;
  entity_id?: string;
  from?: string;
  to?: string;
  limit?: number;
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

export async function insertAuditLog(input: AuditLogInput): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO audit_logs (actor_id, company_id, entity_type, entity_id, action, before, after)
     VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb)`,
    input.actor_id,
    input.company_id,
    input.entity_type,
    input.entity_id,
    input.action,
    input.before === null ? null : JSON.stringify(input.before),
    input.after === null ? null : JSON.stringify(input.after),
  );
}

/** Company-scoped SELECT only — append-only alongside insertAuditLog (D-04, D-05). */
export async function listAuditLogs(
  companyId: number,
  filters: AuditListFilters = {},
): Promise<AuditLogRow[]> {
  const db = await getDb();
  const conditions = ['company_id = ?'];
  const params: unknown[] = [companyId];

  if (filters.entity_type) {
    conditions.push('entity_type = ?');
    params.push(filters.entity_type);
  }
  if (filters.entity_id) {
    conditions.push('entity_id = ?');
    params.push(filters.entity_id);
  }
  if (filters.from) {
    conditions.push('created_at >= ?::date');
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push('created_at < (?::date + INTERVAL \'1 day\')');
    params.push(filters.to);
  }

  const limit = filters.limit ?? 50;
  params.push(limit);

  const rows = await db.all<AuditLogRow>(
    `SELECT id, company_id, actor_id, entity_type, entity_id, action, before, after, created_at
     FROM audit_logs
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    ...params,
  );
  return rows;
}
