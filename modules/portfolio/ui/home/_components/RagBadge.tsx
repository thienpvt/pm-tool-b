import { RAG_STYLE } from './helpers';

export function RagBadge({ rag }: { rag: 'red' | 'amber' | 'green' }) {
  const s = RAG_STYLE[rag];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
