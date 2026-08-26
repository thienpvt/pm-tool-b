import { runFix } from './run-sql-fix';
import { STATUS_WEIGHTS } from '@/lib/status-weights';

/**
 * One-off replacement for the boot-time `backfillWeightedCompletion` that used
 * to run in getDb(). Recomputes completion_pct from status weights for leaf
 * activities and averages the EPIC rows over their children, then stamps the
 * settings flag so the app's (now removed) boot-time backfill stays inert.
 *
 * Runs as a single multi-statement query — no `;` splitting.
 */
const FLAG = 'completion_pct_weighted_v1';

const cases = Object.entries(STATUS_WEIGHTS)
  .map(([status, w]) => `WHEN status = '${status.replace(/'/g, "''")}' THEN ${Math.round(w * 100)}`)
  .join(' ');

const sql = `
UPDATE activities
SET completion_pct = CASE ${cases} ELSE 0 END
WHERE COALESCE(no, '') <> 'EPIC';

UPDATE activities e
SET completion_pct = sub.avg_pct
FROM (
  SELECT parent_id, ROUND(AVG(completion_pct))::int AS avg_pct
  FROM activities
  WHERE parent_id IS NOT NULL
  GROUP BY parent_id
) sub
WHERE e.id = sub.parent_id AND COALESCE(e.no, '') = 'EPIC';

INSERT INTO settings (key, value) VALUES ('${FLAG}', '${new Date().toISOString()}') ON CONFLICT (key) DO NOTHING;
`;

runFix({
  name: 'backfill-weighted-completion',
  sql,
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
