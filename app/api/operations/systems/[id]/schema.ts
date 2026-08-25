import { z } from 'zod';

// PUT has NO inline validation today (name/description/etc all pass through
// unchecked) — passthrough shape guard only; do not add a new required-field
// check (scope creation), per plan.
export const updateOperationsSystemSchema = z.object({}).passthrough();
