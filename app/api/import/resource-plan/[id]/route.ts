import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { withProjectAccess } from '@/lib/http/with-project-access';

export type ParsedMember = {
  domain: string;
  role: string;
  name: string;
  email: string;
  capacity_json: string; // JSON string like { "2025-01": 1, "2025-06": 0.5 }
  notes: string;
};

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseMonthHeader(text: string): string | null {
  // Handles: "Jan\n2025", "Jan 2025", "Jan-2025", "2025-01"
  if (!text) return null;
  const s = String(text).trim().replace(/\r/g, '');

  // ISO format already: 2025-01
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  // "Jan\n2025" or "Jan 2025" etc.
  const parts = s.split(/[\n\s\-\/]+/).map(p => p.toLowerCase().trim());
  let month = '', year = '';
  for (const p of parts) {
    if (MONTH_ABBR[p.slice(0, 3)]) month = MONTH_ABBR[p.slice(0, 3)];
    if (/^20\d{2}$/.test(p)) year = p;
  }
  if (month && year) return `${year}-${month}`;
  return null;
}

function cellStr(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && 'richText' in (cell.value as object)) {
    return (cell.value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
  }
  return String(cell.value).trim();
}

function cellNum(cell: ExcelJS.Cell): number | null {
  const v = cell.value;
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

export const POST = withProjectAccess(async (req) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);

  // Try to find the "Resource Plan" sheet first, fall back to first sheet
  const ws = wb.getWorksheet('Resource Plan') ?? wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: 'No worksheet found' }, { status: 400 });

  // ── Find header row ────────────────────────────────────────────────────────
  // The header row contains "Role", "Name", and month columns
  let headerRowNum = -1;
  const monthColMap: Record<number, string> = {}; // colIndex → "YYYY-MM"
  let notesCol = -1;
  let roleCol = -1;
  let nameCol = -1;
  let emailCol = -1;

  ws.eachRow((row, rowNum) => {
    if (headerRowNum !== -1) return;
    let hasRole = false; let hasName = false; let hasMonths = false;
    row.eachCell({ includeEmpty: false }, (cell, colNum) => {
      const v = cellStr(cell).toLowerCase();
      if (v === 'role') { roleCol = colNum; hasRole = true; }
      if (v === 'name') { nameCol = colNum; hasName = true; }
      if (v === 'email') emailCol = colNum;
      if (v === 'notes') notesCol = colNum;
      const mo = parseMonthHeader(cellStr(cell));
      if (mo) { monthColMap[colNum] = mo; hasMonths = true; }
    });
    if (hasRole && hasName && hasMonths) headerRowNum = rowNum;
  });

  if (headerRowNum === -1) {
    return NextResponse.json({ error: 'Could not find a valid header row (needs Role, Name, and month columns)' }, { status: 422 });
  }

  // ── Parse data rows ────────────────────────────────────────────────────────
  const members: ParsedMember[] = [];
  let currentDomain = 'Other';

  ws.eachRow((row, rowNum) => {
    if (rowNum <= headerRowNum) return;

    const colAVal = cellStr(row.getCell(1));
    const roleVal = roleCol > 0 ? cellStr(row.getCell(roleCol)) : '';
    const nameVal = nameCol > 0 ? cellStr(row.getCell(nameCol)) : '';

    // Domain group header: cell A is non-empty, role is empty or "Total (MM)"
    if (colAVal && colAVal !== '' && roleVal !== 'Total (MM)' && !colAVal.toLowerCase().includes('total')) {
      currentDomain = colAVal;
      return;
    }

    // Skip total rows and blank rows
    if (roleVal === 'Total (MM)' || (!roleVal && !nameVal)) return;

    // Member row: has a name
    if (!nameVal) return;

    // Parse capacity
    const cap: Record<string, number> = {};
    for (const [colNumStr, monthKey] of Object.entries(monthColMap)) {
      const n = cellNum(row.getCell(Number(colNumStr)));
      if (n !== null && n > 0) cap[monthKey] = n;
    }

    const notes = notesCol > 0 ? cellStr(row.getCell(notesCol)) : '';
    const email = emailCol > 0 ? cellStr(row.getCell(emailCol)) : '';

    members.push({
      domain: currentDomain,
      role: roleVal,
      name: nameVal,
      email,
      capacity_json: JSON.stringify(cap),
      notes,
    });
  });

  if (members.length === 0) {
    return NextResponse.json({ error: 'No member rows found in the file' }, { status: 422 });
  }

  return NextResponse.json({ members, monthColumns: Object.values(monthColMap).sort() });
}, { rawBody: true });
