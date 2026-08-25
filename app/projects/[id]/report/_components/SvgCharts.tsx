export function svgDonut(segs: {val:number,color:string}[], size=140, r=58, inner=36, centerPct?: number): string {
  const total = segs.reduce((a,s) => a+s.val, 0);
  const cx = size/2, cy = size/2;
  const emptyRing = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="${r - inner}"/>`;
  if (total === 0) return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${emptyRing}</svg>`;
  let start = -Math.PI / 2;
  let paths = '';
  for (const seg of segs) {
    if (seg.val <= 0) continue;
    const angle = (seg.val / total) * Math.PI * 2;
    if (Math.abs(angle - Math.PI * 2) < 0.001) {
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${seg.color}"/>`;
    } else {
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(start + angle), y2 = cy + r * Math.sin(start + angle);
      paths += `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r},0,${angle > Math.PI ? 1 : 0},1,${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${seg.color}"/>`;
    }
    start += angle;
  }
  const hole = `<circle cx="${cx}" cy="${cy}" r="${inner}" fill="#F8F9FA"/>`;
  const lbl = centerPct !== undefined
    ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#111827">${centerPct}%</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="#6B7280">xong</text>`
    : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}${hole}${lbl}</svg>`;
}
