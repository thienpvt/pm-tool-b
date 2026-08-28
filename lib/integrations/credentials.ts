import { companyJiraConfig } from '@/modules/admin/backend/repositories/jira-config.repo';
import { getSetting } from '@/lib/repositories/settings.repo';

// INTG-09: this module is the ONE place under lib/integrations/ that imports
// repositories — every client must take already-resolved credentials instead.

export type CredentialKind = 'jira' | 'anthropic' | 'resend';
export type JiraCredentials = { baseUrl: string; email: string; token: string };
export type AnthropicCredentials = { apiKey: string };
export type ResendCredentials = { apiKey: string };

/**
 * Jira: DB stores env var NAMES; values live in process.env. Precedence = the
 * DB row, then the env value; null when any piece is missing. `explicit`
 * covers the admin /api/jira/test path, which passes un-saved var names from
 * the body and must bypass the DB entirely (Pitfall 3). INTG-08: precedence
 * preserved byte-for-byte vs the old inline blocks.
 */
export async function resolveJiraCredentials(
  companyId: number | null,
  explicit?: { base_url_var: string; email_var: string; token_var: string },
): Promise<JiraCredentials | null> {
  const cfg = explicit ?? await companyJiraConfig(companyId);
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;
  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email = process.env[cfg.email_var];
  const token = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;
  return { baseUrl, email, token };
}

/**
 * Anthropic: process.env first, then DB settings. The only intentional
 * normalization (INTG-08, CONTEXT): an empty-string env var is treated as
 * unset, so `env || db` falls through to the DB setting.
 */
export async function resolveAnthropicCredentials(): Promise<AnthropicCredentials | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || await getSetting('anthropic_api_key');
  if (!apiKey) return null;
  return { apiKey };
}

/** Resend: process.env only — no DB fallback. */
export async function resolveResendCredentials(): Promise<ResendCredentials | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}
