export type PhaseStyle = { labelBg: string; bg: string; border: string; fill: string; textColor: string };

export const PS: Record<string, PhaseStyle> = {
  Initiation: { labelBg: 'bg-purple-100 text-purple-700', bg: '#f3e8ff', border: '#9333ea', fill: '#c084fc', textColor: '#6b21a8' },
  Planning:   { labelBg: 'bg-blue-100 text-blue-700',     bg: '#dbeafe', border: '#2563eb', fill: '#60a5fa', textColor: '#1e40af' },
  Execution:  { labelBg: 'bg-amber-100 text-amber-700',   bg: '#fef3c7', border: '#d97706', fill: '#fbbf24', textColor: '#92400e' },
  Closing:    { labelBg: 'bg-green-100 text-green-700',   bg: '#dcfce7', border: '#16a34a', fill: '#4ade80', textColor: '#14532d' },
};
export const PHASES = ['Initiation', 'Planning', 'Execution', 'Closing'] as const;

export const RAG_COLOR: Record<string, string> = { red: '#ef4444', amber: '#f59e0b', green: '#22c55e' };
