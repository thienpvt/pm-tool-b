import { getDb } from '@/lib/db';

export async function insertChecklistRowIfMissing(
  projectId: number,
  catalogId: number,
): Promise<number | null> {
  const db = await getDb();
  const row = await db.get<{ id: number }>(
    `INSERT INTO project_document_checklist (project_id, catalog_id, status)
     VALUES (?, ?, 'none')
     ON CONFLICT (project_id, catalog_id) DO NOTHING
     RETURNING id`,
    projectId,
    catalogId,
  );
  return row?.id ?? null;
}

export async function listChecklistCatalogIds(projectId: number): Promise<number[]> {
  const db = await getDb();
  const rows = await db.all<{ catalog_id: number }>(
    `SELECT catalog_id FROM project_document_checklist WHERE project_id = ?`,
    projectId,
  );
  return rows.map(r => r.catalog_id);
}

export type ChecklistWithCatalogRow = {
  id: number;
  project_id: number;
  catalog_id: number;
  status: string;
  confluence_url: string | null;
  approved_at: string | null;
  approved_by: string | null;
  na_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  catalog_name: string;
  catalog_stage: string;
  catalog_mandatory: boolean;
  catalog_active: boolean;
};

export async function listChecklistByProject(
  projectId: number,
): Promise<ChecklistWithCatalogRow[]> {
  const db = await getDb();
  return db.all(
    `SELECT c.id, c.project_id, c.catalog_id, c.status, c.confluence_url,
            c.approved_at, c.approved_by, c.na_reason, c.notes,
            c.created_at, c.updated_at,
            cat.name AS catalog_name, cat.stage AS catalog_stage,
            cat.mandatory AS catalog_mandatory, cat.active AS catalog_active
     FROM project_document_checklist c
     JOIN document_catalog cat ON cat.id = c.catalog_id
     WHERE c.project_id = ?
     ORDER BY cat.name`,
    projectId,
  );
}

export async function getChecklistItem(
  projectId: number,
  itemId: number,
): Promise<ChecklistWithCatalogRow | undefined> {
  const db = await getDb();
  return db.get<ChecklistWithCatalogRow>(
    `SELECT c.id, c.project_id, c.catalog_id, c.status, c.confluence_url,
            c.approved_at, c.approved_by, c.na_reason, c.notes,
            c.created_at, c.updated_at,
            cat.name AS catalog_name, cat.stage AS catalog_stage,
            cat.mandatory AS catalog_mandatory, cat.active AS catalog_active
     FROM project_document_checklist c
     JOIN document_catalog cat ON cat.id = c.catalog_id
     WHERE c.id = ? AND c.project_id = ?`,
    itemId,
    projectId,
  );
}

export async function updateChecklistItem(
  projectId: number,
  itemId: number,
  fields: {
    status?: string;
    confluence_url?: string | null;
    approved_at?: string | null;
    approved_by?: string | number | null;
    na_reason?: string | null;
    notes?: string | null;
  },
): Promise<ChecklistWithCatalogRow | undefined> {
  const db = await getDb();
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.status !== undefined) {
    sets.push('status = ?');
    params.push(fields.status);
  }
  if (fields.confluence_url !== undefined) {
    sets.push('confluence_url = ?');
    params.push(fields.confluence_url);
  }
  if (fields.approved_at !== undefined) {
    sets.push('approved_at = ?');
    params.push(fields.approved_at);
  }
  if (fields.approved_by !== undefined) {
    sets.push('approved_by = ?');
    params.push(fields.approved_by === null ? null : String(fields.approved_by));
  }
  if (fields.na_reason !== undefined) {
    sets.push('na_reason = ?');
    params.push(fields.na_reason);
  }
  if (fields.notes !== undefined) {
    sets.push('notes = ?');
    params.push(fields.notes);
  }

  if (sets.length === 0) {
    return getChecklistItem(projectId, itemId);
  }

  sets.push('updated_at = now()');
  params.push(itemId, projectId);

  await db.run(
    `UPDATE project_document_checklist SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
    ...params,
  );

  return getChecklistItem(projectId, itemId);
}
