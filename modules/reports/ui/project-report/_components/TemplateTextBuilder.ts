import type { ProjectReportData } from '../types';

export function buildProjectReport(data: ProjectReportData, language: string): string {
  const isVN = language === 'Vietnamese';
  const { project, periodStart, periodEnd, stats, epicStats, completedInPeriod, openRisks, openIssues, bugStats, selectedMilestone } = data;
  const today = new Date().toLocaleDateString(isVN ? 'vi-VN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '');
  const fmtD = (s: string | null | undefined) => {
    if (!s) return '—';
    try { return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
  };
  const rag = project.rag;
  const ragLabel = isVN ? (rag === 'red' ? 'ĐỎ' : rag === 'amber' ? 'VÀNG' : 'XANH') : (rag === 'red' ? 'RED' : rag === 'amber' ? 'AMBER' : 'GREEN');
  const lines: string[] = [];
  const D = '  ' + '━'.repeat(94);
  const box1 = '  ╔' + '═'.repeat(92) + '╗';
  const box2 = '  ╚' + '═'.repeat(92) + '╝';
  const boxL = (s: string) => { const p = 92 - s.length; return `  ║${' '.repeat(Math.floor(p/2))}${s}${' '.repeat(p - Math.floor(p/2))}║`; };
  const sbox1 = `  ┌${'─'.repeat(92)}┐`; const sbox2 = `  └${'─'.repeat(92)}┘`;
  const sboxL = (s: string) => `  │ ${s}${' '.repeat(Math.max(0, 90 - s.length))} │`;
  const rp = (s: string, n: number) => (s.length > n ? s.slice(0, n-1)+'…' : s).padEnd(n);
  const lp = (s: string|number, n: number) => String(s).padStart(n);
  const bugBW = { st: 24, ct: 8 } as const;
  const wrap = (text: string, maxLen: number): string[] => {
    const words = text.split(' '); const result: string[] = []; let cur = '';
    for (const w of words) {
      if ((cur ? cur+' '+w : w).length > maxLen) { result.push(cur); cur = w; }
      else cur = cur ? cur+' '+w : w;
    }
    if (cur) result.push(cur); return result;
  };

  const header = () => {
    lines.push(box1);
    lines.push(boxL(isVN ? 'BÁO CÁO TÌNH TRẠNG DỰ ÁN' : 'PROJECT STATUS REPORT'));
    lines.push(boxL(project.name.toUpperCase()));
    lines.push(box2); lines.push('');
    lines.push(`  ${isVN?'Ngày báo cáo   ':'Report Date    '}: ${today}              ${isVN?'Mã tham chiếu':'Reference'} : PRJ-${yyyymm}-001`);
    lines.push(`  ${isVN?'Kỳ báo cáo    ':'Period         '}: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`);
    if (selectedMilestone) lines.push(`  ${isVN?'Milestone      ':'Milestone      '}: ${selectedMilestone.name}`);
    lines.push(`  ${isVN?'Phân loại      ':'Classification '}: ${isVN?'Bảo mật — Chỉ dành cho nội bộ':'Confidential — Internal Distribution Only'}`);
    lines.push(`  ${isVN?'Phân phối      ':'Distribution   '}: ${isVN?'PM, Project Sponsor, Steering Committee':'PM, Project Sponsor, Steering Committee'}`);
    lines.push(`  ${isVN?'Giai đoạn      ':'Phase          '}: ${project.current_phase}`);
    lines.push(`  ${isVN?'Khách hàng     ':'Customer       '}: ${project.customer_name || project.program_name || 'N/A'}`);
    lines.push(`  ${isVN?'PM             ':'PM             '}: ${project.pm_name || 'N/A'}`);
    lines.push(`  ${isVN?'Ngày kết thúc  ':'End Date       '}: ${project.end_date ? fmtD(project.end_date) : 'N/A'}${project.days_until_deadline !== null ? ` (${project.days_until_deadline < 0 ? (isVN?`Quá hạn ${Math.abs(project.days_until_deadline)} ngày`:`OVERDUE ${Math.abs(project.days_until_deadline)} days`) : (isVN?`Còn ${project.days_until_deadline} ngày`:`${project.days_until_deadline} days remaining`)})` : ''}`);
    lines.push('');
    const summaryText = rag === 'red'
      ? (isVN ? `Dự án đang ở trạng thái ĐỎ — có các vấn đề nghiêm trọng cần được xử lý khẩn cấp. Tính đến kỳ báo cáo, dự án đã hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động.` : `Project is tracking RED — critical issues require immediate attention. As of this period, ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities.`)
      : rag === 'amber'
      ? (isVN ? `Dự án đang ở trạng thái VÀNG — có một số rủi ro/vấn đề cần theo dõi. Hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động.` : `Project is tracking AMBER — risks present. ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities.`)
      : (isVN ? `Dự án đang vận hành tốt ở trạng thái XANH. Hoàn thành ${stats.completion_pct}% với ${stats.done}/${stats.total} hoạt động — tất cả chỉ số trong ngưỡng kiểm soát.` : `Project is tracking GREEN. ${stats.completion_pct}% complete with ${stats.done}/${stats.total} activities — all indicators within acceptable range.`);
    lines.push(sbox1); lines.push(sboxL(isVN?'TÓM TẮT':'SUMMARY')); lines.push(sboxL(''));
    wrap(summaryText, 88).forEach(l => lines.push(sboxL(l)));
    lines.push(sbox2); lines.push('');
  };

  header();

  // I. Executive Summary
  lines.push(D); lines.push(isVN ? '  I.  TÓM TẮT ĐIỀU HÀNH' : '  I.  EXECUTIVE SUMMARY'); lines.push(D); lines.push('');
  lines.push(`  ${isVN?'Trạng thái tổng thể dự án':'Overall Project Status'}: ● ${ragLabel}`); lines.push('');
  if (project.days_until_deadline !== null && project.days_until_deadline < 0) lines.push(`\n  ${isVN?`[!] CẢNH BÁO: Dự án đã quá hạn ${Math.abs(project.days_until_deadline)} ngày`:`[!] ALERT: Project is OVERDUE by ${Math.abs(project.days_until_deadline)} days`}.`);
  const s1 = rag==='red' ? (isVN?`Dự án hiện ở mức ĐỎ với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề đang mở.`:`Project at RED with ${openRisks.length} open risks and ${openIssues.length} open issues.`) : rag==='amber' ? (isVN?`Dự án ở mức VÀNG với ${openRisks.length} rủi ro và ${openIssues.length} vấn đề.`:`Project at AMBER with ${openRisks.length} risks and ${openIssues.length} issues.`) : (isVN?'Dự án đang ở trạng thái tốt.':'Project is tracking well.');
  lines.push(`  ${s1}`);
  if (openRisks.length === 0 && openIssues.length === 0) lines.push(`  ${isVN?'[+] Tích cực: Không có rủi ro hoặc vấn đề nào đang mở.':'[+] Positive: No open risks or issues.'}`);
  lines.push(''); lines.push(`  ${isVN?'CHỈ SỐ CHÍNH':'KEY METRICS'}:`);
  lines.push(`  ${'─'.repeat(50)}`);
  lines.push(`  ${isVN?'Hoạt động tổng cộng ':'Total Activities    '}: ${stats.total}      ${isVN?'Đang hoạt động':'Active           '}: ${stats.inProgress}`);
  lines.push(`  ${isVN?'Tiến độ TB (trọng số)':'Avg. Completion     '}: ${stats.completion_pct}%    ${isVN?'Hoàn thành       ':'Done              '}: ${stats.done}`);
  lines.push(`  ${isVN?'Rủi ro đang mở      ':'Open Risks          '}: ${openRisks.length}      ${isVN?'Vấn đề đang mở  ':'Open Issues       '}: ${openIssues.length}`);
  lines.push(`  ${'─'.repeat(50)}`); lines.push('');
  const barLen = 40; const filled = Math.round((stats.completion_pct/100)*barLen);
  lines.push(`  ${isVN?'Tiến độ':'Progress'}: [${'█'.repeat(filled)}${'░'.repeat(barLen-filled)}] ${stats.completion_pct}%`); lines.push('');

  // II. Completed
  lines.push(D); lines.push(isVN?'  II. TIẾN ĐỘ THEO KỲ — HOÀN THÀNH TRONG GIAI ĐOẠN':'  II. PROGRESS REPORT — COMPLETED IN PERIOD'); lines.push(D);
  lines.push(`  ${isVN?'Kỳ báo cáo':'Reporting Period'}: ${fmtD(periodStart)} → ${fmtD(periodEnd)}`); lines.push('');
  if (completedInPeriod.length === 0) {
    lines.push(`  ${isVN?'Không có hoạt động nào hoàn thành trong giai đoạn này.':'No activities completed in this period.'}`);
  } else {
    completedInPeriod.forEach((a, i) => {
      lines.push(`  ${String(i+1).padStart(2)}. ${project.name}${project.current_phase ? ` — ${project.current_phase}` : ''}`);
      lines.push(`      [+]  ${a.activity}${a.deliverable?`  →  ${a.deliverable}`:''}${a.actual_end?`  [${a.actual_end}]`:''}`);
    });
  }
  lines.push('');

  // III. Actions Required
  lines.push(D); lines.push(isVN?'  III. HÀNH ĐỘNG CẦN THIẾT — PM / Project Sponsor':'  III. ACTIONS REQUIRED — PM / Project Sponsor'); lines.push(D); lines.push('');
  let ai = 0; const acts: string[] = [];
  if (project.days_until_deadline !== null && project.days_until_deadline < 0) {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — QUÁ HẠN]  Dự án đã quá hạn ${Math.abs(project.days_until_deadline)} ngày.`:`[URGENT — OVERDUE]  Project is overdue by ${Math.abs(project.days_until_deadline)} days.`}`);
    acts.push(`     → ${isVN?'Đề xuất: Xem xét lại kế hoạch, nguồn lực và phạm vi với Project Sponsor ngay lập tức.':'Recommend: Immediate review of plan, resources and scope with Project Sponsor.'}`);
  }
  openRisks.forEach(r => {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — RỦI RO ${r.priority.toUpperCase()}]  ${r.description}`:`[URGENT — RISK ${r.priority.toUpperCase()}]  ${r.description}`}`);
    acts.push(`     → ${isVN?'Đề xuất':'Recommend'}: ${r.mitigation || (isVN?'Đánh giá và triển khai biện pháp xử lý ngay lập tức.':'Immediate assessment and corrective action required.')}`);
  });
  openIssues.forEach(r => {
    ai++;
    acts.push(`  ${ai}. ${isVN?`[KHẨN CẤP — VẤN ĐỀ ${r.priority.toUpperCase()}]  ${r.description}`:`[URGENT — ISSUE ${r.priority.toUpperCase()}]  ${r.description}`}`);
    acts.push(`     → ${isVN?'Đề xuất':'Recommend'}: ${r.mitigation || (isVN?'Cần hành động ngay lập tức.':'Immediate action required.')}`);
  });
  if (acts.length === 0) lines.push(`  ${isVN?'Không có leo thang nào cần PM xử lý ngay. Dự án đang trong tầm kiểm soát.':'No immediate escalations required. Project is under control.'}`);
  else acts.forEach(a => lines.push(a));
  lines.push('');

  // IV. Bug Report
  if (bugStats && bugStats.total > 0) {
    lines.push(D); lines.push(isVN?'  IV. BUG REPORT — TỔNG HỢP LỖI DỰ ÁN':'  IV. BUG REPORT — PROJECT BUG SUMMARY'); lines.push(D); lines.push('');
    const critB = (bugStats.byPriority['Critical']??0)+(bugStats.byPriority['Highest']??0);
    const openB = (bugStats.byStatus['Open']??0)+(bugStats.byStatus['New']??0)+(bugStats.byStatus['To Do']??0)+(bugStats.byStatus['To-do']??0);
    lines.push(`  ${isVN?'Tổng Bug':'Total Bugs'}: ${bugStats.total}   ·   Critical/Highest: ${critB}   ·   ${isVN?'Chưa xử lý':'Open/New'}: ${openB}`); lines.push('');
    lines.push(`  A. ${isVN?'PHÂN BỔ THEO TRẠNG THÁI':'DISTRIBUTION BY STATUS'}:`); lines.push(`  ${'─'.repeat(50)}`);
    Object.entries(bugStats.byStatus).sort((a,b)=>b[1]-a[1]).forEach(([st,cnt]) => {
      const pct = Math.round(cnt/bugStats.total*100);
      const bLen = Math.round(pct/5);
      const stLabel = st.length > bugBW.st ? st.slice(0,bugBW.st-1)+'…' : st;
      lines.push(`  ${stLabel.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%) [${'█'.repeat(bLen)}${'░'.repeat(20-bLen)}]`);
    });
    lines.push('');
    lines.push(`  B. ${isVN?'PHÂN BỔ THEO PRIORITY':'DISTRIBUTION BY PRIORITY'}:`); lines.push(`  ${'─'.repeat(50)}`);
    ['Critical','Highest','High','Medium','Low','Lowest'].forEach(pr => {
      const cnt = bugStats.byPriority[pr]; if (!cnt) return;
      const pct = Math.round(cnt/bugStats.total*100);
      lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
    });
    Object.entries(bugStats.byPriority).filter(([pr])=>!['Critical','Highest','High','Medium','Low','Lowest'].includes(pr)).forEach(([pr,cnt]) => {
      const pct = Math.round(cnt/bugStats.total*100);
      lines.push(`  ${pr.padEnd(bugBW.st)} ${String(cnt).padStart(bugBW.ct)} (${String(pct).padStart(3)}%)`);
    });
    lines.push('');
  }

  // V. Epic/Phase Progress
  if (epicStats.length > 0) {
    const epicsDone = epicStats.filter(e=>e.pct>=100).length;
    const epicsInProg = epicStats.filter(e=>e.pct>0&&e.pct<100).length;
    const epicsNot = epicStats.filter(e=>e.pct===0).length;
    lines.push(D); lines.push(isVN?'  V.  TIẾN ĐỘ THEO EPIC / PHASE':'  V.  EPIC / PHASE PROGRESS'); lines.push(D); lines.push('');
    const KW = { lb: 38, vl: 22 } as const;
    const kRow = (lb: string, vl: string) => `  │ ${lb.padEnd(KW.lb)} │ ${vl.padStart(KW.vl)} │`;
    lines.push(`  ┌${'─'.repeat(KW.lb+2)}┬${'─'.repeat(KW.vl+2)}┐`);
    lines.push(`  │ ${(isVN?'CHỈ SỐ':'METRIC').padEnd(KW.lb)} │ ${(isVN?'GIÁ TRỊ':'VALUE').padStart(KW.vl)} │`);
    lines.push(`  ├${'─'.repeat(KW.lb+2)}┼${'─'.repeat(KW.vl+2)}┤`);
    lines.push(kRow(isVN?'Tổng Epic / Phase':'Total Epics / Phases', `${epicStats.length} epic(s)`));
    lines.push(kRow(isVN?'Hoàn thành (≥100%)':'Complete (≥100%)', `${epicsDone} epic(s)`));
    lines.push(kRow(isVN?'Đang triển khai (1–99%)':'In Progress (1–99%)', `${epicsInProg} epic(s)`));
    lines.push(kRow(isVN?'Chưa bắt đầu (0%)':'Not Started (0%)', `${epicsNot} epic(s)`));
    lines.push(kRow(isVN?'Tiến độ tổng thể (trọng số)':'Overall Completion (weighted)', `${stats.completion_pct}%`));
    lines.push(`  └${'─'.repeat(KW.lb+2)}┴${'─'.repeat(KW.vl+2)}┘`); lines.push('');
    lines.push(`  A. ${isVN?'TIẾN ĐỘ CHI TIẾT THEO EPIC (sắp xếp giảm dần)':'EPIC DETAIL (sorted descending)'}:`); lines.push('');
    const EW = { nm: 28, pc: 6, dn: 8, tt: 8, br: 22 } as const;
    lines.push(`  ┌${'─'.repeat(EW.nm+2)}┬${'─'.repeat(EW.pc+2)}┬${'─'.repeat(EW.dn+2)}┬${'─'.repeat(EW.tt+2)}┬${'─'.repeat(EW.br+2)}┐`);
    lines.push(`  │ ${'EPIC / PHASE'.padEnd(EW.nm)} │ ${'PCT'.padStart(EW.pc)} │ ${'DONE'.padStart(EW.dn)} │ ${'TOTAL'.padStart(EW.tt)} │ ${(isVN?'TIẾN ĐỘ':'PROGRESS').padEnd(EW.br)} │`);
    lines.push(`  ├${'─'.repeat(EW.nm+2)}┼${'─'.repeat(EW.pc+2)}┼${'─'.repeat(EW.dn+2)}┼${'─'.repeat(EW.tt+2)}┼${'─'.repeat(EW.br+2)}┤`);
    [...epicStats].sort((a,b)=>b.pct-a.pct).forEach(e => {
      const bLen = 20; const f = Math.round((e.pct/100)*bLen);
      lines.push(`  │ ${rp(e.phase,EW.nm)} │ ${lp(e.pct+'%',EW.pc)} │ ${lp(e.done,EW.dn)} │ ${lp(e.total,EW.tt)} │ [${'█'.repeat(f)}${'░'.repeat(bLen-f)}] │`);
    });
    lines.push(`  └${'─'.repeat(EW.nm+2)}┴${'─'.repeat(EW.pc+2)}┴${'─'.repeat(EW.dn+2)}┴${'─'.repeat(EW.tt+2)}┴${'─'.repeat(EW.br+2)}┘`); lines.push('');
  }

  lines.push(D);
  lines.push(`  ${project.name}   ·   Project Management Office   ·   ${isVN?'Tài liệu bảo mật — Nội bộ':'Confidential — Internal Only'}`);
  lines.push(D);
  return lines.join('\n');
}
