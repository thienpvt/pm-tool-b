export const MO_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function rd(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function fmtD(s?: string | null): string {
  const d = rd(s);
  if (!d) return '—';
  return `${MO_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export const STATUS_BAR_COLOR: Record<string, { fill: string; ghost: string; border: string }> = {
  'New':                { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'To Do':              { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'To-do':              { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'REFINEMENT':         { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'In Dev':             { fill: '#3b82f6', ghost: '#dbeafe', border: '#60a5fa' },
  'In development':     { fill: '#3b82f6', ghost: '#dbeafe', border: '#60a5fa' },
  'Ready For Dev':      { fill: '#38bdf8', ghost: '#e0f2fe', border: '#7dd3fc' },
  'In Progress':        { fill: '#2563eb', ghost: '#dbeafe', border: '#60a5fa' },
  'In Review':          { fill: '#7c3aed', ghost: '#ede9fe', border: '#a78bfa' },
  'PENDING':            { fill: '#8b5cf6', ghost: '#ede9fe', border: '#a78bfa' },
  'In Testing':         { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Testing':            { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Ready for Test':     { fill: '#f59e0b', ghost: '#fef3c7', border: '#fbbf24' },
  'READY4TEST':         { fill: '#f59e0b', ghost: '#fef3c7', border: '#fbbf24' },
  'STAGING-READY4TEST': { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Re-Open':            { fill: '#ea580c', ghost: '#ffedd5', border: '#fb923c' },
  'Done':               { fill: '#16a34a', ghost: '#dcfce7', border: '#4ade80' },
  'UAT':                { fill: '#059669', ghost: '#d1fae5', border: '#34d399' },
  'Deployed':           { fill: '#0d9488', ghost: '#ccfbf1', border: '#2dd4bf' },
  'QC Done':            { fill: '#15803d', ghost: '#dcfce7', border: '#4ade80' },
  'READY TO RELEASE':   { fill: '#0f766e', ghost: '#ccfbf1', border: '#2dd4bf' },
  'READY FOR RELEASE':  { fill: '#0f766e', ghost: '#ccfbf1', border: '#2dd4bf' },
  'Passed QC':          { fill: '#15803d', ghost: '#dcfce7', border: '#4ade80' },
  'ANBM':               { fill: '#16a34a', ghost: '#dcfce7', border: '#4ade80' },
  'Blocked':            { fill: '#dc2626', ghost: '#fee2e2', border: '#f87171' },
  'Deferred':           { fill: '#64748b', ghost: '#f1f5f9', border: '#94a3b8' },
};
export function statusBar(status: string) {
  return STATUS_BAR_COLOR[status] ?? { fill: '#94a3b8', ghost: '#f1f5f9', border: '#cbd5e1' };
}

export function progressColor(pct: number): string {
  if (pct >= 100) return '#10b981';
  if (pct >= 75)  return '#22c55e';
  if (pct >= 50)  return '#3b82f6';
  if (pct >= 25)  return '#f59e0b';
  if (pct > 0)    return '#f97316';
  return '#94a3b8';
}
