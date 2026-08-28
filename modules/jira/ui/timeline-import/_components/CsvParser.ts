import type { FileData } from '../types';

export function parseCSVText(text: string): FileData {
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
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  if (rows.length < 1) return { columns: [], allRows: [], preview: [] };
  const columns = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c));
  return { columns, allRows: dataRows, preview: dataRows.slice(0, 10) };
}
