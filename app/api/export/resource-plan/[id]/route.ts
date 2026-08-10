import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { getProject } from '@/lib/repositories/projects.repo';
import { listForExport } from '@/lib/repositories/team.repo';
import { assertProjectAccess } from '@/lib/services/access';

type Params = { params: Promise<{ id: string }> };

const NAVY     = 'FF1E293B';
const WHITE    = 'FFFFFFFF';
const PHASE_BG = 'FFD6E4F0';
const PHASE_FN = 'FF1A3A5C';
const TOTAL_BG = 'FFE2E8F0';
const SEP      = 'FFE2E8F0';
const SEP2     = 'FF94A3B8';

const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: WHITE }, bold: true, size: 10, name: 'Calibri' };
const BODY_FONT:   Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };
const BOLD_FONT:   Partial<ExcelJS.Font> = { size: 9, bold: true, name: 'Calibri' };

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function border(color = SEP): Partial<ExcelJS.Borders> {
  return { bottom: { style: 'thin', color: { argb: color } }, right: { style: 'thin', color: { argb: color } } };
}

function getMonths(start: string, end: string): string[] {
  if (!start || !end) {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }
  const months: string[] = [];
  const d = new Date(start.slice(0, 7) + '-01');
  const e = new Date(end.slice(0, 7) + '-01');
  while (d <= e) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function displayMonth(ym: string) {
  const [y, m] = ym.split('-');
  const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${labels[Number(m) - 1]}\n${y}`;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await assertProjectAccess(id, {
      company_id: user.company_id,
      is_admin: user.is_admin,
    });
  } catch (e) {
    return serviceErrorResponse(e);
  }

  const project = await getProject(Number(id)) as Record<string, string> | undefined;
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const members = await listForExport(Number(id));

  const months = getMonths(project.start_date, project.end_date);
  const totalCols = 4 + months.length + 1; // Domain, Role, Name, Email, months..., Notes

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  wb.created = new Date();

  // ── Sheet 1: Resource Plan ─────────────────────────────────────────────────
  const ws = wb.addWorksheet('Resource Plan', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // Title
  const titleRow = ws.addRow([`RESOURCE PLAN — ${project.name}`]);
  ws.mergeCells(1, 1, 1, totalCols);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  titleRow.height = 28;

  const subRow = ws.addRow([`Client: ${project.client ?? '—'}   |   PM: ${project.pm_name ?? '—'}   |   Period: ${project.start_date ?? ''} → ${project.end_date ?? ''}`]);
  ws.mergeCells(2, 1, 2, totalCols);
  subRow.getCell(1).font = { size: 9, color: { argb: 'FF64748B' }, name: 'Calibri' };
  subRow.height = 16;

  ws.addRow([]); // blank

  // Header row
  const hdrRow = ws.addRow(['Domain', 'Role', 'Name', 'Email', ...months.map(displayMonth), 'Notes']);
  hdrRow.eachCell(cell => {
    cell.fill = solidFill(NAVY);
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: SEP } }, right: { style: 'thin', color: { argb: SEP } } };
  });
  hdrRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  hdrRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
  hdrRow.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
  hdrRow.getCell(totalCols).alignment = { horizontal: 'left', vertical: 'middle' };
  hdrRow.height = 32;

  // Column widths
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 24;
  ws.getColumn(4).width = 28;
  months.forEach((_, i) => { ws.getColumn(5 + i).width = 10; });
  ws.getColumn(totalCols).width = 32;

  // Domains
  const domains = [...new Set(members.map(m => m.domain))];
  for (const domain of domains) {
    // Domain group header
    const dr = ws.addRow([domain, ...Array(totalCols - 1).fill('')]);
    ws.mergeCells(dr.number, 1, dr.number, totalCols);
    dr.getCell(1).fill = solidFill(PHASE_BG);
    dr.getCell(1).font = { bold: true, size: 10, color: { argb: PHASE_FN }, name: 'Calibri' };
    dr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    dr.getCell(1).border = { top: { style: 'thin', color: { argb: SEP2 } }, bottom: { style: 'thin', color: { argb: SEP2 } } };
    dr.height = 18;

    const domainMembers = members.filter(m => m.domain === domain);
    const totalCap: Record<string, number> = {};

    domainMembers.forEach((m, i) => {
      const cap = JSON.parse(m.capacity_json || '{}') as Record<string, number>;
      months.forEach(mo => { totalCap[mo] = (totalCap[mo] ?? 0) + (cap[mo] ?? 0); });

      const row = ws.addRow(['', m.role, m.name, m.email ?? '', ...months.map(mo => cap[mo] ?? ''), m.notes]);
      row.eachCell((cell, colNum) => {
        cell.font = BODY_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = border();
        if (colNum === 2 || colNum === 3 || colNum === 4) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        if (colNum === totalCols) cell.alignment = { horizontal: 'left', vertical: 'middle' };
        // Highlight capacity >= 1
        if (colNum >= 5 && colNum < totalCols) {
          const val = typeof cell.value === 'number' ? cell.value : 0;
          if (val >= 1) {
            cell.font = { ...BODY_FONT, color: { argb: 'FFDC2626' }, bold: true };
            cell.fill = solidFill('FFFEE2E2');
          } else if (val >= 0.7) {
            cell.font = { ...BODY_FONT, color: { argb: 'FFD97706' }, bold: true };
            cell.fill = solidFill('FFFEF3C7');
          }
        }
      });
      if (i % 2 === 1) {
        row.eachCell((cell, colNum) => {
          if (colNum >= 5 && colNum < totalCols && !cell.fill) {
            cell.fill = solidFill('FFF8FAFC');
          }
        });
      }
      row.height = 18;
    });

    // Total row
    const totRow = ws.addRow(['', 'Total (MM)', '', '', ...months.map(mo => totalCap[mo] > 0 ? +totalCap[mo].toFixed(1) : ''), '']);
    totRow.eachCell((cell, colNum) => {
      cell.fill = solidFill(TOTAL_BG);
      cell.font = BOLD_FONT;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: SEP2 } }, right: { style: 'thin', color: { argb: SEP } } };
      if (colNum === 2) cell.alignment = { horizontal: 'left' };
      // Highlight overallocation
      if (colNum >= 5 && colNum < totalCols) {
        const val = typeof cell.value === 'number' ? cell.value : 0;
        if (val > 1) {
          cell.font = { ...BOLD_FONT, color: { argb: 'FFDC2626' } };
          cell.fill = solidFill('FFFEE2E2');
        }
      }
    });
    totRow.height = 18;
  }

  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 4, topLeftCell: 'E5' }];

  // ── Sheet 2: Org Structure ─────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Org Structure');

  const orgTitle = ws2.addRow([`ORG STRUCTURE — ${project.name}`]);
  ws2.mergeCells(1, 1, 1, 5);
  orgTitle.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  orgTitle.height = 28;

  ws2.addRow([]); // blank

  const orgHdr = ws2.addRow(['Domain', 'Role', 'Name', 'Email', 'Notes']);
  orgHdr.eachCell(cell => {
    cell.fill = solidFill(NAVY);
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = border();
  });
  orgHdr.height = 24;

  ws2.getColumn(1).width = 18;
  ws2.getColumn(2).width = 24;
  ws2.getColumn(3).width = 28;
  ws2.getColumn(4).width = 28;
  ws2.getColumn(5).width = 36;

  for (const domain of domains) {
    const dr = ws2.addRow([domain, '', '', '', '']);
    ws2.mergeCells(dr.number, 1, dr.number, 5);
    dr.getCell(1).fill = solidFill(PHASE_BG);
    dr.getCell(1).font = { bold: true, size: 10, color: { argb: PHASE_FN }, name: 'Calibri' };
    dr.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    dr.height = 18;

    for (const m of members.filter(x => x.domain === domain)) {
      const row = ws2.addRow(['', m.role, m.name, m.email ?? '', m.notes]);
      row.eachCell(cell => {
        cell.font = BODY_FONT;
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = border();
      });
      row.height = 18;
    }
  }

  // ── Stream response ────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const safeName = (project.name as string).replace(/\s+/g, '_');
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ResourcePlan_${safeName}.xlsx"`,
    },
  });
}
