// ─── Status weights — single source of truth ─────────────────────────────────
// Trọng số trạng thái dùng để tính tiến độ (weighted progress).
// Trọng số này tương đương với % hoàn thành của một story/task.
//   Done / Deployed / UAT ............ 1.0
//   Re-Open .......................... 0.7   |  QC Done ........ 1.0
//   In Testing ....................... 0.6   |  PENDING ........ 0.5
//   In Review ........................ 0.5   |  In Progress .... 0.3
//   In Dev / Ready For Dev ........... 0.2
//   To Do / REFINEMENT ............... 0.1
//   New / Blocked .................... 0.0
export const STATUS_WEIGHTS: Record<string, number> = {
  'ANBM': 1, 'STAGING-READY4TEST': 0.6, 'Deployed': 1, 'Done': 1,
  'In Dev': 0.2, 'In development': 0.2, 'In Progress': 0.3, 'In Review': 0.5,
  'In Testing': 0.6, 'New': 0, 'PENDING': 0.5, 'UAT': 1, 'QC Done': 1,
  'Ready For Dev': 0.2, 'Ready for Test': 0.6, 'Testing': 0.6, 'To Do': 0.1,
  'To-do': 0.1, 'REFINEMENT': 0.1, 'Re-Open': 0.7, 'READY TO RELEASE': 1,
  'Passed QC': 1, 'READY4TEST': 0.6, 'READY FOR RELEASE': 1, 'Blocked': 0,
};

/** Trọng số của một trạng thái (0..1). Trạng thái không xác định → 0. */
export function statusWeight(s: string | null | undefined): number {
  return STATUS_WEIGHTS[s ?? ''] ?? 0;
}

/** % hoàn thành của một story/task dựa trên trạng thái (0..100, làm tròn). */
export function statusPct(s: string | null | undefined): number {
  return Math.round(statusWeight(s) * 100);
}

/** Các trạng thái được coi là "done" (trọng số >= 1). */
export const DONE_STATUSES = Object.entries(STATUS_WEIGHTS)
  .filter(([, w]) => w >= 1)
  .map(([s]) => s);

/**
 * Tiến độ weighted của một tập trạng thái leaf:
 *   Tiến độ = Σ(trọng số trạng thái) / Tổng activity  × 100
 * Trả về 0 nếu danh sách rỗng.
 */
export function weightedProgress(statuses: (string | null | undefined)[]): number {
  if (statuses.length === 0) return 0;
  const sum = statuses.reduce((acc, s) => acc + statusWeight(s), 0);
  return Math.round((sum / statuses.length) * 100);
}
