import { z } from 'zod';

// documents.service.ts's upsertDocument tolerates a fully-missing type/title/content
// (all `?? ''`/`?? {}` defaulted) — do NOT require `content` here (Pitfall 3).
export const documentInputSchema = z.object({}).passthrough();

// updateDocument destructures body.id/title/content but the route itself casts
// these — the service has no ValidationError for a missing field, so this stays
// a passthrough shape guard, not a required-field schema.
export const documentUpdateSchema = z.object({}).passthrough();
