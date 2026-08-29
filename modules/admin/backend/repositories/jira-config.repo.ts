import { sql } from 'kysely';
import { getKysely } from '@/lib/db/kysely';

export type JiraConfigRow = {
  base_url_var: string;
  email_var: string;
  token_var: string;
};

export async function companyJiraConfig(companyId: number | null) {
  const db = await getKysely();
  if (companyId === null) return undefined;
  return db
    .selectFrom('company_jira_config')
    .select(['base_url_var', 'email_var', 'token_var'])
    .where('company_id', '=', companyId)
    .executeTakeFirst();
}

/** `company_jira_config` has no serial id, so writes return no generated key. */
export async function setCompanyJiraConfig(companyId: number, config: JiraConfigRow): Promise<void> {
  const db = await getKysely();
  await db
    .insertInto('company_jira_config')
    .values({
      company_id: companyId,
      base_url_var: config.base_url_var.trim(),
      email_var: config.email_var.trim(),
      token_var: config.token_var.trim(),
    })
    .onConflict((oc) =>
      oc.column('company_id').doUpdateSet({
        base_url_var: (eb) => eb.ref('excluded.base_url_var'),
        email_var: (eb) => eb.ref('excluded.email_var'),
        token_var: (eb) => eb.ref('excluded.token_var'),
      }),
    )
    .execute();
}

export async function getJqlPresetById(presetId: number | string) {
  const db = await getKysely();
  return db
    .selectFrom('jira_jql_presets')
    .selectAll()
    .where('id', '=', Number(presetId))
    .executeTakeFirst();
}

export async function findJqlPresetByName(companyId: number, name: string, context: string) {
  const db = await getKysely();
  return db
    .selectFrom('jira_jql_presets')
    .selectAll()
    .where('company_id', '=', companyId)
    .where('name', '=', name)
    .where('context', '=', context)
    .executeTakeFirst();
}

export async function listJqlPresets(companyId: number, context: string) {
  const db = await getKysely();
  return db
    .selectFrom('jira_jql_presets')
    .selectAll()
    .where('company_id', '=', companyId)
    .where('context', '=', context)
    .orderBy('created_at', 'desc')
    .execute();
}

export async function createJqlPreset(
  companyId: number,
  name: string,
  jql: string,
  context: string,
  maxPresets = 10,
) {
  const db = await getKysely();
  const existing = await db
    .selectFrom('jira_jql_presets')
    .select('id')
    .where('company_id', '=', companyId)
    .where('context', '=', context)
    .orderBy('created_at', 'desc')
    .execute();

  if (existing.length >= maxPresets) {
    const oldest = existing[existing.length - 1];
    await db
      .deleteFrom('jira_jql_presets')
      .where('id', '=', oldest.id)
      .where('company_id', '=', companyId)
      .execute();
  }

  return db
    .insertInto('jira_jql_presets')
    .values({
      name,
      jql,
      context,
      company_id: companyId,
      created_at: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function deleteJqlPreset(companyId: number, presetId: number | string) {
  const db = await getKysely();
  return db
    .deleteFrom('jira_jql_presets')
    .where('id', '=', Number(presetId))
    .where('company_id', '=', companyId)
    .execute();
}

export async function listRecentJiraSyncMappings(companyId: number) {
  const db = await getKysely();
  return db
    .selectFrom('jira_sync_mappings')
    .selectAll()
    .where('company_id', '=', companyId)
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute();
}

export async function saveJiraSyncMapping(companyId: number, mappingsJson: string) {
  const db = await getKysely();
  await db
    .insertInto('jira_sync_mappings')
    .values({
      mappings_json: mappingsJson,
      company_id: companyId,
      created_at: new Date(),
    })
    .execute();

  await sql`
    DELETE FROM jira_sync_mappings
    WHERE company_id = ${companyId}
      AND id NOT IN (
        SELECT id FROM (
          SELECT id FROM jira_sync_mappings
          WHERE company_id = ${companyId}
          ORDER BY created_at DESC
          LIMIT 5
        ) AS keep_rows
      )
  `.execute(db);
}
