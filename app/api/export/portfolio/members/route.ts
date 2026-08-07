import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getSessionFromRequest } from '@/lib/auth';
import { companyNameAndQuota, listPortfolioMembers } from '@/lib/repositories/portfolio.repo';

const NAVY     = 'FF1E293B';
const WHITE    = 'FFFFFFFF';
const BLUE_BG  = 'FFD6E4F0';
const BLUE_FN  = 'FF1A3A5C';
const AMBER_BG = 'FFFEF3C7';
const AMBER_FN = 'FFB45309';
const QUOTA_BG = 'FFF0FDF4';
const QUOTA_FN = 'FF166534';
const SEP      = 'FFE2E8F0';

const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: WHITE }, bold: true, size: 10, name: 'Calibri' };
const BODY_FONT:   Partial<ExcelJS.Font> = { size: 9, name: 'Calibri' };
const BOLD_FONT:   Partial<ExcelJS.Font> = { size: 9, bold: true, name: 'Calibri' };

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

type Member = { id: number; role: string; name: string; email: string; note: string; member_type: string };

function buildSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  members: Member[],
  quota: number,
  bgColor: string,
  fnColor: string,
  companyName: string,
) {
  const ws = wb.addWorksheet(sheetName);

  // Title
  const titleRow = ws.addRow([`${sheetName.toUpperCase()} — ${companyName}`]);
  ws.mergeCells(1, 1, 1, 5);
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E293B' }, name: 'Calibri' };
  titleRow.height = 28;

  // Quota summary row
  const used = members.length;
  const remaining = quota - used;
  const summaryRow = ws.addRow([
    `Tổng định biên: ${quota}`,
    `Đã phân bổ: ${used}`,
    `Còn lại: ${remaining}`,
    '',
    '',
  ]);
  summaryRow.eachCell((cell, col) => {
    if (col <= 3) {
      cell.font = { ...BOLD_FONT, color: { argb: col === 3 && remaining < 0 ? 'FFDC2626' : QUOTA_FN } };
      cell.fill = solidFill(col === 3 && remaining < 0 ? 'FFFEE2E2' : QUOTA_BG);
    }
    cell.border = { bottom: { style: 'thin', color: { argb: SEP } } };
  });
  summaryRow.height = 18;

  ws.addRow([]); // blank

  // Header
  const hdrRow = ws.addRow(['#', 'Role', 'Name', 'Email', 'Note']);
  hdrRow.eachCell(cell => {
    cell.fill = solidFill(NAVY);
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: SEP } }, right: { style: 'thin', color: { argb: SEP } } };
  });
  hdrRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  hdrRow.height = 24;

  // Column widths
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 28;
  ws.getColumn(4).width = 32;
  ws.getColumn(5).width = 36;

  members.forEach((m, i) => {
    const row = ws.addRow([i + 1, m.role, m.name, m.email, m.note]);
    row.eachCell(cell => {
      cell.font = BODY_FONT;
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: { style: 'thin', color: { argb: SEP } }, right: { style: 'thin', color: { argb: SEP } } };
    });
    if (i % 2 === 1) {
      row.eachCell(cell => { cell.fill = solidFill('FFF8FAFC'); });
    }
    row.height = 18;
  });

  // Group header style for sheet tab visual hint
  ws.getRow(4).eachCell(cell => {
    if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb === 'FF000000') return;
  });

  // Mark the section header
  const secRow = ws.getRow(1);
  secRow.getCell(1).fill = solidFill(bgColor);
  secRow.getCell(1).font = { bold: true, size: 14, color: { argb: fnColor }, name: 'Calibri' };
}

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const members = await listPortfolioMembers(user.company_id) as Member[];
  const company = await companyNameAndQuota(user.company_id);

  const internal = members.filter(m => m.member_type !== 'external');
  const external = members.filter(m => m.member_type === 'external');
  const quota = company?.headcount_quota ?? 0;
  const companyName = company?.name ?? '';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PM Tool';
  wb.created = new Date();

  buildSheet(wb, 'Nhân sự trong khối', internal, quota, BLUE_BG, BLUE_FN, companyName);
  buildSheet(wb, 'Nhân sự ngoài khối', external, 0, AMBER_BG, AMBER_FN, companyName);

  const buffer = await wb.xlsx.writeBuffer();
  const safeName = companyName.replace(/\s+/g, '_') || 'Portfolio';
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="ResourceManagement_${safeName}.xlsx"`,
    },
  });
}
