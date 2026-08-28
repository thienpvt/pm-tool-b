import { getDb } from '@/lib/db';

export type DocumentTemplateRow = {
  id: number;
  catalog_id: number;
  company_id: number;
  name: string;
  document_type: string;
  version: number;
  effective_date: string;
  guidance: string;
  template_url: string | null;
  retired_at: string | null;
  created_at: string;
};

const TEMPLATE_FIELDS = `id, catalog_id, company_id, name, document_type, version,
  effective_date, guidance, template_url, retired_at, created_at`;

export async function getDocumentTemplate(
  templateId: number | string,
): Promise<DocumentTemplateRow | undefined> {
  const db = await getDb();
  return db.get<DocumentTemplateRow>(
    `SELECT ${TEMPLATE_FIELDS} FROM document_templates WHERE id = ?`,
    templateId,
  );
}

export async function getMaxVersion(catalogId: number): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ max_version: number | null }>(
    `SELECT MAX(version) AS max_version FROM document_templates WHERE catalog_id = ?`,
    catalogId,
  );
  return row?.max_version ?? 0;
}

export async function retireCurrentTemplate(
  catalogId: number,
  companyId: number,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE document_templates
     SET retired_at = now()
     WHERE catalog_id = ? AND company_id = ? AND retired_at IS NULL`,
    catalogId,
    companyId,
  );
}

export async function insertDocumentTemplate(row: {
  catalog_id: number;
  company_id: number;
  name: string;
  document_type: string;
  version: number;
  effective_date: string;
  guidance: string;
  template_url: string;
}): Promise<DocumentTemplateRow> {
  const db = await getDb();
  const id = await db.run(
    `INSERT INTO document_templates
       (catalog_id, company_id, name, document_type, version, effective_date, guidance, template_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.catalog_id,
    row.company_id,
    row.name,
    row.document_type,
    row.version,
    row.effective_date,
    row.guidance,
    row.template_url,
  );
  const created = await getDocumentTemplate(Number(id.lastInsertRowid));
  if (!created) throw new Error('Failed to load inserted template row');
  return created;
}

export async function listEffectiveTemplates(
  companyId: number,
  catalogId?: number,
): Promise<DocumentTemplateRow[]> {
  const db = await getDb();
  if (catalogId !== undefined) {
    return db.all<DocumentTemplateRow>(
      `SELECT ${TEMPLATE_FIELDS}
       FROM document_templates
       WHERE company_id = ? AND catalog_id = ?
         AND retired_at IS NULL AND effective_date <= CURRENT_DATE
       ORDER BY version DESC
       LIMIT 1`,
      companyId,
      catalogId,
    );
  }
  return db.all<DocumentTemplateRow>(
    `SELECT DISTINCT ON (catalog_id) ${TEMPLATE_FIELDS}
     FROM document_templates
     WHERE company_id = ?
       AND retired_at IS NULL AND effective_date <= CURRENT_DATE
     ORDER BY catalog_id, version DESC`,
    companyId,
  );
}

export async function retireTemplateById(
  templateId: number | string,
): Promise<DocumentTemplateRow> {
  const db = await getDb();
  await db.run(
    `UPDATE document_templates SET retired_at = now() WHERE id = ? AND retired_at IS NULL`,
    templateId,
  );
  const updated = await getDocumentTemplate(templateId);
  if (!updated) throw new Error('Failed to load retired template row');
  return updated;
}
