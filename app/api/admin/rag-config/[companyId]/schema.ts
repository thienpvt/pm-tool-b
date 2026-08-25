import { z } from 'zod';

// Passthrough shape guard only. z.coerce.number() would 400 on a non-numeric
// string, but today's route does `Number(body.x ?? default)`, silently
// producing NaN and storing it — a stricter Zod-level coercion would change
// that accept-anything behavior. Per orchestrator resolution (05-RESEARCH.md
// Open Question 2), preserve the Number()-coercion in the route untouched.
export const ragConfigSchema = z.record(z.string(), z.unknown());
