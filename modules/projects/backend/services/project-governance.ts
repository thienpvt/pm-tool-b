import { ValidationError } from '@/lib/services/errors';

const TERMINAL_STATUSES = new Set(['Completed', 'Paused', 'Cancelled', 'Other']);
const RAG_NOT_APPLICABLE = 'Not applicable';
const WEEKLY_PERIOD_PATTERN = /^\d{4}-W\d{2}$/;

export type ProjectGovernancePrior = {
  progress_pct?: number | null;
  status?: string | null;
  rag?: string | null;
  stage?: string | null;
  status_reason?: string | null;
};

function isWeeklyEnabled(value: unknown): boolean {
  return value === true || value === 'Yes';
}

function mergedStatus(
  fields: Record<string, unknown>,
  prior?: ProjectGovernancePrior,
): string | undefined {
  if (fields.status !== undefined && fields.status !== null) {
    return String(fields.status);
  }
  return prior?.status ?? undefined;
}

function mergedStage(fields: Record<string, unknown>, prior?: ProjectGovernancePrior): string | undefined {
  if (fields.stage !== undefined && fields.stage !== null) {
    return String(fields.stage);
  }
  return prior?.stage ?? undefined;
}

function mergedStatusReason(
  fields: Record<string, unknown>,
  prior?: ProjectGovernancePrior,
): string {
  if (fields.status_reason !== undefined && fields.status_reason !== null) {
    return typeof fields.status_reason === 'string' ? fields.status_reason.trim() : '';
  }
  return typeof prior?.status_reason === 'string' ? prior.status_reason.trim() : '';
}

/**
 * Applies L0–L5 governance defaults and D-06 hard validations.
 * L5/terminal overrides warn rather than throw (D-07, D-08).
 *
 * Phase 13 contract (D-09): `progress_pct` is live on `projects`; weekly submit
 * copies it at submit time and must never write back to this column.
 */
export function applyProjectGovernance(
  input: Record<string, unknown>,
  prior?: ProjectGovernancePrior,
): { fields: Record<string, unknown>; warnings: string[] } {
  const fields = { ...input };
  const warnings: string[] = [];

  if ('progress_pct' in input && input.progress_pct !== undefined && input.progress_pct !== null) {
    const pct = Number(input.progress_pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      throw new ValidationError('progress_pct must be an integer between 0 and 100', 'progress_pct');
    }
    fields.progress_pct = pct;
  }

  const status = mergedStatus(fields, prior);
  if (status === 'Other' && !mergedStatusReason(fields, prior)) {
    throw new ValidationError('status_reason is required when status is Other', 'status_reason');
  }

  if (isWeeklyEnabled(fields.weekly_report_enabled)) {
    const period =
      typeof fields.weekly_report_start_period === 'string'
        ? fields.weekly_report_start_period.trim()
        : '';
    if (!WEEKLY_PERIOD_PATTERN.test(period)) {
      throw new ValidationError(
        'weekly_report_start_period is required when weekly report is enabled',
        'weekly_report_start_period',
      );
    }
    fields.weekly_report_start_period = period;
  }

  const stage = mergedStage(fields, prior);

  if (stage === 'L5') {
    if (fields.status !== undefined && fields.status !== 'Completed') {
      warnings.push('Stage L5 defaults status to Completed.');
    }
    fields.status = 'Completed';

    if (fields.rag !== undefined && fields.rag !== RAG_NOT_APPLICABLE) {
      warnings.push('Stage L5 defaults RAG to Not applicable.');
    }
    fields.rag = RAG_NOT_APPLICABLE;

    const priorProgress = prior?.progress_pct;
    if (fields.progress_pct !== undefined && fields.progress_pct !== 100) {
      warnings.push('Stage L5 defaults progress to 100%.');
    } else if (priorProgress != null && priorProgress < 100) {
      warnings.push('Progress was below 100%; set to 100% for L5.');
    }
    fields.progress_pct = 100;
  }

  const finalStatus = mergedStatus(fields, prior);
  const finalStage = mergedStage(fields, prior);
  const ragShouldBeNA =
    finalStage === 'L5' || (finalStatus !== undefined && TERMINAL_STATUSES.has(finalStatus));

  if (ragShouldBeNA) {
    const clientSentRag = 'rag' in input && input.rag !== undefined && input.rag !== RAG_NOT_APPLICABLE;
    if (clientSentRag && !warnings.some((w) => w.includes('RAG'))) {
      warnings.push('Terminal status or L5 defaults RAG to Not applicable.');
    }
    fields.rag = RAG_NOT_APPLICABLE;
  }

  return { fields, warnings };
}
