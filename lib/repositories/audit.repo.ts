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
