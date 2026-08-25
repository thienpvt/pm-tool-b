import { ACTIVITY_FIELDS, SKIP } from './ActivityFields';
import { fuzzyDelayOwner, normalizeDate, resolveField, statusW } from './ValueNormalizers';
import type { EpicCorrection, FileData } from '../types';

export function computeJiraDerived(
  fileData: FileData | null,
  mapping: Record<string, string>,
  projectPhase: string,
) {
  const jiraMode = !!(mapping['_issue_type'] && mapping['_issue_type'] !== SKIP);
  if (!fileData || !jiraMode) {
    return {
      jiraMode,
      epicMap: {} as Record<string, string>,
      epicPhaseMap: {} as Record<string, string>,
      importRows: fileData?.allRows ?? [],
    };
  }
  const issueTypeIdx = fileData.columns.indexOf(mapping['_issue_type']);
  const jiraKeyIdx = mapping['jira_key'] && mapping['jira_key'] !== SKIP
    ? fileData.columns.indexOf(mapping['jira_key']) : -1;
  const activityIdx = mapping['activity'] && mapping['activity'] !== SKIP
    ? fileData.columns.indexOf(mapping['activity']) : -1;
  const phaseIdx = mapping['phase'] && mapping['phase'] !== SKIP
    ? fileData.columns.indexOf(mapping['phase']) : -1;

  const epics: Record<string, string> = {};
  const epicPhases: Record<string, string> = {};
  for (const row of fileData.allRows) {
    const issueType = issueTypeIdx >= 0 ? (row[issueTypeIdx]?.trim().toLowerCase() ?? '') : '';
    if (issueType === 'epic') {
      const key = jiraKeyIdx >= 0 ? (row[jiraKeyIdx]?.trim() ?? '') : '';
      const summary = activityIdx >= 0 ? (row[activityIdx]?.trim() ?? '') : '';
      const phase = phaseIdx >= 0 ? (row[phaseIdx]?.trim() ?? '') : '';
      if (key && summary) {
        epics[key] = summary;
        epicPhases[key] = phase || projectPhase || 'General';
      }
    }
  }
  return { jiraMode, epicMap: epics, epicPhaseMap: epicPhases, importRows: fileData.allRows };
}

export function getRowPhase(
  row: string[],
  fileData: FileData,
  jiraMode: boolean,
  mapping: Record<string, string>,
  epicPhaseMap: Record<string, string>,
  projectPhase: string,
): string {
  if (jiraMode) {
    const issueTypeIdx2 = fileData.columns.indexOf(mapping['_issue_type']);
    const issueType = issueTypeIdx2 >= 0 ? (row[issueTypeIdx2]?.trim().toLowerCase() ?? '') : '';
    if (issueType === 'epic') {
      const phaseCol = mapping['phase'];
      if (phaseCol && phaseCol !== SKIP) {
        const phaseIdx = fileData.columns.indexOf(phaseCol);
        const raw = phaseIdx >= 0 ? (row[phaseIdx]?.trim() ?? '') : '';
        if (raw) return raw;
      }
      return projectPhase || 'General';
    }
    const parentIdx = mapping['_parent'] && mapping['_parent'] !== SKIP
      ? fileData.columns.indexOf(mapping['_parent']) : -1;
    const parentKey = parentIdx >= 0 ? (row[parentIdx]?.trim() ?? '') : '';
    return epicPhaseMap[parentKey] || projectPhase || 'General';
  }
  const phaseCol = mapping['phase'];
  if (!phaseCol || phaseCol === SKIP) return 'General';
  const idx = fileData.columns.indexOf(phaseCol);
  const raw = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
  return raw || 'General';
}

export function computeUniqueStatusValues(
  fileData: FileData | null,
  mapping: Record<string, string>,
) {
  if (!fileData || !mapping['status'] || mapping['status'] === SKIP) return [];
  const statusCol = fileData.columns.indexOf(mapping['status']);
  if (statusCol < 0) return [];
  const seen = new Map<string, number>();
  for (const row of fileData.allRows) {
    const v = row[statusCol]?.trim() ?? '';
    if (v) seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return Array.from(seen.entries()).map(([raw, count]) => ({
    raw, count, autoMapped: resolveField('status', raw),
  }));
}

export function computePreviewRows(
  fileData: FileData | null,
  importRows: string[][],
  jiraMode: boolean,
  mapping: Record<string, string>,
  statusOverrides: Record<string, string>,
  getRowPhaseFn: (row: string[]) => string,
) {
  if (!fileData) return [];
  const rows = jiraMode ? importRows : fileData.allRows;
  return rows.slice(0, 8).map(row => {
    const obj: Record<string, string> = {};
    const raw: Record<string, string> = {};
    for (const field of ACTIVITY_FIELDS) {
      if (field.virtual) continue;
      const col = mapping[field.key];
      if (col && col !== SKIP) {
        const idx = fileData.columns.indexOf(col);
        const rawVal = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
        raw[field.key] = rawVal;
        obj[field.key] = resolveField(field.key, rawVal, statusOverrides);
      }
    }
    if (jiraMode) obj['phase'] = getRowPhaseFn(row);
    return { resolved: obj, raw };
  });
}

export function computeEpicCorrectionsPreview(
  fileData: FileData | null,
  jiraMode: boolean,
  importRows: string[][],
  mapping: Record<string, string>,
  statusOverrides: Record<string, string>,
): EpicCorrection[] {
  if (!fileData || !jiraMode) return [];
  const actIdx2   = mapping['activity']    && mapping['activity']    !== SKIP ? fileData.columns.indexOf(mapping['activity'])    : -1;
  const keyIdx2   = mapping['jira_key']    && mapping['jira_key']    !== SKIP ? fileData.columns.indexOf(mapping['jira_key'])    : -1;
  const statIdx2  = mapping['status']      && mapping['status']      !== SKIP ? fileData.columns.indexOf(mapping['status'])      : -1;
  const typeIdx2  = mapping['_issue_type'] && mapping['_issue_type'] !== SKIP ? fileData.columns.indexOf(mapping['_issue_type']) : -1;
  const parIdx2   = mapping['_parent']     && mapping['_parent']     !== SKIP ? fileData.columns.indexOf(mapping['_parent'])     : -1;

  const epicInfo: Record<string, { name: string; status: string }> = {};
  const epicChildren: Record<string, string[]> = {};
  const childStatus: Record<string, string> = {};
  let genId = 0;

  for (const row of importRows) {
    if (actIdx2 >= 0 && !row[actIdx2]?.trim()) continue;
    const issueType = typeIdx2 >= 0 ? (row[typeIdx2]?.trim().toLowerCase() ?? '') : '';
    const key = keyIdx2 >= 0 ? (row[keyIdx2]?.trim() ?? '') : '';
    const resolved = resolveField('status', statIdx2 >= 0 ? (row[statIdx2]?.trim() ?? '') : '', statusOverrides);
    const name = actIdx2 >= 0 ? (row[actIdx2]?.trim() ?? '') : '';

    if (issueType === 'epic') {
      if (key) { epicInfo[key] = { name, status: resolved }; epicChildren[key] = epicChildren[key] ?? []; }
    } else {
      const parentKey = parIdx2 >= 0 ? (row[parIdx2]?.trim() ?? '') : '';
      if (parentKey) {
        epicChildren[parentKey] = epicChildren[parentKey] ?? [];
        const cKey = key || `__g${genId++}`;
        epicChildren[parentKey].push(cKey);
        childStatus[cKey] = resolved;
      }
    }
  }

  return Object.entries(epicInfo).flatMap(([epicKey, info]) => {
    const children = epicChildren[epicKey] ?? [];
    if (children.length === 0) return [];
    const ws = children.map(k => statusW(childStatus[k] ?? 'To-do'));
    const ew = statusW(info.status);
    const allDone    = ws.every(w => w >= 1);
    const anyStarted = ws.some(w => w > 0);
    let newStatus: string | null = null;
    if (allDone && ew < 1) newStatus = 'Done';
    else if (anyStarted && ew === 0) newStatus = 'In Progress';
    if (!newStatus || newStatus === info.status) return [];
    return [{ epicKey, epicName: info.name, oldStatus: info.status, newStatus }];
  });
}

export function computeUpsertStats(
  fileData: FileData | null,
  importRows: string[][],
  jiraMode: boolean,
  mapping: Record<string, string>,
  existingJiraKeys: Set<string>,
) {
  if (!fileData) return { newCount: 0, overwriteCount: 0 };
  const rows = jiraMode ? importRows : fileData.allRows;
  const jiraKeyCol = mapping['jira_key'];
  const jiraKeyIdx = jiraKeyCol && jiraKeyCol !== SKIP ? fileData.columns.indexOf(jiraKeyCol) : -1;
  const activityCol = mapping['activity'];
  const activityIdx = activityCol && activityCol !== SKIP ? fileData.columns.indexOf(activityCol) : -1;

  let newCount = 0, overwriteCount = 0;
  for (const row of rows) {
    if (activityIdx >= 0 && !row[activityIdx]?.trim()) continue;
    const key = jiraKeyIdx >= 0 ? (row[jiraKeyIdx]?.trim() ?? '') : '';
    if (key && existingJiraKeys.has(key)) overwriteCount++;
    else newCount++;
  }
  return { newCount, overwriteCount };
}

export type ImportActivity = {
  phase: string;
  no: string;
  activity: string;
  deliverable: string;
  sign_off_doc: string;
  accountable: string;
  responsible: string;
  support: string;
  plan_start: string;
  plan_end: string;
  actual_start: string;
  actual_end: string;
  status: string;
  completion_pct: number;
  delay_owner: string;
  delay_reason: string;
  notes: string;
  jira_key: string;
  sprint: string;
  parent_jira_key: string;
};

export function buildActivitiesForImport(
  fileData: FileData,
  rows: string[][],
  jiraMode: boolean,
  mapping: Record<string, string>,
  statusOverrides: Record<string, string>,
  getRowPhaseFn: (row: string[]) => string,
): ImportActivity[] {
  const activityCol = mapping['activity'];
  const activityIdx = fileData.columns.indexOf(activityCol);

  const get = (row: string[], field: string): string => {
    const col = mapping[field];
    if (!col || col === SKIP) return '';
    const idx = fileData.columns.indexOf(col);
    return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
  };

  const issueTypeMapCol = jiraMode && mapping['_issue_type'] && mapping['_issue_type'] !== SKIP
    ? mapping['_issue_type'] : null;
  const issueTypeColIdx2 = issueTypeMapCol ? fileData.columns.indexOf(issueTypeMapCol) : -1;
  const isEpicRow = (row: string[]) =>
    issueTypeColIdx2 >= 0 && row[issueTypeColIdx2]?.trim().toLowerCase() === 'epic';

  const parColIdx = jiraMode && mapping['_parent'] && mapping['_parent'] !== SKIP
    ? fileData.columns.indexOf(mapping['_parent']) : -1;

  const epicKeyToChildKeys = new Map<string, string[]>();
  if (jiraMode) {
    for (const row of rows) {
      if (!row[activityIdx]?.trim() || isEpicRow(row)) continue;
      const parentKey = parColIdx >= 0 ? (row[parColIdx]?.trim() ?? '') : '';
      const childKey = get(row, 'jira_key');
      if (parentKey && childKey) {
        if (!epicKeyToChildKeys.has(parentKey)) epicKeyToChildKeys.set(parentKey, []);
        epicKeyToChildKeys.get(parentKey)!.push(childKey);
      }
    }
  }

  const activities = rows
    .filter(row => row[activityIdx]?.trim())
    .map(row => {
      const isEpic = jiraMode && isEpicRow(row);
      const parentJiraKey = (jiraMode && !isEpic && parColIdx >= 0)
        ? (row[parColIdx]?.trim() ?? '') : '';
      return {
        phase:         jiraMode ? getRowPhaseFn(row) : (get(row, 'phase') || 'General'),
        no:            isEpic ? 'EPIC' : get(row, 'no'),
        activity:      get(row, 'activity'),
        deliverable:   get(row, 'deliverable'),
        sign_off_doc:  get(row, 'sign_off_doc'),
        accountable:   get(row, 'accountable'),
        responsible:   get(row, 'responsible'),
        support:       get(row, 'support'),
        plan_start:    normalizeDate(get(row, 'plan_start')),
        plan_end:      normalizeDate(get(row, 'plan_end')),
        actual_start:  normalizeDate(get(row, 'actual_start')),
        actual_end:    normalizeDate(get(row, 'actual_end')),
        status:        resolveField('status', get(row, 'status'), statusOverrides),
        completion_pct: Number(get(row, 'completion_pct').replace('%', '')) || 0,
        delay_owner:   fuzzyDelayOwner(get(row, 'delay_owner')),
        delay_reason:  get(row, 'delay_reason'),
        notes:         get(row, 'notes'),
        jira_key:      get(row, 'jira_key'),
        sprint:        get(row, 'sprint'),
        parent_jira_key: parentJiraKey,
      };
    });

  if (jiraMode && epicKeyToChildKeys.size > 0) {
    const actByKey = new Map(activities.filter(a => a.jira_key).map(a => [a.jira_key, a]));
    for (const act of activities) {
      if (act.no !== 'EPIC' || !act.jira_key) continue;
      const childKeys = epicKeyToChildKeys.get(act.jira_key) ?? [];
      if (childKeys.length === 0) continue;
      const children = childKeys.map(k => actByKey.get(k)).filter((a): a is ImportActivity => a != null);
      const ws = children.map(c => statusW(c.status ?? 'To-do'));
      const ew = statusW(act.status ?? 'To-do');
      const allDone    = ws.length > 0 && ws.every(w => w >= 1);
      const anyStarted = ws.some(w => w > 0);
      if (allDone && ew < 1) act.status = 'Done';
      else if (anyStarted && ew === 0) act.status = 'In Progress';
    }
  }

  return activities;
}

export function countMappedFields(mapping: Record<string, string>): number {
  return ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).length;
}
