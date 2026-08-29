import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export async function insertChecklistRowIfMissing(
  projectId: number,
  catalogId: number,
): Promise<number | null> {
  const db = await getKysely();
  const row = await db
    .insertInto('project_document_checklist')
    .values({
      project_id: projectId,
      catalog_id: catalogId,
      status: 'none',
    })
    .onConflict((oc) => oc.columns(['project_id', 'catalog_id']).doNothing())
    .returning('id')
    .executeTakeFirst();
  return row?.id ?? null;
}

export async function listChecklistCatalogIds(projectId: number): Promise<number[]> {
  const db = await getKysely();
  const rows = await db
    .selectFrom('project_document_checklist')
    .select('catalog_id')
    .where('project_id', '=', projectId)
    .execute();
  return rows.map((r) => r.catalog_id);
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

type ChecklistJoinDbRow = {
  id: number;
  project_id: number;
  catalog_id: number;
  status: string;
  confluence_url: string | null;
  approved_at: Date | string | null;
  approved_by: string | null;
  na_reason: string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  catalog_name: string;
  catalog_stage: string;
  catalog_mandatory: boolean;
  catalog_active: boolean;
};

function mapChecklistRow(row: ChecklistJoinDbRow): ChecklistWithCatalogRow {
  const approvedAt =
    row.approved_at == null
      ? null
      : row.approved_at instanceof Date
        ? row.approved_at.toISOString().slice(0, 10)
        : String(row.approved_at);
  return {
    ...row,
    approved_at: approvedAt,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function checklistJoinQuery(db: Awaited<ReturnType<typeof getKysely>>) {
  return db
    .selectFrom('project_document_checklist as c')
    .innerJoin('document_catalog as cat', 'cat.id', 'c.catalog_id')
    .select([
      'c.id',
      'c.project_id',
      'c.catalog_id',
      'c.status',
      'c.confluence_url',
      'c.approved_at',
      'c.approved_by',
      'c.na_reason',
      'c.notes',
      'c.created_at',
      'c.updated_at',
      'cat.name as catalog_name',
      'cat.stage as catalog_stage',
      'cat.mandatory as catalog_mandatory',
      'cat.active as catalog_active',
    ]);
}

export async function listChecklistByProject(
  projectId: number,
): Promise<ChecklistWithCatalogRow[]> {
  const db = await getKysely();
  const rows = await checklistJoinQuery(db)
    .where('c.project_id', '=', projectId)
    .orderBy('cat.name')
    .execute();
  return rows.map(mapChecklistRow);
}

export async function getChecklistItem(
  projectId: number,
  itemId: number,
): Promise<ChecklistWithCatalogRow | undefined> {
  const db = await getKysely();
  const row = await checklistJoinQuery(db)
    .where('c.id', '=', itemId)
    .where('c.project_id', '=', projectId)
    .executeTakeFirst();
  return row ? mapChecklistRow(row) : undefined;
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
  const db = await getKysely();
  const updates: {
    status?: string;
    confluence_url?: string | null;
    approved_at?: string | null;
    approved_by?: string | null;
    na_reason?: string | null;
    notes?: string | null;
    updated_at?: ReturnType<typeof sql>;
  } = {};

  if (fields.status !== undefined) updates.status = fields.status;
  if (fields.confluence_url !== undefined) updates.confluence_url = fields.confluence_url;
  if (fields.approved_at !== undefined) updates.approved_at = fields.approved_at;
  if (fields.approved_by !== undefined) {
    updates.approved_by = fields.approved_by === null ? null : String(fields.approved_by);
  }
  if (fields.na_reason !== undefined) updates.na_reason = fields.na_reason;
  if (fields.notes !== undefined) updates.notes = fields.notes;

  if (Object.keys(updates).length === 0) {
    return getChecklistItem(projectId, itemId);
  }

  updates.updated_at = sql`now()`;

  await db
    .updateTable('project_document_checklist')
    .set(updates)
    .where('id', '=', itemId)
    .where('project_id', '=', projectId)
    .execute();

  return getChecklistItem(projectId, itemId);
}
