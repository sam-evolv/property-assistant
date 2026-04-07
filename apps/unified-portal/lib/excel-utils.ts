/**
 * ExcelJS helpers that replicate the xlsx (SheetJS) API surface used
 * across the codebase: read a buffer/string, convert a worksheet to
 * an array of JSON objects (sheet_to_json behaviour).
 */
import ExcelJS from 'exceljs';

export interface ParsedWorkbook {
  SheetNames: string[];
  Sheets: Record<string, ExcelJS.Worksheet>;
}

/**
 * Read an Excel file from a Buffer or ArrayBuffer.
 * For CSV strings, use `readCsv` instead.
 */
export async function readExcel(
  data: Buffer | ArrayBuffer,
): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const buf = data instanceof ArrayBuffer ? Buffer.from(data) : data;
  await workbook.xlsx.load(buf);

  const SheetNames = workbook.worksheets.map((ws) => ws.name);
  const Sheets: Record<string, ExcelJS.Worksheet> = {};
  for (const ws of workbook.worksheets) {
    Sheets[ws.name] = ws;
  }
  return { SheetNames, Sheets };
}

/**
 * Read a CSV string into a workbook-like structure.
 */
export async function readCsv(text: string): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(require('stream').Readable.from(text));
  const ws = workbook.worksheets[0];
  const name = ws?.name || 'Sheet1';
  return {
    SheetNames: [name],
    Sheets: { [name]: ws },
  };
}

/**
 * Convert a worksheet to an array of JSON objects keyed by header row values.
 * Mimics `xlsx.utils.sheet_to_json(sheet, { defval: '' })`.
 *
 * When `options.header` is `1`, returns an array of arrays instead
 * (mimics `xlsx.utils.sheet_to_json(sheet, { header: 1 })`).
 */
export function sheetToJson<T = Record<string, any>>(
  sheet: ExcelJS.Worksheet,
  options?: { defval?: any; header?: 1 },
): T[] {
  if (!sheet || sheet.rowCount === 0) return [];

  if (options?.header === 1) {
    // Return array-of-arrays (raw rows)
    const rows: any[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      rows.push(
        row.values
          ? (row.values as any[]).slice(1) // ExcelJS row.values is 1-indexed
          : [],
      );
    });
    return rows as unknown as T[];
  }

  // Default: keyed by header values
  const rows: any[] = [];
  const headers: string[] = [];
  const defval = options?.defval ?? undefined;

  sheet.eachRow((row, rowNumber) => {
    const vals = (row.values as any[])?.slice(1) || [];

    if (rowNumber === 1) {
      // Header row
      for (const v of vals) {
        headers.push(v != null ? String(v).trim() : '');
      }
      return;
    }

    const obj: Record<string, any> = {};
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      let val = i < vals.length ? vals[i] : defval;
      if (val === null || val === undefined) val = defval;
      // ExcelJS wraps rich text and hyperlinks in objects; unwrap them
      if (val && typeof val === 'object') {
        if ('result' in val) val = val.result; // formula
        else if ('text' in val) val = val.text; // hyperlink
        else if ('richText' in val)
          val = (val.richText as any[]).map((r: any) => r.text).join('');
      }
      obj[key] = val;
    }
    // Skip completely empty rows
    const hasValue = Object.values(obj).some(
      (v) => v !== defval && v !== undefined && v !== null && v !== '',
    );
    if (hasValue || defval !== undefined) {
      rows.push(obj);
    }
  });

  return rows as T[];
}
