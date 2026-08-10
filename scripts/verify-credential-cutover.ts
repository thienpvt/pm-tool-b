/**
 * INTG-08 read-only cutover comparison script.
 *
 * Resolves every configured company through BOTH the old inline credential
 * path (copied verbatim from the three Jira routes and the two Anthropic
 * variants) and the new unified resolver in @/lib/integrations/credentials,
 * then reports per-company old/new/match. Exit non-zero on any mismatch.
 *
 * READ-ONLY: SELECT only, no env mutation, no writes.
 *
 * Manual run (needs DATABASE_URL and real company rows) as part of the cutover
 * checklist BEFORE the old inline blocks are deleted (plan 03-04 commit):
 *
 *   npx tsx scripts/verify-credential-cutover.ts
 *
 * (Deviation from the plan's `node scripts/...` invocation: plain Node 25 does
 * not resolve the `@/` tsconfig alias, so `npx tsx` is the working equivalent.
 * `npx tsc --noEmit` covers compile verification.)
 */
import { Pool } from 'pg';
import { getDb } from '@/lib/db';
import {
  resolveAnthropicCredentials,
  resolveJiraCredentials,
} from '@/lib/integrations/credentials';
import { getSetting } from '@/lib/repositories/settings.repo';

type JiraRow = {
  company_id: number;
  base_url_var: string;
  email_var: string;
  token_var: string;
};

function oldJiraPath(cfg: JiraRow): { baseUrl: string; email: string; token: string } | null {
  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email = process.env[cfg.email_var];
  const token = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

async function oldAnthropicPath(): Promise<string | null> {
  const envKey = process.env.ANTHROPIC_API_KEY;
  if (envKey) return envKey;
  return (await getSetting('anthropic_api_key')) ?? null;
}

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('set DATABASE_URL and re-run');
    return 1;
  }

  // WR-06: fail the gate loudly after 5s instead of hanging forever on a dead host.
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  let exitCode = 0;

  try {
    // Reuse the same getDb() singleton the resolver imports, so the settings
    // lookup goes through the exact runtime path (INTG-08 evidence).
    await getDb();

    const { rows } = await pool.query<JiraRow>(
      'SELECT company_id, base_url_var, email_var, token_var FROM company_jira_config',
    );

    for (const row of rows) {
      const oldJira = oldJiraPath(row);
      const newJira = await resolveJiraCredentials(row.company_id);

      const oldJiraLabel = oldJira ? 'OK' : 'UNSET';
      const newJiraLabel = newJira ? 'OK' : 'UNSET';
      const match =
        oldJira === null || newJira === null
          ? oldJira === null && newJira === null
          : oldJira.baseUrl === newJira.baseUrl &&
            oldJira.email === newJira.email &&
            oldJira.token === newJira.token;

      console.log(
        `${row.company_id} | old: ${oldJiraLabel} | new: ${newJiraLabel} | match: ${match ? 'yes' : 'no'}`,
      );
      if (!match) exitCode = 1;
    }

    const oldAnthropic = await oldAnthropicPath();
    const newAnthropic = (await resolveAnthropicCredentials())?.apiKey ?? null;
    const anthropicMatch = oldAnthropic === newAnthropic;
    console.log(
      `anthropic | old: ${oldAnthropic ? 'OK' : 'UNSET'} | new: ${newAnthropic ? 'OK' : 'UNSET'} | match: ${anthropicMatch ? 'yes' : 'no'}`,
    );
    if (!anthropicMatch) exitCode = 1;
  } finally {
    await pool.end();
  }

  return exitCode;
}

main()
  .then((code) => {
    if (code !== 0) process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
