import { getKysely } from '@/lib/db/kysely';

/**
 * Saved column-mapping templates for the two import paths:
 * `timeline_import_mappings` (activity/timeline import) and `bug_import_mappings`
 * (bug snapshot import).
 *
 * Timeline and bug mappings are company-scoped (Phase 9 TENANT-01).
 */

// ── Timeline mappings (company-scoped) ────────────────────────────────────────

export async function listTimelineMappings(companyId: number) {
  const db = await getKysely();
  return db
    .selectFrom('timeline_import_mappings')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getTimelineMappingById(id: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('timeline_import_mappings')
    .selectAll()
    .where('id', '=', Number(id))
    .executeTakeFirst();
}

export async function findTimelineMappingByName(companyId: number, name: string) {
  const db = await getKysely();
  return db
    .selectFrom('timeline_import_mappings')
    .selectAll()
    .where('company_id', '=', companyId)
    .where('name', '=', name)
    .executeTakeFirst();
}

export async function createTimelineMapping(companyId: number, name: string, mappingsJson: string) {
  const db = await getKysely();
  return db
    .insertInto('timeline_import_mappings')
    .values({ name, mappings_json: mappingsJson, company_id: companyId })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function updateTimelineMapping(
  companyId: number,
  id: number | string,
  name: string,
  mappingsJson: string,
) {
  const db = await getKysely();
  return db
    .updateTable('timeline_import_mappings')
    .set({ name, mappings_json: mappingsJson })
    .where('id', '=', Number(id))
    .where('company_id', '=', companyId)
    .returningAll()
    .executeTakeFirst();
}

export async function deleteTimelineMapping(companyId: number, id: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('timeline_import_mappings')
    .where('id', '=', Number(id))
    .where('company_id', '=', companyId)
    .execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}

// ── Bug mappings (company-scoped) ─────────────────────────────────────────────

export async function listBugMappings(companyId: number) {
  const db = await getKysely();
  return db
    .selectFrom('bug_import_mappings')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function getBugMappingById(id: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('bug_import_mappings')
    .selectAll()
    .where('id', '=', Number(id))
    .executeTakeFirst();
}

export async function findBugMappingByName(companyId: number, name: string) {
  const db = await getKysely();
  return db
    .selectFrom('bug_import_mappings')
    .selectAll()
    .where('company_id', '=', companyId)
    .where('name', '=', name)
    .executeTakeFirst();
}

/** Ids newest-first, used by the service to evict the oldest when the cap is reached. */
export async function bugMappingIds(companyId: number) {
  const db = await getKysely();
  return db
    .selectFrom('bug_import_mappings')
    .select(['id'])
    .where('company_id', '=', companyId)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function createBugMapping(companyId: number, name: string, mappingsJson: string) {
  const db = await getKysely();
  return db
    .insertInto('bug_import_mappings')
    .values({ name, mappings_json: mappingsJson, company_id: companyId })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteBugMapping(companyId: number, id: number | string) {
  const db = await getKysely();
  const result = await db
    .deleteFrom('bug_import_mappings')
    .where('id', '=', Number(id))
    .where('company_id', '=', companyId)
    .execute();
  return { lastInsertRowid: 0, changes: Number(result.numDeletedRows ?? 0n) };
}
