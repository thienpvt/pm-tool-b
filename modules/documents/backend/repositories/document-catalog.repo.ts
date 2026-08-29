import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

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

type CatalogDbRow = {
  id: number;
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

function mapCatalogRow(row: CatalogDbRow): DocumentCatalogRow {
  return {
    ...row,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function listDocumentCatalog(companyId: number): Promise<DocumentCatalogRow[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('document_catalog')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('name')
    .execute();
  return rows.map(mapCatalogRow);
}

export async function getDocumentCatalog(
  catalogId: number | string,
): Promise<DocumentCatalogRow | undefined> {
  const db = await getKysely();
  const row = await db
    .selectFrom('document_catalog')
    .selectAll()
    .where('id', '=', Number(catalogId))
    .executeTakeFirst();
  return row ? mapCatalogRow(row) : undefined;
}

export async function insertDocumentCatalog(row: {
  company_id: number;
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  active: boolean;
}): Promise<DocumentCatalogRow> {
  const db = await getKysely();
  const inserted = await db
    .insertInto('document_catalog')
    .values(row)
    .returningAll()
    .executeTakeFirstOrThrow();
  return mapCatalogRow(inserted);
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
  const db = await getKysely();
  await db
    .updateTable('document_catalog')
    .set({
      name: row.name,
      purpose: row.purpose,
      stage: row.stage,
      mandatory: row.mandatory,
      active: row.active,
      updated_at: sql`now()`,
    })
    .where('id', '=', Number(catalogId))
    .execute();
  const updated = await getDocumentCatalog(catalogId);
  if (!updated) throw new Error('Failed to load updated catalog row');
  return updated;
}

/** Active catalog items whose stage is ALL or equals projectStage. Null stage → ALL only. */
export async function listActiveCatalogForStage(
  companyId: number,
  projectStage: string | null,
): Promise<Array<{ id: number; stage: string }>> {
  const db = await getKysely();
  let q = db
    .selectFrom('document_catalog')
    .select(['id', 'stage'])
    .where('company_id', '=', companyId)
    .where('active', '=', true);

  if (projectStage === null) {
    q = q.where('stage', '=', 'ALL');
  } else {
    q = q.where((eb) =>
      eb.or([eb('stage', '=', 'ALL'), eb('stage', '=', projectStage)]),
    );
  }

  return q.orderBy('name').execute();
}
