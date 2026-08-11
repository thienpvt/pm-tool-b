import { z } from 'zod';

// POST accepts an arbitrary Record<string, unknown> today (looped via
// Object.entries(body)) — passthrough shape guard only, no per-field frozen
// validation exists to preserve.
export const configSchema = z.record(z.string(), z.unknown());
