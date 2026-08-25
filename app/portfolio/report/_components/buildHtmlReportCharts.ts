import type { FteProgramRate } from '../types';

export function svgDonut(segs: {val:number,color:string}[], size=140, r=58, inner=36, centerPct?: number, isVN = false): string {
    const total = segs.reduce((a,s) => a+s.val, 0);
    const cx = size/2, cy = size/2;
    const emptyRing = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="${r - inner}"/>`;
    if (total === 0) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${emptyRing}</svg>`;
    }
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
      ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#111827">${centerPct}%</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="#6B7280">${isVN?'xong':'done'}</text>`
      : '';
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${paths}${hole}${lbl}</svg>`;
  }

  // SVG horizontal bar chart — fill rate by program
export function svgHBarChart(items: FteProgramRate[]): string {
    if (items.length === 0) return '';
    const maxPct = 120;
    const barH = 20;
    const gap = 10;
    const labelW = 130;
    const barAreaW = 360;
    const annW = 110;
    const totalW = labelW + barAreaW + annW;
    const totalH = items.length * (barH + gap) + 28;
    let s = `<svg width="100%" viewBox="0 0 ${totalW} ${totalH}" style="display:block;overflow:visible;">`;
    // gridlines
    [0, 30, 60, 90, 100, 120].forEach(pct => {
      const x = labelW + (pct / maxPct) * barAreaW;
      const col = pct === 90 ? 'rgba(22,163,74,0.35)' : 'rgba(0,0,0,0.06)';
      s += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${totalH - 18}" stroke="${col}" stroke-width="1"/>`;
      s += `<text x="${x.toFixed(1)}" y="${totalH - 4}" text-anchor="middle" font-size="8" fill="#9CA3AF">${pct}%</text>`;
    });
    items.forEach((item, i) => {
      const y = i * (barH + gap) + 2;
      const clampedPct = Math.min(item.fillRate, maxPct);
      const bw = (clampedPct / maxPct) * barAreaW;
      const col = item.fillRate >= 90 ? '#16A34A' : item.fillRate >= 70 ? '#D97706' : '#DC2626';
      const lbl = item.programName.length > 16 ? item.programName.slice(0, 16) + '…' : item.programName;
      s += `<text x="${labelW - 6}" y="${y + barH - 4}" text-anchor="end" font-size="9.5" fill="#374151">${lbl}</text>`;
      s += `<rect x="${labelW}" y="${y}" width="${barAreaW}" height="${barH}" fill="#F3F4F6" rx="3"/>`;
      if (bw > 0) s += `<rect x="${labelW}" y="${y}" width="${bw.toFixed(1)}" height="${barH}" fill="${col}" rx="3" opacity="0.85"/>`;
      if (item.fillRate > 100) {
        const x100 = labelW + (100 / maxPct) * barAreaW;
        s += `<line x1="${x100.toFixed(1)}" y1="${y}" x2="${x100.toFixed(1)}" y2="${y + barH}" stroke="rgba(0,0,0,0.25)" stroke-width="1" stroke-dasharray="2,2"/>`;
      }
      const ann = item.allocated > 0 ? `${item.fillRate}% · ${item.actual}/${item.allocated} FTE` : `${item.actual} FTE (—)`;
      s += `<text x="${labelW + barAreaW + 6}" y="${y + barH - 4}" font-size="9" fill="#374151">${ann}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  // SVG bar chart — stacked 3-segment: Done (green) / In Progress (blue) / Not Started (gray)
export function svgBarChart(items: {label:string,done:number,inProg:number,notStarted:number,total:number}[], w=800, h=160): string {
    const C_DONE = '#16A34A', C_PROG = '#3B82F6', C_TODO = '#E5E7EB';
    const rawMax = Math.max(...items.map(i => i.total), 1);
    const step = rawMax <= 5 ? 1 : rawMax <= 20 ? 5 : rawMax <= 50 ? 10 : 20;
    const max = Math.ceil(rawMax / step) * step;
    const topPad = 22;
    const n = items.length || 1;
    const leftPad = 28;
    const slotW = Math.floor((w - leftPad) / n);
    const barW = Math.min(52, Math.max(18, slotW - 12));
    const vbH = h + topPad + 46;
    let s = `<svg width="100%" viewBox="0 0 ${w} ${vbH}" preserveAspectRatio="xMidYMid meet" style="display:block;">`;
    for (let i = 0; i <= max; i += step) {
      const y = topPad + h - Math.round((i / max) * h);
      s += `<line x1="${leftPad}" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>`;
      s += `<text x="${leftPad - 5}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9CA3AF">${i}</text>`;
    }
    s += `<line x1="${leftPad}" y1="${topPad + h}" x2="${w}" y2="${topPad + h}" stroke="rgba(0,0,0,0.12)" stroke-width="1"/>`;
    items.forEach((item, i) => {
      const x = leftPad + i * slotW + (slotW - barW) / 2;
      const totalH   = max > 0 ? Math.round((item.total   / max) * h) : 0;
      const doneH    = max > 0 ? Math.round((item.done    / max) * h) : 0;
      const inProgH  = max > 0 ? Math.round((item.inProg  / max) * h) : 0;
      const barTop = topPad + h - totalH;
      // Render full bar as gray (not started) background
      if (totalH > 0) s += `<rect x="${x.toFixed(1)}" y="${barTop.toFixed(1)}" width="${barW}" height="${totalH}" fill="${C_TODO}" rx="3"/>`;
      // Overlay blue (in progress + done region)
      const progH = doneH + inProgH;
      if (progH > 0) s += `<rect x="${x.toFixed(1)}" y="${(topPad + h - progH).toFixed(1)}" width="${barW}" height="${progH}" fill="${C_PROG}"/>`;
      // Overlay green (done region at bottom)
      if (doneH > 0) s += `<rect x="${x.toFixed(1)}" y="${(topPad + h - doneH).toFixed(1)}" width="${barW}" height="${doneH}" fill="${C_DONE}"/>`;
      // Label above bar — total epic count only
      const lblY = barTop - 5;
      s += `<text x="${(x + barW / 2).toFixed(1)}" y="${lblY.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#374151">${item.total}</text>`;
      const shortLbl = item.label.length > 12 ? item.label.slice(0, 12) + '…' : item.label;
      s += `<text x="${(x + barW / 2).toFixed(1)}" y="${topPad + h + 17}" text-anchor="middle" font-size="10" fill="#6B7280">${shortLbl}</text>`;
    });
    s += `</svg>`;
    return s;
  }

  // All CSS scoped under .rpd-wrap — white background theme
export const HTML_REPORT_CSS = `<style>
.rpd-wrap{background:#FFFFFF;color:#111827;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;}
.rpd-wrap *{box-sizing:border-box;}
.rpd-wrap .rpd-tb{background:#FFFFFF;border-bottom:3px solid #E8192C;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;}
.rpd-wrap .rpd-tb-l{font-family:Georgia,serif;font-size:15px;font-weight:700;color:#111827;margin:0;letter-spacing:.3px;}
.rpd-wrap .rpd-tb-s{font-size:10px;color:#6B7280;margin:2px 0 0;letter-spacing:.8px;text-transform:uppercase;}
.rpd-wrap .rpd-pg{max-width:1260px;margin:0 auto;padding:24px 20px 52px;}
.rpd-wrap .rpd-zlbl{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#E8192C;margin:0 0 14px;display:flex;align-items:center;gap:10px;}
.rpd-wrap .rpd-znum{width:21px;height:21px;border-radius:50%;background:#E8192C;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-zsep{height:1px;background:#E5E7EB;margin:26px 0;}
.rpd-wrap .rpd-panel{background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:18px;}
.rpd-wrap .rpd-ptitle{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:#6B7280;margin:0 0 14px;}
.rpd-wrap .rpd-pies{display:flex;gap:12px;margin:0 0 12px;}
.rpd-wrap .rpd-pie-col{flex:1;min-width:0;}
.rpd-wrap .rpd-pie-lay{display:flex;align-items:center;gap:14px;}
.rpd-wrap .rpd-pie-leg{flex:1;min-width:0;}
.rpd-wrap .rpd-leg-row{display:flex;align-items:center;gap:7px;font-size:11px;color:#6B7280;margin:0 0 7px;}
.rpd-wrap .rpd-leg-dot{width:9px;height:9px;border-radius:3px;flex-shrink:0;}
.rpd-wrap .rpd-leg-val{margin-left:auto;font-weight:600;color:#111827;font-size:12px;white-space:nowrap;}
.rpd-wrap .rpd-bar-panel{margin:0 0 12px;}
.rpd-wrap .rpd-sum-row{display:flex;gap:12px;margin:0 0 12px;}
.rpd-wrap .rpd-pill{background:#F8F9FA;border:1px solid #E5E7EB;border-radius:8px;padding:14px;flex:1;min-width:0;}
.rpd-wrap .rpd-pill-hd{display:flex;align-items:flex-start;gap:10px;margin:0 0 10px;}
.rpd-wrap .rpd-pill-ico{width:34px;height:34px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-pill-nm{font-size:13px;font-weight:600;color:#111827;margin:0;}
.rpd-wrap .rpd-pill-sb{font-size:11px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-bar-tr{background:rgba(0,0,0,0.07);border-radius:3px;height:4px;overflow:hidden;}
.rpd-wrap .rpd-bar-fi{height:4px;border-radius:3px;}
.rpd-wrap .rpd-ep-dots{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 0;}
.rpd-wrap .rpd-ep-dot{display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.09);border-radius:4px;padding:2px 7px;font-size:10px;color:#6B7280;}
.rpd-wrap .rpd-pb{background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin:0 0 14px;}
.rpd-wrap .rpd-pb-hd{background:#F8F9FA;padding:12px 18px;border-bottom:1px solid #E5E7EB;display:flex;align-items:center;gap:12px;}
.rpd-wrap .rpd-pb-ico{width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0;}
.rpd-wrap .rpd-pb-nm{font-size:14px;font-weight:600;color:#111827;margin:0;}
.rpd-wrap .rpd-pb-sb{font-size:11px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-pb-bar{height:2px;background:#F1F3F5;}
.rpd-wrap .rpd-pb-body{padding:14px 18px;}
.rpd-wrap .rpd-et{width:100%;border-collapse:collapse;}
.rpd-wrap .rpd-et th{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;padding:6px 10px 8px;text-align:left;border-bottom:1px solid #E5E7EB;}
.rpd-wrap .rpd-et td{padding:9px 10px;border-bottom:1px solid #F3F4F6;font-size:12px;vertical-align:middle;}
.rpd-wrap .rpd-et tr:last-child td{border-bottom:none;}
.rpd-wrap .rpd-et tbody tr:hover td{background:#F9FAFB;}
.rpd-wrap .rpd-stag{display:inline-block;padding:2px 9px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;}
.rpd-wrap .rpd-pgbar{background:#E5E7EB;border-radius:2px;height:6px;overflow:hidden;}
.rpd-wrap .rpd-pgfill{height:6px;border-radius:2px;}
.rpd-wrap .rpd-act-sum{margin:12px 0 0;padding:12px 14px;background:#F8F9FA;border-radius:6px;border:1px solid #E5E7EB;}
.rpd-wrap .rpd-act-ttl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6B7280;margin:0 0 8px;}
.rpd-wrap .rpd-act-row{display:flex;}
.rpd-wrap .rpd-act-st{flex:1;}
.rpd-wrap .rpd-act-num{font-size:22px;font-weight:700;margin:0;}
.rpd-wrap .rpd-act-lbl{font-size:10px;color:#6B7280;margin:2px 0 0;}
.rpd-wrap .rpd-ft{border-top:1px solid #E5E7EB;padding-top:14px;margin-top:24px;display:flex;justify-content:space-between;align-items:center;}
.rpd-wrap .rpd-ft-brand{font-family:Georgia,serif;font-size:13px;color:#111827;font-weight:700;margin:0;letter-spacing:.3px;}
</style>`;
