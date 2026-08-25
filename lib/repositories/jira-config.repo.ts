import { getDb } from '@/lib/db';

export type JiraConfigRow = {
  base_url_var: string;
  email_var: string;
  token_var: string;
};

export async function companyJiraConfig(companyId: number | null) {
  const db = await getDb();
  return db.get<JiraConfigRow>(
    'SELECT base_url_var, email_var, token_var FROM company_jira_config WHERE company_id = ?',
    companyId,
  );
}

/** `company_jira_config` has no serial id, so writes return no generated key. */
export async function setCompanyJiraConfig(companyId: number, config: JiraConfigRow): Promise<void> {
  const db = await getDb();
  await db.run(
    `INSERT INTO company_jira_config (company_id, base_url_var, email_var, token_var)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       base_url_var = excluded.base_url_var,
       email_var = excluded.email_var,
       token_var = excluded.token_var`,
    companyId, config.base_url_var.trim(), config.email_var.trim(), config.token_var.trim(),
  );
}

export async function listJqlPresets(context: string) {
  const db = await getDb();
  return db.all(
    'SELECT * FROM jira_jql_presets WHERE context = ? ORDER BY created_at DESC',
    context,
  );
}

export async function createJqlPreset(name: string, jql: string, context: string, maxPresets = 10) {
  const db = await getDb();
  const existing = await db.all<{ id: number }>(
    'SELECT id FROM jira_jql_presets WHERE context = ? ORDER BY created_at DESC',
    context,
  );
  if (existing.length >= maxPresets) {
    await db.run('DELETE FROM jira_jql_presets WHERE id = ?', existing[existing.length - 1].id);
  }
  return db.get(
    `INSERT INTO jira_jql_presets (name, jql, context) VALUES (?, ?, ?)
     RETURNING *`,
    name, jql, context,
  );
}

export async function deleteJqlPreset(presetId: number | string) {
  const db = await getDb();
  return db.run('DELETE FROM jira_jql_presets WHERE id = ?', presetId);
}

export async function listRecentJiraSyncMappings() {
  const db = await getDb();
  return db.all('SELECT * FROM jira_sync_mappings ORDER BY created_at DESC LIMIT 5');
}

export async function saveJiraSyncMapping(mappingsJson: string) {
  const db = await getDb();
  await db.run('INSERT INTO jira_sync_mappings (mappings_json) VALUES (?)', mappingsJson);
  await db.run(
    `DELETE FROM jira_sync_mappings
     WHERE id NOT IN (SELECT id FROM jira_sync_mappings ORDER BY created_at DESC LIMIT 5)`,
  );
}
