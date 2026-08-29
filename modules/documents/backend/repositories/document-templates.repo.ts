import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

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

type TemplateDbRow = {
  id: number;
  catalog_id: number;
  company_id: number;
  name: string;
  document_type: string;
  version: number;
  effective_date: Date | string;
  guidance: string;
  template_url: string | null;
  retired_at: Date | string | null;
  created_at: Date | string;
};

function mapTemplateRow(row: TemplateDbRow): DocumentTemplateRow {
  const effectiveDate =
    row.effective_date instanceof Date
      ? row.effective_date.toISOString().slice(0, 10)
      : String(row.effective_date);
  return {
    ...row,
    effective_date: effectiveDate,
    retired_at:
      row.retired_at == null
        ? null
        : row.retired_at instanceof Date
          ? row.retired_at.toISOString()
          : String(row.retired_at),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function getDocumentTemplate(
  templateId: number | string,
): Promise<DocumentTemplateRow | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('document_templates')
    .selectAll()
    .where('id', '=', Number(templateId))
    .executeTakeFirst();
  return row ? mapTemplateRow(row) : undefined;
}

export async function getMaxVersion(catalogId: number): Promise<number> {
  const db = await getKysely();
  const row = await db
    .selectFrom('document_templates')
    .select((eb) => eb.fn.max('version').as('max_version'))
    .where('catalog_id', '=', catalogId)
    .executeTakeFirst();
  return row?.max_version ?? 0;
}

export async function retireCurrentTemplate(
  catalogId: number,
  companyId: number,
): Promise<void> {
  const db = await getKysely();
  await db
    .updateTable('document_templates')
    .set({ retired_at: sql`now()` })
    .where('catalog_id', '=', catalogId)
    .where('company_id', '=', companyId)
    .where('retired_at', 'is', null)
    .execute();
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
  const db = await getKysely();
  const inserted = await db
    .insertInto('document_templates')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();
  return mapTemplateRow(inserted);
}

export async function listEffectiveTemplates(
  companyId: number,
  catalogId?: number,
): Promise<DocumentTemplateRow[]> {
  const db = await getKysely();
  if (catalogId !== undefined) {
    const result = await sql<TemplateDbRow>`
      SELECT id, catalog_id, company_id, name, document_type, version,
             effective_date, guidance, template_url, retired_at, created_at
      FROM document_templates
      WHERE company_id = ${companyId}
        AND catalog_id = ${catalogId}
        AND retired_at IS NULL
        AND effective_date <= CURRENT_DATE
      ORDER BY version DESC
      LIMIT 1
    `.execute(db);
    return result.rows.map(mapTemplateRow);
  }
  const result = await sql<TemplateDbRow>`
    SELECT DISTINCT ON (catalog_id)
           id, catalog_id, company_id, name, document_type, version,
           effective_date, guidance, template_url, retired_at, created_at
    FROM document_templates
    WHERE company_id = ${companyId}
      AND retired_at IS NULL
      AND effective_date <= CURRENT_DATE
    ORDER BY catalog_id, version DESC
  `.execute(db);
  return result.rows.map(mapTemplateRow);
}

export async function retireTemplateById(
  templateId: number | string,
): Promise<DocumentTemplateRow> {
  const db = await getKysely();
  await db
    .updateTable('document_templates')
    .set({ retired_at: sql`now()` })
    .where('id', '=', Number(templateId))
    .where('retired_at', 'is', null)
    .execute();
  const updated = await getDocumentTemplate(templateId);
  if (!updated) throw new Error('Failed to load retired template row');
  return updated;
}
