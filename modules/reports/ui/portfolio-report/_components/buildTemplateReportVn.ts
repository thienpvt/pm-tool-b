import type { PortfolioReportData } from '../types';
import { pickSummary } from './SummaryTemplates';

export function buildTemplateReportVn(data: PortfolioReportData, periodStart: string, periodEnd: string, companyName: string, bugDimension: 'status' | 'severity'): string {
  const isVN = true;
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');

  const allProjects = [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');
  const overdue = allProjects.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0);
  const sorted = [...allProjects].sort((a, b) => ({ red: 0, amber: 1, green: 2 } as Record<string,number>)[a.rag] - ({ red: 0, amber: 1, green: 2 } as Record<string,number>)[b.rag]);

  const portfolioStatus = isVN
    ? (red.length > 0 ? 'ĐỎ' : amber.length > 0 ? 'VÀNG' : 'XANH')
    : (red.length > 0 ? 'RED' : amber.length > 0 ? 'AMBER' : 'GREEN');

  // Text helpers
  const rp = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s).padEnd(n);
  const lp = (s: string | number, n: number) => String(s).padStart(n);

  // Health matrix table — column widths
  const W = { n: 3, st: 10, nm: 22, cu: 15, ph: 10, pc: 5, dl: 14 } as const;
  const tHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(W.n+2)}${m}${'─'.repeat(W.st+2)}${m}${'─'.repeat(W.nm+2)}${m}${'─'.repeat(W.cu+2)}${m}${'─'.repeat(W.ph+2)}${m}${'─'.repeat(W.pc+2)}${m}${'─'.repeat(W.dl+2)}${r}`;
  const tRow = (n: string|number, st: string, nm: string, cu: string, ph: string, pc: string, dl: string) =>
    `  │ ${lp(n, W.n)} │ ${rp(st, W.st)} │ ${rp(nm, W.nm)} │ ${rp(cu, W.cu)} │ ${rp(ph, W.ph)} │ ${lp(pc, W.pc)} │ ${rp(dl, W.dl)} │`;

  // Program scorecard table — column widths
  const CS = { nm: 22, pr: 6, ac: 6, pct: 6, hl: 10, rk: 6, is: 6 } as const;
  const csHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(CS.nm+2)}${m}${'─'.repeat(CS.pr+2)}${m}${'─'.repeat(CS.ac+2)}${m}${'─'.repeat(CS.pct+2)}${m}${'─'.repeat(CS.hl+2)}${m}${'─'.repeat(CS.rk+2)}${m}${'─'.repeat(CS.is+2)}${r}`;
  const csRow = (nm: string, pr: string, ac: string, pct: string, hl: string, rk: string, is: string) =>
    `  │ ${rp(nm, CS.nm)} │ ${lp(pr, CS.pr)} │ ${lp(ac, CS.ac)} │ ${lp(pct, CS.pct)} │ ${rp(hl, CS.hl)} │ ${lp(rk, CS.rk)} │ ${lp(is, CS.is)} │`;

  // Milestone table — column widths
  const ML = { dt: 11, ms: 32, pj: 22, pc: 5 } as const;
  const mlHL = (l: string, m: string, r: string) =>
    `  ${l}${'─'.repeat(ML.dt+2)}${m}${'─'.repeat(ML.ms+2)}${m}${'─'.repeat(ML.pj+2)}${m}${'─'.repeat(ML.pc+2)}${r}`;
  const mlRow = (dt: string, ms: string, pj: string, pc: string) =>
    `  │ ${rp(dt, ML.dt)} │ ${rp(ms, ML.ms)} │ ${rp(pj, ML.pj)} │ ${lp(pc, ML.pc)} │`;

  const lines: string[] = [];
  const D = '  ' + '━'.repeat(94);
  const box1 = '  ╔' + '═'.repeat(92) + '╗';
  const box2 = '  ╚' + '═'.repeat(92) + '╝';
  const boxL = (s: string) => { const p = 92 - s.length; return `  ║${' '.repeat(Math.floor(p/2))}${s}${' '.repeat(p - Math.floor(p/2))}║`; };
  const sboxL = (s: string) => `  │ ${s}${' '.repeat(Math.max(0, 90 - s.length))} │`;
  const sbox1 = `  ┌${'─'.repeat(92)}┐`;
  const sbox2 = `  └${'─'.repeat(92)}┘`;

    // ── Header ───────────────────────────────────────────────────────────────
    lines.push(box1);
    lines.push(boxL('BÁO CÁO TÌNH TRẠNG PORTFOLIO'));
    lines.push(boxL('Program Management Office (PMO)'));
    lines.push(box2);
    lines.push('');
    lines.push(`  Ngày báo cáo   : ${today}              Mã tham chiếu : PMO-${yyyymm}-001`);
    lines.push(`  Kỳ báo cáo    : ${periodStart} → ${periodEnd}`);
    lines.push(`  Phân loại      : Bảo mật — Chỉ dành cho nội bộ`);
    lines.push(`  Phân phối      : CEO, Steering Committee, Portfolio Manager`);
    lines.push('');

    // ── Summary Statement ────────────────────────────────────────────────────
    {
      const ragKey = red.length > 0 ? 'red' : amber.length > 0 ? 'amber' : 'green';
      const summaryText = pickSummary(ragKey, 'vn');
      // Word-wrap at 88 chars per line to fit inside sboxL (90-char inner width)
      const words = summaryText.split(' ');
      const wrappedLines: string[] = [];
      let cur = '';
      for (const w of words) {
        if ((cur ? cur + ' ' + w : w).length > 88) { wrappedLines.push(cur); cur = w; }
        else cur = cur ? cur + ' ' + w : w;
      }
      if (cur) wrappedLines.push(cur);
      lines.push(sbox1);
      lines.push(sboxL('TÓM TẮT'));
      lines.push(sboxL(''));
      wrappedLines.forEach(l => lines.push(sboxL(l)));
      lines.push(sbox2);
      lines.push('');
    }

    // ── I. Executive Summary ─────────────────────────────────────────────────
    lines.push(D);
    lines.push('  I.  TÓM TẮT ĐIỀU HÀNH');
    lines.push(D);
    lines.push('');
    lines.push(`  Trạng thái tổng thể portfolio: ● ${portfolioStatus}`);
    lines.push('');
    const summaryVN = red.length > 0
      ? `Portfolio hiện có ${red.length} Squad/Dự án ở mức ĐỎ cần xử lý khẩn cấp.`
      : amber.length > 0 ? `Portfolio ở mức VÀNG với ${amber.length} Squad/Dự án cần theo dõi sát sao.`
        : 'Portfolio đang ở trạng thái tốt — toàn bộ Squad/Dự án đều xanh.';
    lines.push(`  ${summaryVN} Tổng cộng ${data.kpi.totalProjects} Squad/Dự án trên ${data.kpi.totalPrograms} chương trình,`);
    lines.push(`  tiến độ trung bình ${data.kpi.avgCompletion}% (tính theo trọng số trạng thái).`);
    lines.push(`  Phân bố sức khỏe: ${green.length} XANH  ·  ${amber.length} VÀNG  ·  ${red.length} ĐỎ.`);
    if (overdue.length > 0) lines.push(`\n  [!] CẢNH BÁO: ${overdue.length} Squad/Dự án đã vượt hạn chót — cần hành động ngay lập tức.`);
    if (data.kpi.totalOpenRisks === 0 && data.kpi.totalOpenIssues === 0) lines.push('  [+] Tích cực: Hiện không có rủi ro hoặc vấn đề nào đang mở ở cấp portfolio.');
    lines.push('');
    lines.push('  CHỈ SỐ CHÍNH:');
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Squad/Dự án tổng cộng  : ${data.kpi.totalProjects}      Đang hoạt động   : ${data.kpi.activeProjects}`);
    lines.push(`  Tiến độ TB (trọng số)  : ${data.kpi.avgCompletion}%    Chương trình      : ${data.kpi.totalPrograms}`);
    lines.push(`  Rủi ro đang mở         : ${data.kpi.totalOpenRisks}      Vấn đề đang mở   : ${data.kpi.totalOpenIssues}`);
    lines.push(`  Squad/Dự án quá hạn    : ${overdue.length}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push('');
    if (data.fteStats) {
      const fs = data.fteStats;
      const usedFte = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      lines.push('  NHÂN SỰ & NGUỒN LỰC KHỐI:');
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push(`  Định biên                : ${fs.headcountQuota > 0 ? fs.headcountQuota + ' người' : 'chưa thiết lập'}`);
      lines.push(`  FTE khả dụng net         : ${usedFte.toFixed(1)} FTE      Utilization: ${fs.headcountQuota > 0 ? fs.utilizationPct + '%' : '—'}`);
      lines.push(`  Fill rate khối           : ${fs.programFillRates.length > 0 ? fs.blockFillRate + '%' : '—'}           Cần tuyển  : ${fs.peopleNeeded} người`);
      lines.push(`  ${'─'.repeat(50)}`);
      lines.push('');
    }

    // ── II. Completed in Period ──────────────────────────────────────────────
    lines.push(D);
    lines.push('  II. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN');
    lines.push(D);
    lines.push(`  Kỳ báo cáo: ${periodStart} → ${periodEnd}`);
    lines.push('');
    const completedGroups = Object.values(data.completedByProject);
    if (completedGroups.length === 0) {
      lines.push('  Không có hoạt động nào hoàn thành trong giai đoạn này trên toàn portfolio.');
    } else {
      completedGroups.forEach((g, i) => {
        lines.push(`  ${String(i+1).padStart(2)}. ${g.project_name}${g.program_name ? ` (${g.program_name})` : ''} — ${g.current_phase}`);
        g.activities.forEach(a => {
          lines.push(`      [+]  ${a.activity}${a.deliverable ? `  →  ${a.deliverable}` : ''}${a.actual_end ? `  [${a.actual_end}]` : ''}`);
        });
        if (i < completedGroups.length - 1) lines.push('');
      });
    }
    lines.push('');

    // ── III. Actions Required ────────────────────────────────────────────────
    lines.push(D);
    lines.push('  III. HÀNH ĐỘNG CẦN THIẾT — Steering Committee / CEO');
    lines.push(D);
    lines.push('');
    const criticalRisksVN = data.topRisks.filter(r => r.priority === 'Critical');
    let actionIdxVN = 0;
    const actionsVN: string[] = [];
    red.forEach(p => {
      actionIdxVN++;
      const dl = p.days_until_deadline;
      const dlDesc = dl !== null && dl < 0 ? `quá hạn ${Math.abs(dl)} ngày` : 'đang gặp rủi ro nghiêm trọng';
      actionsVN.push(`  ${actionIdxVN}. [KHẨN CẤP — LEO THANG]  ${p.name} (${p.program_name || 'N/A'}) đang ${dlDesc}.`);
      actionsVN.push(`     → Đề xuất: Đưa vào chương trình nghị sự Steering Committee gần nhất, xem xét bổ sung nguồn lực hoặc điều chỉnh phạm vi.`);
    });
    criticalRisksVN.forEach(r => {
      actionIdxVN++;
      actionsVN.push(`  ${actionIdxVN}. [KHẨN CẤP — QUYẾT ĐỊNH]  ${r.description} tại Squad/Dự án ${r.project_name}.`);
      actionsVN.push(`     → Đề xuất: ${r.mitigation || 'Đánh giá và ban hành quyết định xử lý ngay lập tức'}.`);
    });
    if (actionsVN.length === 0) {
      lines.push('  Không có leo thang nào cần CEO xử lý ngay. Portfolio đang trong tầm kiểm soát.');
    } else {
      actionsVN.forEach(a => lines.push(a));
    }
    lines.push('');

    // ── IV. Bug Report ────────────────────────────────────────────────────────
    if (data.bugStats && data.bugStats.total > 0) {
      const bs = { ...data.bugStats, bySeverity: data.bugStats.bySeverity ?? {} };
      lines.push(D);
      lines.push('  IV. BUG REPORT — TỔNG HỢP LỖI TOÀN PORTFOLIO');
      lines.push(D);
      lines.push('');

      // Summary row
      const criticalBugsVN = (bs.bySeverity['Blocker'] ?? 0) + (bs.bySeverity['Critical'] ?? 0) + (bs.bySeverity['Highest'] ?? 0);
      const openBugsVN = (bs.byStatus['Open'] ?? 0) + (bs.byStatus['New'] ?? 0) + (bs.byStatus['To Do'] ?? 0) + (bs.byStatus['To-do'] ?? 0);
      lines.push(`  Tổng Bug : ${bs.total}   ·   Dự án có Bug: ${bs.byProject.length}   ·   Blocker/Critical: ${criticalBugsVN}   ·   Chưa xử lý: ${openBugsVN}`);
      lines.push('');

      const bugBW = { st: 24, ct: 8, pt: 8, br: 20 } as const;
      const SEV_ORDER_VN = ['Blocker','Critical','Highest','Major','High','Medium','Normal','Moderate','Low','Minor','Trivial','Lowest'];

      if (bugDimension === 'status') {
        lines.push('  A. PHÂN BỔ THEO TRẠNG THÁI:');
        lines.push(`  ${'─'.repeat(50)}`);
        Object.entries(bs.byStatus).sort((a, b) => b[1] - a[1]).forEach(([st, cnt]) => {
          const pct = bs.total > 0 ? Math.round(cnt / bs.total * 100) : 0;
          const barLen = Math.round(pct / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
          const stLabel = st.length > bugBW.st ? st.slice(0, bugBW.st - 1) + '…' : st;
          lines.push(`  ${stLabel.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
        });
      } else {
        lines.push('  A. PHÂN BỔ THEO SEVERITY:');
        lines.push(`  ${'─'.repeat(50)}`);
        const sevRows = [
          ...SEV_ORDER_VN.filter(sv => (bs.bySeverity[sv] ?? 0) > 0).map(sv => [sv, bs.bySeverity[sv]] as [string, number]),
          ...Object.entries(bs.bySeverity).filter(([sv]) => !SEV_ORDER_VN.includes(sv)).sort((a, b) => b[1] - a[1]),
        ];
        sevRows.forEach(([sv, cnt]) => {
          const pct = bs.total > 0 ? Math.round(cnt / bs.total * 100) : 0;
          const barLen = Math.round(pct / 5);
          const bar = '█'.repeat(barLen) + '░'.repeat(20 - barLen);
          lines.push(`  ${sv.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${bar}]`);
        });
      }
      lines.push('');

      // Per-project table
      lines.push('  B. PHÂN BỔ THEO DỰ ÁN:');
      const BP = { nm: 26, tt: 8 } as const;
      lines.push(`  ┌${'─'.repeat(BP.nm+2)}┬${'─'.repeat(BP.tt+2)}┐`);
      lines.push(`  │ ${'DỰ ÁN'.padEnd(BP.nm)} │ ${'TỔNG BUG'.padStart(BP.tt)} │`);
      lines.push(`  ├${'─'.repeat(BP.nm+2)}┼${'─'.repeat(BP.tt+2)}┤`);
      bs.byProject.slice(0, 15).forEach(p => {
        const nm = p.projectName.length > BP.nm ? p.projectName.slice(0, BP.nm - 1) + '…' : p.projectName;
        lines.push(`  │ ${nm.padEnd(BP.nm)} │ ${String(p.total).padStart(BP.tt)} │`);
      });
      lines.push(`  └${'─'.repeat(BP.nm+2)}┴${'─'.repeat(BP.tt+2)}┘`);
      lines.push('');
    }

    // ── V. Resource Allocation & Block Headcount Coverage ────────────────
    if (data.fteStats) {
      const fs = data.fteStats;
      const ps = data.personnelStats;
      const usedFte = fs.deliveryFte + fs.overheadProjectFte + fs.overheadRemainingFte;
      const overheadTotalFte = parseFloat((fs.overheadProjectFte + fs.overheadRemainingFte).toFixed(1));
      const donutBase = fs.headcountQuota > 0 ? fs.headcountQuota : parseFloat((usedFte + fs.benchFte).toFixed(1));
      const deliveryPct = donutBase > 0 ? Math.round((fs.deliveryFte / donutBase) * 100) : 0;
      const overheadPct = donutBase > 0 ? Math.round((overheadTotalFte / donutBase) * 100) : 0;
      const benchPct    = donutBase > 0 ? Math.round((fs.benchFte / donutBase) * 100) : 0;
      const fteShortfall = fs.programFillRates
        .filter(p => p.allocated > p.actual)
        .reduce((s, p) => s + (p.allocated - p.actual), 0);
      const overPrograms  = fs.programFillRates.filter(p => p.fillRate > 100);
      const underPrograms = fs.programFillRates.filter(p => p.allocated > 0 && p.fillRate < 90);

      lines.push(D);
      lines.push('  V. PHÂN BỔ NGUỒN LỰC & ĐỘ PHỦ ĐỊNH BIÊN TOÀN KHỐI');
      lines.push(D);
      lines.push('');

      // KPI table
      const KW = { lb: 38, vl: 22 } as const;
      const kRow = (lb: string, vl: string) => `  │ ${lb.padEnd(KW.lb)} │ ${vl.padStart(KW.vl)} │`;
      lines.push(`  ┌${'─'.repeat(KW.lb+2)}┬${'─'.repeat(KW.vl+2)}┐`);
      lines.push(`  │ ${'CHỈ SỐ'.padEnd(KW.lb)} │ ${'GIÁ TRỊ'.padStart(KW.vl)} │`);
      lines.push(`  ├${'─'.repeat(KW.lb+2)}┼${'─'.repeat(KW.vl+2)}┤`);
      lines.push(kRow('Định biên (người)',       fs.headcountQuota > 0 ? `${fs.headcountQuota} người` : 'chưa thiết lập'));
      lines.push(kRow('FTE khả dụng net (%FTE)', `${usedFte.toFixed(1)} FTE`));
      lines.push(kRow('Utilization (%)',          fs.headcountQuota > 0 ? `${fs.utilizationPct}%` : '—'));
      lines.push(kRow('Fill rate khối (%FTE)',    fs.programFillRates.length > 0 ? `${fs.blockFillRate}%` : '—'));
      lines.push(kRow('Số người cần tuyển (người)', `${fs.peopleNeeded} người`));
      lines.push(`  └${'─'.repeat(KW.lb+2)}┴${'─'.repeat(KW.vl+2)}┘`);
      lines.push('');

      // Capacity structure
      lines.push('  A. CƠ CẤU NĂNG LỰC KHỐI (FTE):');
      lines.push(`  ${'─'.repeat(60)}`);
      const bar = (pct: number) => '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      lines.push(`  Delivery  [${bar(deliveryPct)}] ${String(deliveryPct).padStart(3)}%  (${fs.deliveryFte.toFixed(1)} FTE)`);
      lines.push(`  Overhead  [${bar(overheadPct)}] ${String(overheadPct).padStart(3)}%  (${overheadTotalFte.toFixed(1)} FTE)`);
      lines.push(`  Bench     [${bar(benchPct)}] ${String(benchPct).padStart(3)}%  (${fs.benchFte.toFixed(1)} FTE)`);
      lines.push(`  ${'─'.repeat(60)}`);
      if (ps) lines.push(`  Định biên: ${fs.headcountQuota > 0 ? fs.headcountQuota + ' người' : '?'}  ·  Nhân sự thực tế trong khối: ${ps.totalInternal} người`);
      lines.push(`  Lưu ý: tổng lượt phân bổ đầu người ${ps ? ps.totalAllocated : '?'} > ${ps ? ps.totalInternal : '?'} người do shared resource.`);
      lines.push(`          Quy về FTE mới phản ánh đúng năng lực thực dùng.`);
      lines.push('');

      // Fill rate by program
      if (fs.programFillRates.length > 0) {
        lines.push('  B. FILL RATE THEO PROGRAM (FTE, sắp xếp giảm dần):');
        lines.push('');
        const PF = { nm: 24, al: 8, ac: 8, fr: 8 } as const;
        lines.push(`  ┌${'─'.repeat(PF.nm+2)}┬${'─'.repeat(PF.al+2)}┬${'─'.repeat(PF.ac+2)}┬${'─'.repeat(PF.fr+2)}┐`);
        lines.push(`  │ ${'PROGRAM'.padEnd(PF.nm)} │ ${'ĐN FTE'.padStart(PF.al)} │ ${'TT FTE'.padStart(PF.ac)} │ ${'FILL%'.padStart(PF.fr)} │`);
        lines.push(`  ├${'─'.repeat(PF.nm+2)}┼${'─'.repeat(PF.al+2)}┼${'─'.repeat(PF.ac+2)}┼${'─'.repeat(PF.fr+2)}┤`);
        fs.programFillRates.forEach(p => {
          const nm = p.programName.length > PF.nm ? p.programName.slice(0, PF.nm - 1) + '…' : p.programName;
          const flag = p.fillRate > 100 ? ' !' : p.fillRate < 70 ? ' ▼' : '';
          lines.push(`  │ ${nm.padEnd(PF.nm)} │ ${p.allocated.toFixed(1).padStart(PF.al)} │ ${p.actual.toFixed(1).padStart(PF.ac)} │ ${(String(p.fillRate) + '%' + flag).padStart(PF.fr)} │`);
        });
        lines.push(`  └${'─'.repeat(PF.nm+2)}┴${'─'.repeat(PF.al+2)}┴${'─'.repeat(PF.ac+2)}┴${'─'.repeat(PF.fr+2)}┘`);
        lines.push('');
        if (overPrograms.length > 0) {
          lines.push(`  [!] Program vượt định biên (>100%): ${overPrograms.map(p => p.programName).join(', ')}`);
          lines.push(`      → Nên xem xét điều chuyển nội bộ thay vì mở headcount mới.`);
        }
        if (underPrograms.length > 0) {
          lines.push(`  [▼] Program chưa đủ định biên (<90%): ${underPrograms.map(p => `${p.programName} (${p.fillRate}%)`).join(', ')}`);
        }
        if (fteShortfall > 0) {
          lines.push(`  Tổng FTE còn thiếu: ${fteShortfall.toFixed(1)} FTE → cần tuyển khoảng ${fs.peopleNeeded} người`);
          lines.push(`  (Làm tròn lên từ tổng thiếu hụt toàn khối, không làm tròn lẻ ở từng program.)`);
        } else {
          lines.push(`  Fill rate toàn khối đạt ${fs.blockFillRate}% — không có nhu cầu tuyển dụng hiện tại.`);
        }
      }
      lines.push('');
    }

    lines.push(D);
    lines.push(`  ${companyName ? companyName + '   ·   ' : ''}Program Management Office   ·   Tài liệu bảo mật — Nội bộ`);
    lines.push(D);

  return lines.join('\n');
}
