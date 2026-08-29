import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

type OperationsSystemListRow = {
  id: number;
  company_id: number | null;
  project_id: number | null;
  name: string;
  description: string | null;
  go_live_date: string | null;
  status: string;
  created_at: Date;
  project_name: string | null;
  total_planned: number;
  total_actual: number;
  open_incidents: number;
};

/** Systems visible to a company; resolved admins bypass the company predicate. */
export async function listOperationsSystems(companyId: number | null, isAdmin: boolean) {
  const db = await getKysely();
  const adminFlag = isAdmin ? 1 : 0;
  const result = await sql<OperationsSystemListRow>`
    SELECT os.*, p.name AS project_name,
       COALESCE(SUM(obi.planned_amount), 0) AS total_planned,
       COALESCE(SUM(obi.actual_amount), 0) AS total_actual,
       (SELECT COUNT(*)::int FROM operations_incidents oi
        WHERE oi.operations_system_id = os.id AND oi.status != 'Resolved') AS open_incidents
     FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id
     LEFT JOIN operations_budget_items obi ON obi.operations_system_id = os.id
     WHERE (os.company_id = ${companyId} OR ${adminFlag} = 1)
     GROUP BY os.id, p.name ORDER BY os.name
  `.execute(db);
  return result.rows;
}

export async function findOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getKysely();
  let q = db
    .selectFrom('operations_systems')
    .select(['id'])
    .where('id', '=', Number(systemId));
  if (!isAdmin) {
    q = q.where('company_id', '=', companyId);
  }
  return q.executeTakeFirst();
}

export async function getOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getKysely();
  let q = db
    .selectFrom('operations_systems as os')
    .leftJoin('projects as p', 'p.id', 'os.project_id')
    .selectAll('os')
    .select('p.name as project_name')
    .where('os.id', '=', Number(systemId));
  if (!isAdmin) {
    q = q.where('os.company_id', '=', companyId);
  }
  return q.executeTakeFirst();
}

export async function createOperationsSystem(companyId: number | null, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('operations_systems')
    .values({
      company_id: companyId,
      project_id: body.project_id != null ? Number(body.project_id) : null,
      name: String(body.name),
      description: body.description != null ? String(body.description) : '',
      go_live_date: body.go_live_date != null ? String(body.go_live_date) : null,
      status: body.status != null ? String(body.status) : 'active',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateOperationsSystem(systemId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  await db
    .updateTable('operations_systems')
    .set({
      name: String(body.name),
      description: body.description != null ? String(body.description) : '',
      project_id: body.project_id != null ? Number(body.project_id) : null,
      go_live_date: body.go_live_date != null ? String(body.go_live_date) : null,
      status: String(body.status),
    })
    .where('id', '=', Number(systemId))
    .execute();
  return db
    .selectFrom('operations_systems as os')
    .leftJoin('projects as p', 'p.id', 'os.project_id')
    .selectAll('os')
    .select('p.name as project_name')
    .where('os.id', '=', Number(systemId))
    .executeTakeFirst();
}

export async function deleteOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getKysely();
  let q = db.deleteFrom('operations_systems').where('id', '=', Number(systemId));
  if (!isAdmin) {
    q = q.where('company_id', '=', companyId);
  }
  const result = await q.execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}

export async function listOperationsBudgetItems(systemId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('operations_budget_items')
    .selectAll()
    .where('operations_system_id', '=', Number(systemId))
    .orderBy('category')
    .orderBy('name')
    .execute();
}

export async function createOperationsBudgetItem(systemId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('operations_budget_items')
    .values({
      operations_system_id: Number(systemId),
      category: body.category != null ? String(body.category) : 'OPEX',
      name: String(body.name),
      planned_amount: body.planned_amount != null ? Number(body.planned_amount) : 0,
      actual_amount: body.actual_amount != null ? Number(body.actual_amount) : 0,
      unit: body.unit != null ? String(body.unit) : 'VND/month',
      period_label: body.period_label != null ? String(body.period_label) : '',
      notes: body.notes != null ? String(body.notes) : '',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateOperationsBudgetItem(
  systemId: number | string,
  itemId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  return db
    .updateTable('operations_budget_items')
    .set({
      category: String(body.category),
      name: String(body.name),
      planned_amount: Number(body.planned_amount),
      actual_amount: Number(body.actual_amount),
      unit: String(body.unit),
      period_label: String(body.period_label),
      notes: String(body.notes),
    })
    .where('id', '=', Number(itemId))
    .where('operations_system_id', '=', Number(systemId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteOperationsBudgetItem(systemId: number | string, itemId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('operations_budget_items')
    .where('id', '=', Number(itemId))
    .where('operations_system_id', '=', Number(systemId))
    .execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}

export async function listOperationsExpenses(systemId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('operations_expenses')
    .selectAll()
    .where('operations_system_id', '=', Number(systemId))
    .orderBy('expense_date', 'desc')
    .execute();
}

export async function createOperationsExpense(systemId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('operations_expenses')
    .values({
      operations_system_id: Number(systemId),
      expense_date:
        body.expense_date != null
          ? String(body.expense_date)
          : new Date().toISOString().split('T')[0],
      category: body.category != null ? String(body.category) : 'OPEX',
      description: body.description != null ? String(body.description) : '',
      amount: body.amount != null ? Number(body.amount) : 0,
      reference: body.reference != null ? String(body.reference) : '',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteOperationsExpense(systemId: number | string, expenseId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('operations_expenses')
    .where('id', '=', Number(expenseId))
    .where('operations_system_id', '=', Number(systemId))
    .execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}

export async function listOperationsIncidents(systemId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('operations_incidents')
    .selectAll()
    .where('operations_system_id', '=', Number(systemId))
    .orderBy('reported_at', 'desc')
    .execute();
}

export async function createOperationsIncident(systemId: number | string, body: Record<string, unknown>) {
  const db = await getKysely();
  return db
    .insertInto('operations_incidents')
    .values({
      operations_system_id: Number(systemId),
      title: String(body.title),
      severity: body.severity != null ? String(body.severity) : 'Medium',
      description: body.description != null ? String(body.description) : '',
      reported_at:
        body.reported_at != null
          ? String(body.reported_at)
          : new Date().toISOString().split('T')[0],
      resolved_at: body.resolved_at != null ? String(body.resolved_at) : null,
      cost_impact: body.cost_impact != null ? Number(body.cost_impact) : 0,
      status: body.status != null ? String(body.status) : 'Open',
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateOperationsIncident(
  systemId: number | string,
  incidentId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getKysely();
  return db
    .updateTable('operations_incidents')
    .set({
      title: String(body.title),
      severity: String(body.severity),
      description: String(body.description),
      reported_at: String(body.reported_at),
      resolved_at: body.resolved_at != null ? String(body.resolved_at) : null,
      cost_impact: Number(body.cost_impact),
      status: String(body.status),
    })
    .where('id', '=', Number(incidentId))
    .where('operations_system_id', '=', Number(systemId))
    .returningAll()
    .executeTakeFirst();
}

export async function deleteOperationsIncident(systemId: number | string, incidentId: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('operations_incidents')
    .where('id', '=', Number(incidentId))
    .where('operations_system_id', '=', Number(systemId))
    .execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}
