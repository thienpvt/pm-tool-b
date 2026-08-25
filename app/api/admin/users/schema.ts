import { z } from 'zod';

// Frozen 400 body: { error: 'Username and password required' } — the route
// returns this literal on any safeParse failure, not a per-field Zod message.
// company_id/is_admin stay untyped (z.unknown()) — the route already casts
// them (`company_id ?? null`, `Boolean(is_admin)`) with no prior type check;
// a strict z.number() here would narrow acceptance vs. today (Coercion-match
// rule, 05-RESEARCH.md).
export const createUserSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  display_name: z.string().optional(),
  company_id: z.unknown().optional(),
  is_admin: z.unknown().optional(),
});

// Frozen 400 body: { error: 'id required' }
export const updateUserSchema = z.object({
  id: z.union([z.number(), z.string()]),
  display_name: z.string().optional(),
  company_id: z.unknown().optional(),
  is_admin: z.unknown().optional(),
  password: z.string().optional(),
});
