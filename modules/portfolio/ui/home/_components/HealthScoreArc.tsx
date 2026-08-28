import { healthLabel } from './helpers';

export function HealthScoreArc({ score }: { score: number }) {
  const r = 52, cx = 64, cy = 64;
  const startAngle = -210, totalAngle = 240;
  const pct = score / 100;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (a1: number, a2: number, color: string) => {
    const x1 = cx + r * Math.cos(toRad(a1));
    const y1 = cy + r * Math.sin(toRad(a1));
    const x2 = cx + r * Math.cos(toRad(a2));
    const y2 = cy + r * Math.sin(toRad(a2));
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
    return <path d={`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" />;
  };
  const fillEnd = startAngle + totalAngle * pct;
  const { label, color } = healthLabel(score);
  const arcColor = score >= 85 ? '#22c55e' : score >= 65 ? '#3b82f6' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="100" viewBox="0 0 128 110">
        {arcPath(startAngle, startAngle + totalAngle, '#e2e8f0')}
        {score > 0 && arcPath(startAngle, fillEnd, arcColor)}
        <text x="64" y="68" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#1e293b">{score}</text>
        <text x="64" y="82" textAnchor="middle" fontSize="9" fill="#94a3b8">out of 100</text>
      </svg>
      <span className={`text-sm font-bold -mt-1 ${color}`}>{label}</span>
    </div>
  );
}
