export type EpicStyle = { bg: string; fill: string; border: string; textColor: string };
export const EPIC_PALETTE: EpicStyle[] = [
  { bg: '#ecfeff', fill: '#22d3ee', border: '#0e7490', textColor: '#155e75' }, // cyan
  { bg: '#fff1f2', fill: '#fb7185', border: '#be123c', textColor: '#9f1239' }, // rose
  { bg: '#f0fdfa', fill: '#2dd4bf', border: '#0f766e', textColor: '#115e59' }, // teal
  { bg: '#fdf4ff', fill: '#e879f9', border: '#a21caf', textColor: '#86198f' }, // fuchsia
  { bg: '#eef2ff', fill: '#818cf8', border: '#4338ca', textColor: '#3730a3' }, // indigo
  { bg: '#fff7ed', fill: '#fb923c', border: '#c2410c', textColor: '#9a3412' }, // orange
];
export function epicStyle(id: number): EpicStyle { return EPIC_PALETTE[id % EPIC_PALETTE.length]; }

export const STATUS_COLOR: Record<string, string> = {
  'Done': 'bg-green-100 text-green-700', 'Deployed': 'bg-green-100 text-green-700',
  'UAT': 'bg-green-100 text-green-700', 'QC Done': 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700', 'In Review': 'bg-indigo-100 text-indigo-700',
  'In Testing': 'bg-cyan-100 text-cyan-700', 'In Dev': 'bg-amber-100 text-amber-700',
  'To-do': 'bg-slate-100 text-slate-500', 'To Do': 'bg-slate-100 text-slate-500',
  'Blocked': 'bg-red-100 text-red-700', 'New': 'bg-slate-100 text-slate-500',
};
export function statusColor(s: string) { return STATUS_COLOR[s] ?? 'bg-slate-100 text-slate-500'; }
