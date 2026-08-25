import type { Activity } from '../types';

export const CSV_HEADERS = [
  'No', 'Phase', 'Key', 'Activity', 'Deliverable', 'Sign-off Document',
  'Accountable', 'Responsible', 'Support',
  'Plan Start', 'Plan End', 'Actual Start', 'Actual End',
  'Status', 'Completion (%)', 'Sprint', 'Delay Owner', 'Delay Reason', 'Notes',
];

export function escapeCSV(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

export function activitiesToCSV(rows: Activity[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.no, r.phase, r.jira_key, r.activity, r.deliverable, r.sign_off_doc,
      r.accountable, r.responsible, r.support,
      r.plan_start, r.plan_end, r.actual_start, r.actual_end,
      r.status, r.completion_pct, r.sprint, r.delay_owner, r.delay_reason, r.notes,
    ].map(escapeCSV).join(','));
  }
  return lines.join('\r\n');
}

export function downloadCSV(content: string, filename: string) {
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const TEMPLATE_ROWS = [
  ['1', 'Initializing', 'PROJ-1', 'Project Kickoff', 'Kickoff Presentation', 'Signed Charter', 'PM', 'PM', '', '2025-01-06', '2025-01-06', '2025-01-06', '2025-01-08', 'Done', '100', '', 'Vendor', 'Internal prep took longer', ''],
  ['2', 'Development',  'PROJ-2', 'Backend API',     'API Module',           'Test Report',    'Tech Lead', 'BE Team', 'SA', '2025-02-01', '2025-03-31', '2025-02-05', '', 'In Progress', '60', 'Sprint 1', 'Client', 'Waiting for client API spec', ''],
  ['3', 'Testing',      'PROJ-3', 'SIT',             'SIT Report',           'SIT Sign-off',   'QA Lead', 'QA Team', 'Dev', '2025-04-01', '2025-04-15', '', '', 'To-do', '0', '', 'N/A', '', ''],
];
