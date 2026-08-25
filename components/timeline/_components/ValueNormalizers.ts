import { STATUSES } from './ActivityFields';

export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const v = raw.trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const ai = parseInt(a);
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    if (c.length === 4) {
      if (ai > 12) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }
  const num = Number(v);
  if (!isNaN(num) && num > 1 && num < 2958466) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return '';
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '');

const STATUS_MAP: Record<string, string> = {
  new: 'New', notstarted: 'New', open: 'New',
  todo: 'To-do', tostart: 'To-do',
  refinement: 'REFINEMENT', refining: 'REFINEMENT', grooming: 'REFINEMENT', backlog: 'REFINEMENT',
  indev: 'In Dev', developing: 'In Dev',
  indevelopment: 'In development', development: 'In development',
  readyfordev: 'Ready For Dev', readydev: 'Ready For Dev',
  inprogress: 'In Progress', wip: 'In Progress', ongoing: 'In Progress',
  processing: 'In Progress', running: 'In Progress',
  inreview: 'In Review', review: 'In Review', reviewing: 'In Review', codereview: 'In Review',
  pending: 'PENDING',
  intesting: 'In Testing', qa: 'In Testing', qc: 'In Testing',
  testing: 'Testing',
  readyfortest: 'Ready for Test', readytest: 'Ready for Test',
  ready4test: 'READY4TEST', r4t: 'READY4TEST',
  staging: 'STAGING-READY4TEST', stagingready: 'STAGING-READY4TEST',
  reopen: 'Re-Open', reopened: 'Re-Open',
  done: 'Done', complete: 'Done', completed: 'Done', finished: 'Done', closed: 'Done',
  uat: 'UAT', useracceptancetesting: 'UAT',
  deployed: 'Deployed', deploy: 'Deployed', live: 'Deployed', production: 'Deployed',
  qcdone: 'QC Done',
  passedqc: 'Passed QC', passed: 'Passed QC',
  readytorelease: 'READY TO RELEASE', rtr: 'READY TO RELEASE',
  readyforrelease: 'READY FOR RELEASE', rfr: 'READY FOR RELEASE',
  anbm: 'ANBM',
  blocked: 'Blocked', stuck: 'Blocked', onhold: 'Blocked', hold: 'Blocked',
  deferred: 'Deferred', postponed: 'Deferred', delayed: 'Deferred',
  cancelled: 'Deferred', cancel: 'Deferred', skipped: 'Deferred',
};

const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];
const DELAY_MAP: Record<string, string> = {
  na: 'N/A', n: 'N/A', none: 'N/A', notapplicable: 'N/A', no: 'N/A', '': 'N/A',
  client: 'Client', customer: 'Client',
  vendor: 'Vendor', supplier: 'Vendor', partner: 'Vendor',
  both: 'Both', all: 'Both',
  external: 'External', thirdparty: 'External', other: 'External',
};

const STATUS_WEIGHTS: Record<string, number> = {
  'ANBM': 1, 'STAGING-READY4TEST': 0.6, 'Deployed': 1, 'Done': 1,
  'In Dev': 0.2, 'In development': 0.2, 'In Progress': 0.3, 'In Review': 0.5,
  'In Testing': 0.6, 'New': 0, 'PENDING': 0.5, 'UAT': 1, 'QC Done': 1,
  'Ready For Dev': 0.2, 'Ready for Test': 0.6, 'Testing': 0.6, 'To Do': 0.1,
  'To-do': 0.1, 'REFINEMENT': 0.1, 'Re-Open': 0.7, 'READY TO RELEASE': 1,
  'Passed QC': 1, 'READY4TEST': 0.6, 'READY FOR RELEASE': 1, 'Blocked': 0,
};

export function statusW(s: string): number { return STATUS_WEIGHTS[s] ?? 0; }

function fuzzyStatus(raw: string): string {
  if (!raw) return 'To-do';
  const n = norm(raw);
  if (STATUSES.includes(raw)) return raw;
  return STATUS_MAP[n] ?? STATUS_MAP[Object.keys(STATUS_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'To-do';
}

export function fuzzyDelayOwner(raw: string): string {
  if (!raw) return 'N/A';
  const n = norm(raw);
  if (DELAY_OWNERS.includes(raw)) return raw;
  return DELAY_MAP[n] ?? DELAY_MAP[Object.keys(DELAY_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'N/A';
}

const PRIORITY_IMPORT_MAP: Record<string, string> = {
  blocker: 'Blocker', p0: 'Blocker', urgent: 'Blocker',
  critical: 'Critical', highest: 'Critical',
  major: 'Major', high: 'Major',
  medium: 'Medium', normal: 'Medium', moderate: 'Medium',
  minor: 'Minor', low: 'Minor', lowest: 'Minor',
  trivial: 'Trivial', negligible: 'Trivial',
};
const PRIORITIES_IMPORT = ['Blocker', 'Critical', 'Major', 'Medium', 'Minor', 'Trivial'];

function fuzzyPriority(raw: string): string {
  if (!raw) return 'Medium';
  if (PRIORITIES_IMPORT.includes(raw)) return raw;
  const n = norm(raw);
  return PRIORITY_IMPORT_MAP[n] ?? PRIORITY_IMPORT_MAP[Object.keys(PRIORITY_IMPORT_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'Medium';
}

export function resolveField(field: string, raw: string, statusOverrides?: Record<string, string>): string {
  switch (field) {
    case 'plan_start': case 'plan_end': case 'actual_start': case 'actual_end':
      return normalizeDate(raw);
    case 'status':
      return (statusOverrides?.[raw]) ?? fuzzyStatus(raw);
    case 'delay_owner': return fuzzyDelayOwner(raw);
    case 'priority': return fuzzyPriority(raw);
    default: return raw;
  }
}
