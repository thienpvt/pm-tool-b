export const ACTIVE_STAGES = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

export type NormalizedRag = 'green' | 'amber' | 'red';

/** Trim lower-case; green/red/amber stay; anything else including null → amber (D-03). */
export function normalizeRag(raw: string | null | undefined): NormalizedRag {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'green') return 'green';
  if (v === 'red') return 'red';
  if (v === 'amber') return 'amber';
  return 'amber';
}

/** Active = status Active AND stage L0–L4 (D-02). */
export function isActiveProject(p: { status: string; stage: string | null | undefined }): boolean {
  return p.status === 'Active' && ACTIVE_STAGES.includes(p.stage as (typeof ACTIVE_STAGES)[number]);
}
