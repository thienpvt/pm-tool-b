import type { ProjectRow } from '../types';

export const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700 border-purple-200',
  Planning:   'bg-blue-100 text-blue-700 border-blue-200',
  Execution:  'bg-amber-100 text-amber-700 border-amber-200',
  Closing:    'bg-green-100 text-green-700 border-green-200',
};
export const INDUSTRY_COLOR: Record<string, string> = {
  'Banking & Finance': 'bg-blue-100 text-blue-700',
  'Fintech': 'bg-cyan-100 text-cyan-700',
  'Insurance': 'bg-purple-100 text-purple-700',
  'Retail': 'bg-orange-100 text-orange-700',
  'Healthcare': 'bg-green-100 text-green-700',
  'Technology': 'bg-indigo-100 text-indigo-700',
};
export function avatarBg(name: string) {
  const colors = ['bg-blue-500','bg-purple-500','bg-green-500','bg-orange-500','bg-pink-500','bg-cyan-500','bg-indigo-500','bg-rose-500'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}
export function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
export function daysLeft(endDate: string) {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate + 'T00:00:00').getTime() - Date.now()) / 86400000);
}
export function projectHealthScore(p: ProjectRow): number {
  if (p.rag === 'red')   return Math.min(40, p.completion_pct * 0.4);
  if (p.rag === 'amber') return 40 + Math.round(p.completion_pct * 0.4);
  return 65 + Math.round(p.completion_pct * 0.35);
}
export function healthLabel(score: number) {
  if (score >= 85) return { label: 'Excellent', color: 'text-green-600' };
  if (score >= 65) return { label: 'Good',      color: 'text-blue-600' };
  if (score >= 45) return { label: 'Fair',       color: 'text-amber-600' };
  return               { label: 'Critical',     color: 'text-red-600' };
}
export function healthBarColor(score: number) {
  if (score >= 85) return 'bg-green-500';
  if (score >= 65) return 'bg-blue-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

export const RAG_STYLE = {
  red:   { dot: 'bg-red-500',   pill: 'bg-red-50 text-red-600 border-red-200',   label: 'RED' },
  amber: { dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-600 border-amber-200', label: 'AMBER' },
  green: { dot: 'bg-green-500', pill: 'bg-green-50 text-green-600 border-green-200', label: 'GREEN' },
};
