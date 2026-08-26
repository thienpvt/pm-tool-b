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
