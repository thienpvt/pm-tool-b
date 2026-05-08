import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

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
      await workbook.xlsx.load(Buffer.from(new Uint8Array(arrayBuffer)));
      const sheet = workbook.worksheets[0];
      if (!sheet) return NextResponse.json({ error: 'Empty workbook' }, { status: 400 });

      // Find first non-empty row as header
      let headerRowNum = 1;
      sheet.eachRow((row, rowNum) => {
        if (rowNum <= headerRowNum) {
          const vals = (row.values as (ExcelJS.CellValue | undefined)[]).slice(1).map(v => {
            if (v === null || v === undefined) return '';
            if (typeof v === 'object' && 'richText' in (v as object)) {
              return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
            }
            return String(v).trim();
          });
          if (vals.some(v => v)) columns = vals.map(v => v || '');
        }
      });

      // Remove trailing empty columns
      while (columns.length && !columns[columns.length - 1]) columns.pop();

      // Collect up to 100 data rows
      let currentRow = 0;
      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        if (currentRow >= 100) return;
        currentRow++;
        const cells: string[] = [];
        for (let c = 1; c <= columns.length; c++) {
          cells.push(cellStr(row.getCell(c)));
        }
        dataRows.push(cells);
      });
    } else {
      // CSV / TXT
      const text = new TextDecoder('utf-8').decode(arrayBuffer);
      const all = parseCSV(text);
      if (!all.length) return NextResponse.json({ error: 'Empty file' }, { status: 400 });
      columns = all[0];
      dataRows = all.slice(1, 101);
    }

    // Filter out completely empty rows
    dataRows = dataRows.filter(r => r.some(c => c.trim()));

    return NextResponse.json({ columns, preview: dataRows.slice(0, 6), totalRows: dataRows.length, allRows: dataRows });
  } catch (e) {
    console.error('parse-file-headers error:', e);
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 });
  }
}
