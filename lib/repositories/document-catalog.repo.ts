import { getDb } from '@/lib/db';

export type DocumentCatalogRow = {
  id: number;
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const CATALOG_FIELDS = `id, company_id, name, purpose, stage, mandatory, active, created_at, updated_at`;

export async function listDocumentCatalog(companyId: number): Promise<DocumentCatalogRow[]> {
  const db = await getDb();
  return db.all<DocumentCatalogRow>(
    `SELECT ${CATALOG_FIELDS} FROM document_catalog WHERE company_id = ? ORDER BY name`,
    companyId,
  );
}

export async function getDocumentCatalog(
  catalogId: number | string,
): Promise<DocumentCatalogRow | undefined> {
  const db = await getDb();
  return db.get<DocumentCatalogRow>(
    `SELECT ${CATALOG_FIELDS} FROM document_catalog WHERE id = ?`,
    catalogId,
  );
}

export async function insertDocumentCatalog(row: {
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
}): Promise<DocumentCatalogRow> {
  const db = await getDb();
  const id = await db.run(
    `INSERT INTO document_catalog (company_id, name, purpose, stage, mandatory, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    row.company_id,
    row.name,
    row.purpose,
    row.stage,
    row.mandatory,
    row.active,
  );
  const created = await getDocumentCatalog(Number(id.lastInsertRowid));
  if (!created) throw new Error('Failed to load inserted catalog row');
  return created;
}

export async function updateDocumentCatalog(
  catalogId: number | string,
  row: {
    name: string;
    purpose: string;
    stage: string;
    mandatory: boolean;
    active: boolean;
  },
): Promise<DocumentCatalogRow> {
  const db = await getDb();
  await db.run(
    `UPDATE document_catalog
     SET name = ?, purpose = ?, stage = ?, mandatory = ?, active = ?, updated_at = now()
     WHERE id = ?`,
    row.name,
    row.purpose,
    row.stage,
    row.mandatory,
    row.active,
    catalogId,
  );
  const updated = await getDocumentCatalog(catalogId);
  if (!updated) throw new Error('Failed to load updated catalog row');
  return updated;
}

/** Active catalog items whose stage is ALL or equals projectStage. Null stage → ALL only. */
export async function listActiveCatalogForStage(
  companyId: number,
  projectStage: string | null,
): Promise<Array<{ id: number; stage: string }>> {
  const db = await getDb();
  if (projectStage === null) {
    return db.all(
      `SELECT id, stage FROM document_catalog
       WHERE company_id = ? AND active = TRUE AND stage = 'ALL'
       ORDER BY name`,
      companyId,
    );
  }
  return db.all(
    `SELECT id, stage FROM document_catalog
     WHERE company_id = ? AND active = TRUE AND (stage = 'ALL' OR stage = ?)
     ORDER BY name`,
    companyId,
    projectStage,
  );
}
