import { getDb } from '@/lib/db';

function adminFlag(isAdmin: boolean): number {
  return isAdmin ? 1 : 0;
}

/** Systems visible to a company; resolved admins bypass the company predicate. */
export async function listOperationsSystems(companyId: number | null, isAdmin: boolean) {
  const db = await getDb();
  return db.all(
    `SELECT os.*, p.name AS project_name,
       COALESCE(SUM(obi.planned_amount), 0) AS total_planned,
       COALESCE(SUM(obi.actual_amount), 0) AS total_actual,
       (SELECT COUNT(*) FROM operations_incidents oi
        WHERE oi.operations_system_id = os.id AND oi.status != 'Resolved') AS open_incidents
     FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id
     LEFT JOIN operations_budget_items obi ON obi.operations_system_id = os.id
     WHERE (os.company_id = ? OR ? = 1)
     GROUP BY os.id, p.name ORDER BY os.name`,
    companyId, adminFlag(isAdmin),
  );
}

export async function findOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  return db.get<{ id: number }>(
    'SELECT id FROM operations_systems WHERE id = ? AND (company_id = ? OR ? = 1)',
    systemId, companyId, adminFlag(isAdmin),
  );
}

export async function getOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  return db.get(
    `SELECT os.*, p.name AS project_name FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id
     WHERE os.id = ? AND (os.company_id = ? OR ? = 1)`,
    systemId, companyId, adminFlag(isAdmin),
  );
}

export async function createOperationsSystem(companyId: number | null, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO operations_systems
       (company_id, project_id, name, description, go_live_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    companyId, body.project_id || null, body.name, body.description || '',
    body.go_live_date || null, body.status || 'active',
  );
  return db.get('SELECT * FROM operations_systems WHERE id = ?', r.lastInsertRowid);
}

export async function updateOperationsSystem(systemId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  await db.run(
    `UPDATE operations_systems SET name=?, description=?, project_id=?, go_live_date=?, status=?
     WHERE id=?`,
    body.name, body.description, body.project_id || null, body.go_live_date || null,
    body.status, systemId,
  );
  return db.get(
    `SELECT os.*, p.name AS project_name FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id WHERE os.id = ?`,
    systemId,
  );
}

export async function deleteOperationsSystem(
  systemId: number | string,
  companyId: number | null,
  isAdmin: boolean,
) {
  const db = await getDb();
  return db.run(
    'DELETE FROM operations_systems WHERE id = ? AND (company_id = ? OR ? = 1)',
    systemId, companyId, adminFlag(isAdmin),
  );
}

export async function listOperationsBudgetItems(systemId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM operations_budget_items WHERE operations_system_id = ? ORDER BY category, name',
    systemId,
  );
}

export async function createOperationsBudgetItem(systemId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO operations_budget_items
       (operations_system_id, category, name, planned_amount, actual_amount, unit, period_label, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    systemId, body.category || 'OPEX', body.name, body.planned_amount || 0,
    body.actual_amount || 0, body.unit || 'VND/month', body.period_label || '', body.notes || '',
  );
  return db.get('SELECT * FROM operations_budget_items WHERE id = ?', r.lastInsertRowid);
}

export async function updateOperationsBudgetItem(
  systemId: number | string,
  itemId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  await db.run(
    `UPDATE operations_budget_items
     SET category=?, name=?, planned_amount=?, actual_amount=?, unit=?, period_label=?, notes=?
     WHERE id=? AND operations_system_id=?`,
    body.category, body.name, body.planned_amount, body.actual_amount, body.unit,
    body.period_label, body.notes, itemId, systemId,
  );
  return db.get('SELECT * FROM operations_budget_items WHERE id = ?', itemId);
}

export async function deleteOperationsBudgetItem(systemId: number | string, itemId: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM operations_budget_items WHERE id = ? AND operations_system_id = ?',
    itemId, systemId,
  );
}

export async function listOperationsExpenses(systemId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM operations_expenses WHERE operations_system_id = ? ORDER BY expense_date DESC',
    systemId,
  );
}

export async function createOperationsExpense(systemId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO operations_expenses
       (operations_system_id, expense_date, category, description, amount, reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    systemId, body.expense_date || new Date().toISOString().split('T')[0],
    body.category || 'OPEX', body.description || '', body.amount || 0, body.reference || '',
  );
  return db.get('SELECT * FROM operations_expenses WHERE id = ?', r.lastInsertRowid);
}

export async function deleteOperationsExpense(systemId: number | string, expenseId: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM operations_expenses WHERE id = ? AND operations_system_id = ?',
    expenseId, systemId,
  );
}

export async function listOperationsIncidents(systemId: number | string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM operations_incidents WHERE operations_system_id = ? ORDER BY reported_at DESC',
    systemId,
  );
}

export async function createOperationsIncident(systemId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const r = await db.run(
    `INSERT INTO operations_incidents
       (operations_system_id, title, severity, description, reported_at, resolved_at, cost_impact, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    systemId, body.title, body.severity || 'Medium', body.description || '',
    body.reported_at || new Date().toISOString().split('T')[0], body.resolved_at || null,
    body.cost_impact || 0, body.status || 'Open',
  );
  return db.get('SELECT * FROM operations_incidents WHERE id = ?', r.lastInsertRowid);
}

export async function updateOperationsIncident(
  systemId: number | string,
  incidentId: number | string,
  body: Record<string, unknown>,
) {
  const db = await getDb();
  await db.run(
    `UPDATE operations_incidents
     SET title=?, severity=?, description=?, reported_at=?, resolved_at=?, cost_impact=?, status=?
     WHERE id=? AND operations_system_id=?`,
    body.title, body.severity, body.description, body.reported_at, body.resolved_at || null,
    body.cost_impact, body.status, incidentId, systemId,
  );
  return db.get('SELECT * FROM operations_incidents WHERE id = ?', incidentId);
}

export async function deleteOperationsIncident(systemId: number | string, incidentId: number | string) {
  const db = await getDb();
  return db.run(
    'DELETE FROM operations_incidents WHERE id = ? AND operations_system_id = ?',
    incidentId, systemId,
  );
}
