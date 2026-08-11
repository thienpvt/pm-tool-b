import { z } from 'zod';

// Passthrough shape guard — the route does `?? ''` defaulting on each field
// today; no rejection of a today-valid empty-string body.
export const jiraConfigSchema = z.object({
  base_url_var: z.string().optional(),
  email_var: z.string().optional(),
  token_var: z.string().optional(),
}).passthrough();
