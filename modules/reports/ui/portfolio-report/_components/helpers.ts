export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function priorityColor(p: string): string {
  if (p === 'Critical') return 'text-red-600 bg-red-50 border-red-200';
  if (p === 'High') return 'text-orange-600 bg-orange-50 border-orange-200';
  if (p === 'Medium') return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

export const RAG_DOT: Record<string, string> = { red: 'bg-red-500', amber: 'bg-amber-400', green: 'bg-green-500' };
const RAG_ROW: Record<string, string> = { red: 'bg-red-50/40', amber: 'bg-amber-50/30', green: '' };

const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning: 'bg-blue-100 text-blue-700 border-blue-200',
  Execution: 'bg-amber-100 text-amber-700 border-amber-200',
  Closing: 'bg-green-100 text-green-700 border-green-200',
};

function progressColor(pct: number): string {
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 40) return 'bg-blue-500';
  if (pct >= 20) return 'bg-amber-400';
  return 'bg-red-400';
}

export function getThisMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}
export function getThisSunday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + 6);
  return d.toISOString().slice(0, 10);
}
export function fmtDateShort(s: string) {
  if (!s) return '';
  try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); } catch { return s; }
}
