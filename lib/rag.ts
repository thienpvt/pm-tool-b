export interface RagConfig {
  spi_red_threshold: number;
  spi_amber_threshold: number;
  deadline_red_days: number;
  deadline_amber_days: number;
  risks_red: number;
  risks_amber: number;
  issues_amber: number;
  low_progress_amber: number;
}

export const DEFAULT_RAG_CONFIG: RagConfig = {
  spi_red_threshold: 0.6,
  spi_amber_threshold: 0.8,
  deadline_red_days: 0,
  deadline_amber_days: 14,
  risks_red: 3,
  risks_amber: 1,
  issues_amber: 1,
  low_progress_amber: 30,
};

export interface RagResult {
  rag: 'red' | 'amber' | 'green';
  spi: number | null;
  days_until_deadline: number | null;
}

export function calculateRAG(params: {
  current_phase: string;
  effective_start: string | null;
  effective_end: string | null;
  completion_pct: number;
  total_activities: number;
  open_risks: number;
  open_issues: number;
  nowMs: number;
  config: RagConfig;
}): RagResult {
  const { current_phase, effective_start, effective_end, completion_pct, total_activities, open_risks, open_issues, nowMs, config } = params;

  const endMs = effective_end ? new Date(effective_end + 'T23:59:59').getTime() : null;
  const days_until_deadline = endMs ? Math.ceil((endMs - nowMs) / 86400000) : null;

  if (current_phase === 'Closing') {
    return { rag: 'green', spi: null, days_until_deadline };
  }

  // Calculate SPI when we have both dates and enough time has elapsed
  let spi: number | null = null;
  if (effective_start && effective_end) {
    const startMs = new Date(effective_start + 'T00:00:00').getTime();
    if (startMs && endMs && nowMs > startMs && endMs > startMs) {
      const totalMs = endMs - startMs;
      const elapsedMs = Math.min(nowMs - startMs, totalMs);
      const elapsedPct = elapsedMs / totalMs;
      // Only apply SPI after 10% of timeline has passed to avoid early false alarms
      if (elapsedPct >= 0.1) {
        const expectedPct = elapsedPct * 100;
        spi = expectedPct > 0 ? completion_pct / expectedPct : null;
      }
    }
  }

  const isRed =
    (days_until_deadline !== null && days_until_deadline < config.deadline_red_days) ||
    open_risks >= config.risks_red ||
    (spi !== null && spi < config.spi_red_threshold);

  const isAmber =
    (days_until_deadline !== null && days_until_deadline <= config.deadline_amber_days) ||
    open_risks >= config.risks_amber ||
    open_issues >= config.issues_amber ||
    (spi !== null && spi < config.spi_amber_threshold) ||
    (spi === null && completion_pct < config.low_progress_amber && total_activities > 0);

  const rag: 'red' | 'amber' | 'green' = isRed ? 'red' : isAmber ? 'amber' : 'green';
  return { rag, spi, days_until_deadline };
}
