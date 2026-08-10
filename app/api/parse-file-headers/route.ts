import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { serverError } from '@/lib/log';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = '';
      } else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

function cellStr(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && 'richText' in (cell.value as object)) {
    return (cell.value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
  }
  if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0];
  return String(cell.value).trim();
}

function rowValues(row: ExcelJS.Row, maxCols: number): string[] {
  const cells: string[] = [];
  for (let c = 1; c <= maxCols; c++) cells.push(cellStr(row.getCell(c)));
  return cells;
}

function countNonEmpty(vals: string[]): number {
  return vals.filter(v => v.trim()).length;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let columns: string[] = [];
    let dataRows: string[][] = [];

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(Buffer.from(new Uint8Array(arrayBuffer)) as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) return NextResponse.json({ error: 'Empty workbook' }, { status: 400 });

      // Auto-detect header: find first row with at least 2 non-empty cells
      let headerRowNum = -1;
      sheet.eachRow((row, rowNum) => {
        if (headerRowNum !== -1) return;
        const vals = (row.values as (ExcelJS.CellValue | undefined)[])
          .slice(1)
          .map(v => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object' && 'richText' in (v as object))
              return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
            if (v instanceof Date) return v.toISOString().split('T')[0];
            return String(v).trim();
          });
        if (countNonEmpty(vals) >= 2) {
          headerRowNum = rowNum;
          columns = vals.map(v => v || '');
          // Remove trailing empty columns
          while (columns.length && !columns[columns.length - 1]) columns.pop();
        }
      });

      if (headerRowNum === -1 || !columns.length) {
        return NextResponse.json({ error: 'Không tìm thấy header trong file' }, { status: 400 });
      }

      // Collect data rows after the header row
      sheet.eachRow((row, rowNum) => {
        if (rowNum <= headerRowNum) return;
        if (dataRows.length >= 200) return;
        const cells = rowValues(row, columns.length);
        if (countNonEmpty(cells) > 0) dataRows.push(cells);
      });

    } else {
      // CSV / TXT — skip leading empty lines, first non-empty line = header
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      const all = parseCSV(text); // already skips blank lines
      if (!all.length) return NextResponse.json({ error: 'File trống' }, { status: 400 });

      // Find header: first row with >= 2 non-empty cells
      let headerIdx = 0;
      for (let i = 0; i < all.length; i++) {
        if (countNonEmpty(all[i]) >= 2) { headerIdx = i; break; }
      }
      columns = all[headerIdx];
      dataRows = all.slice(headerIdx + 1, headerIdx + 201).filter(r => countNonEmpty(r) > 0);
    }

    return NextResponse.json({
      columns,
      preview: dataRows.slice(0, 8),
      totalRows: dataRows.length,
      allRows: dataRows,
    });
  } catch (e) {
    return serverError(req, e, { error: 'Không thể đọc file. Kiểm tra định dạng.' });
  }
}
