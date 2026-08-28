import { parseIsoDate } from '@/lib/fiscal/iso-date';
import { ValidationError } from '@/lib/services/errors';
import { parseHttpsUrl } from './https-url';

export const CHECKLIST_STATUSES = [
  'none',
  'drafting',
  'pending_approval',
  'approved',
  'not_applicable',
] as const;

export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

const BINARY_KEYS = ['file', 'content', 'blob', 'attachment', 'data'] as const;

export function rejectBinaryFields(body: Record<string, unknown>): void {
  for (const key of BINARY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new ValidationError(`File upload not allowed on ${key}`, key);
    }
  }
}

function requireApprovedBy(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value.trim();
  throw new ValidationError('approved_by is required', 'approved_by');
}

export function assertChecklistPatchRules(
  body: Record<string, unknown>,
  status: string,
): void {
  if (!CHECKLIST_STATUSES.includes(status as ChecklistStatus)) {
    throw new ValidationError('Invalid status', 'status');
  }

  switch (status) {
    case 'approved': {
      parseIsoDate(body.approved_at, 'approved_at');
      requireApprovedBy(body.approved_by);
      parseHttpsUrl(body.confluence_url, 'confluence_url');
      break;
    }
    case 'not_applicable': {
      if (typeof body.na_reason !== 'string' || !body.na_reason.trim()) {
        throw new ValidationError('na_reason is required', 'na_reason');
      }
      break;
    }
    case 'pending_approval': {
      parseHttpsUrl(body.confluence_url, 'confluence_url');
      break;
    }
    case 'none':
    case 'drafting': {
      parseHttpsUrl(body.confluence_url, 'confluence_url', { allowEmpty: true });
      break;
    }
    default:
      throw new ValidationError('Invalid status', 'status');
  }
}
