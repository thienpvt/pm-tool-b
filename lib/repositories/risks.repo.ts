import { getDb } from '@/lib/db';
import { buildUpdate } from './_helpers';

/**
 * Updatable columns for `risks`. `priority`, `impact` and `affected_activity_id` are
 * migration-added — see ALLOWLIST-DIFF.md.
 */
export const RISK_COLUMNS = [
  'risk_id', 'code', 'description', 'category', 'owner', 'trigger', 'mitigation', 'due_date',
  'status', 'priority', 'impact', 'affected_activity_id',
] as const;

function raidTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const RAID_IS_OVERDUE = `(due_date < ? AND status IN ('Open','In Progress')) AS is_overdue`;

const RAID_OPEN_ORDER = `
  CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
  CASE WHEN (due_date < ? AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END,
  due_date NULLS LAST,
  id`;

const RAID_ALL_ORDER = `
  CASE WHEN status IN ('Open','In Progress') THEN 0 ELSE 1 END,
  CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END,
  CASE WHEN (due_date < ? AND status IN ('Open','In Progress')) THEN 0 ELSE 1 END,
  due_date NULLS LAST,
  id`;

export async function listRisks(projectId: number | string) {
  const db = await getDb();
  const today = raidTodayUtc();
  return db.all(
    `SELECT *, ${RAID_IS_OVERDUE} FROM risks WHERE project_id = ? ORDER BY ${RAID_ALL_ORDER}`,
    today,
    projectId,
    today,
  );
}

export async function countRisks(projectId: number | string): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ c: number }>('SELECT COUNT(*) as c FROM risks WHERE project_id = ?', projectId);
  return Number(row?.c ?? 0);
}

export async function getRisk(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.get('SELECT * FROM risks WHERE id = ? AND project_id = ?', rowId, projectId);
}

export async function findRiskByCode(
  projectId: number | string,
  code: string,
  excludeId?: number | string,
) {
  const db = await getDb();
  return db.get<{ id: number }>(
    `SELECT id FROM risks
     WHERE project_id = ? AND LOWER(code) = LOWER(?)
       AND id != COALESCE(?, -1)
     LIMIT 1`,
    projectId,
    code,
    excludeId ?? null,
  );
}

async function nextAutoRiskCode(projectId: number | string): Promise<string> {
  const db = await getDb();
  const rows = await db.all<{ code: string }>(
    `SELECT code FROM risks WHERE project_id = ? AND code ~ '^R-[0-9]+$'`,
    projectId,
  );
  let max = 0;
  for (const row of rows) {
    const m = /^R-(\d+)$/.exec(row.code);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max > 0 ? max + 1 : (await countRisks(projectId)) + 1;
  return `R-${String(next).padStart(3, '0')}`;
}

export async function createRisk(projectId: number | string, body: Record<string, unknown>) {
  const db = await getDb();
  const b = body as Record<string, never>;
  let code = typeof b.code === 'string' ? b.code.trim() : '';
  if (!code) {
    do {
      code = await nextAutoRiskCode(projectId);
    } while (await findRiskByCode(projectId, code));
  }
  const riskId = b.risk_id || code;
  const r = await db.run(
    `INSERT INTO risks (project_id, risk_id, code, description, category, owner, trigger, mitigation, due_date, status, priority, impact, affected_activity_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    projectId, riskId, code, b.description ?? '', b.category ?? '', b.owner ?? '', b.trigger ?? '',
    b.mitigation ?? '', b.due_date ?? '', b.status ?? 'Open', b.priority ?? 'Medium',
    b.impact ?? 'Major', b.affected_activity_id ?? null);
  return db.get('SELECT * FROM risks WHERE id = ?', r.lastInsertRowid);
}

/** @throws UnknownColumnError when `fields` names a column outside RISK_COLUMNS. */
export async function updateRisk(
  projectId: number | string,
  rowId: number | string,
  fields: Record<string, unknown>,
) {
  const { sql, values } = buildUpdate('risks', RISK_COLUMNS, fields);
  const db = await getDb();
  return db.get(
    `UPDATE risks SET ${sql} WHERE id = ? AND project_id = ? RETURNING *`,
    ...values, rowId, projectId,
  );
}

export async function deactivateRisk(projectId: number | string, rowId: number | string) {
  const db = await getDb();
  return db.get(
    `UPDATE risks SET status = 'deactivated', deactivated_at = now()
     WHERE id = ? AND project_id = ? RETURNING *`,
    rowId, projectId,
  );
}

/** Open risks for the weekly report: status Open or In Progress, ordered by priority severity with overdue first (D-07). */
export async function listOpenRisks(projectId: number | string) {
  const db = await getDb();
  const today = raidTodayUtc();
  return db.all(
    `SELECT *, ${RAID_IS_OVERDUE} FROM risks
     WHERE project_id = ? AND (status='Open' OR status='In Progress')
     ORDER BY ${RAID_OPEN_ORDER}`,
    today,
    projectId,
    today,
  );
}

/**
 * Everything not Closed, ordered by priority severity rather than alphabetically.
 * The CASE ordering is the project-report page's existing behavior — preserved verbatim.
 */
export async function listNotClosedByPriority(projectId: number | string) {
  const db = await getDb();
  return db.all(
    `SELECT * FROM risks WHERE project_id = ? AND status != 'Closed'
     ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, id`,
    projectId,
  );
}

/** High Open/In Progress risks and issues company-wide; record count not distinct projects (D-08). */
export async function listHighOpenRaid(companyId: number | null) {
  const db = await getDb();
  const riskSelect = `
    SELECT 'risk' AS entity_type, r.*, p.name AS project_name
    FROM risks r
    JOIN projects p ON p.id = r.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE r.priority = 'High' AND r.status IN ('Open','In Progress')`;
  const issueSelect = `
    SELECT 'issue' AS entity_type, i.*, p.name AS project_name
    FROM issues i
    JOIN projects p ON p.id = i.project_id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE i.priority = 'High' AND i.status IN ('Open','In Progress')`;
  if (companyId !== null) {
    return db.all(
      `${riskSelect} AND (p.company_id = ? OR c.company_id = ?)
       UNION ALL
       ${issueSelect} AND (p.company_id = ? OR c.company_id = ?)
       ORDER BY project_name, entity_type, id`,
      companyId, companyId, companyId, companyId,
    );
  }
  return db.all(
    `${riskSelect} AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
     UNION ALL
     ${issueSelect} AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)
     ORDER BY project_name, entity_type, id`,
  );
}
