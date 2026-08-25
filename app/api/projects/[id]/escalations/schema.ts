import { z } from 'zod';

// PUT only — escalations has no create, only update. Fields are dynamic per
// allowlist (escalations.repo.ts), so this is a passthrough shape guard, not
// a field-typed schema.
export const escalationUpdateSchema = z.object({}).passthrough();
