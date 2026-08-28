import {
  AlertTriangle, BarChart2, Calendar, FileText, Info, Tag, Users,
} from 'lucide-react';
import type React from 'react';

export const ACTIVITY_FIELDS: { key: string; label: string; required?: boolean; virtual?: boolean }[] = [
  { key: 'activity',       label: 'Activity', required: true },
  { key: 'phase',          label: 'Phase' },
  { key: 'no',             label: 'No' },
  { key: 'deliverable',    label: 'Deliverable' },
  { key: 'sign_off_doc',   label: 'Sign-off Document' },
  { key: 'accountable',    label: 'Accountable' },
  { key: 'responsible',    label: 'Responsible' },
  { key: 'support',        label: 'Support' },
  { key: 'plan_start',     label: 'Plan Start (YYYY-MM-DD)' },
  { key: 'plan_end',       label: 'Plan End (YYYY-MM-DD)' },
  { key: 'actual_start',   label: 'Actual Start (YYYY-MM-DD)' },
  { key: 'actual_end',     label: 'Actual End (YYYY-MM-DD)' },
  { key: 'status',         label: 'Status' },
  { key: 'completion_pct', label: 'Completion (%)' },
  { key: 'delay_owner',    label: 'Delay Owner' },
  { key: 'delay_reason',   label: 'Delay Reason' },
  { key: 'notes',          label: 'Notes' },
  { key: 'priority',        label: 'Priority' },
  { key: 'jira_key',       label: 'Jira Key' },
  { key: 'sprint',         label: 'Sprint' },
  { key: '_issue_type',    label: 'Issue Type (EPIC / Story)', virtual: true },
  { key: '_parent',        label: 'Parent Key (EPIC → Phase)', virtual: true },
];

const FIELD_ALIASES: Record<string, string[]> = {
  no:             ['no', 'num', 'number', 'seq', 'stt', '#'],
  phase:          ['phase', 'stage', 'category', 'giai doan'],
  activity:       ['activity', 'task', 'name', 'ten', 'title', 'description', 'cong viec', 'job', 'summary'],
  deliverable:    ['deliverable', 'output', 'dau ra', 'result', 'artifact'],
  sign_off_doc:   ['sign off', 'signoff', 'sign-off', 'document', 'doc', 'bien ban'],
  accountable:    ['accountable', 'owner', 'account', 'chu tri', 'assignee', 'assigned to'],
  responsible:    ['responsible', 'person', 'phu trach'],
  support:        ['support', 'ho tro', 'helper'],
  plan_start:     ['plan start', 'planned start', 'start', 'begin', 'bat dau', 'ke hoach bat dau', 'start date', 'inferred start date'],
  plan_end:       ['plan end', 'planned end', 'end', 'finish', 'ket thuc', 'ke hoach ket thuc', 'end date', 'due date', 'inferred due date'],
  actual_start:   ['actual start', 'real start', 'thuc te bat dau', 'actual start date'],
  actual_end:     ['actual end', 'real end', 'thuc te ket thuc', 'actual end date'],
  status:         ['status', 'trang thai', 'state', 'tinh trang'],
  completion_pct: ['completion', 'percent', '%', 'progress', 'tien do', 'done', 'pct', 'complete'],
  delay_owner:    ['delay owner', 'owner delay', 'responsible for delay'],
  delay_reason:   ['delay reason', 'reason', 'ly do', 'cause'],
  notes:          ['notes', 'note', 'remark', 'ghi chu', 'comment', 'observation'],
  priority:       ['priority', 'uu tien', 'muc do uu tien', 'severity', 'urgency'],
  jira_key:       ['key', 'jira key', 'issue key', 'ticket', 'ticket id'],
  sprint:         ['sprint', 'sprint name', 'iteration'],
  _issue_type:    ['issue type', 'issuetype', 'type', 'loai van de'],
  _parent:        ['parent', 'epic link', 'parent link', 'parent issue'],
};

export function autoSuggestMapping(columns: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const col of columns) {
      const normCol = normalize(col);
      if (aliases.some(a => normCol === a || normCol.includes(a) || a.includes(normCol))) {
        if (!result[field]) result[field] = col;
      }
    }
  }
  return result;
}

export const STATUSES = [
  'New', 'To Do', 'To-do', 'REFINEMENT',
  'In Dev', 'In development', 'Ready For Dev', 'In Progress',
  'In Review', 'PENDING',
  'In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST',
  'Re-Open',
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
  'Blocked', 'Deferred',
];
export const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];
export const SKIP = '__skip__';

export const FIELD_GROUPS: { label: string; icon: React.ComponentType<{ className?: string }>; keys: string[]; color: string }[] = [
  { label: 'Thông tin cơ bản', icon: Info,          keys: ['no', 'phase', 'activity', 'deliverable', 'sign_off_doc'], color: 'blue'   },
  { label: 'Phân công',        icon: Users,          keys: ['accountable', 'responsible', 'support'],                  color: 'purple' },
  { label: 'Ngày tháng',       icon: Calendar,       keys: ['plan_start', 'plan_end', 'actual_start', 'actual_end'],   color: 'orange' },
  { label: 'Tiến độ',          icon: BarChart2,      keys: ['status', 'completion_pct', 'priority'],                  color: 'green'  },
  { label: 'Vấn đề trễ',       icon: AlertTriangle,  keys: ['delay_owner', 'delay_reason'],                            color: 'red'    },
  { label: 'Ghi chú',          icon: FileText,       keys: ['notes'],                                                  color: 'gray'   },
  { label: 'Jira Integration', icon: Tag,            keys: ['jira_key', 'sprint', '_issue_type', '_parent'],           color: 'teal'   },
];
