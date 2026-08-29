import { sql, type Insertable } from 'kysely';
import type { Database } from '@/lib/db/database';
import { getKysely } from '@/lib/db/kysely';

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
  const db = await getKysely();
  await db
    .insertInto('audit_logs')
    .values({
      actor_id: input.actor_id,
      company_id: input.company_id,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      action: input.action,
      before: input.before === null ? null : JSON.stringify(input.before),
      after: input.after === null ? null : JSON.stringify(input.after),
    } as Insertable<Database['audit_logs']>)
    .execute();
}

/** Company-scoped SELECT only — append-only alongside insertAuditLog (D-04, D-05). */
export async function listAuditLogs(
  companyId: number,
  filters: AuditListFilters = {},
): Promise<AuditLogRow[]> {
  const db = await getKysely();
  const limit = filters.limit ?? 50;

  let q = db
    .selectFrom('audit_logs')
    .select([
      'id',
      'company_id',
      'actor_id',
      'entity_type',
      'entity_id',
      'action',
      'before',
      'after',
      'created_at',
    ])
    .where('company_id', '=', companyId);

  if (filters.entity_type) {
    q = q.where('entity_type', '=', filters.entity_type);
  }
  if (filters.entity_id) {
    q = q.where('entity_id', '=', filters.entity_id);
  }
  if (filters.from) {
    q = q.where('created_at', '>=', new Date(`${filters.from}T00:00:00.000Z`));
  }
  if (filters.to) {
    const endExclusive = new Date(`${filters.to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    q = q.where('created_at', '<', endExclusive);
  }

  const rows = await q
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();

  return rows.map((row) => ({
    ...row,
    actor_id: row.actor_id ?? 0,
    entity_type: row.entity_type ?? '',
    entity_id: row.entity_id ?? '',
    action: row.action ?? '',
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}
