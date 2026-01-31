import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developments, units, unitSalesPipeline, tenants } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

interface ColumnMappings {
  [spreadsheetColumn: string]: string;
}

interface ImportOptions {
  extractHandover: boolean;
  autoDrawdown: boolean;
  autoSnag: boolean;
}

function parseDate(value: any): Date | null {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    const excelDate = new Date((value - 25569) * 86400 * 1000);
    return isNaN(excelDate.getTime()) ? null : excelDate;
  }

  if (typeof value === 'string') {
    const datePatterns = [
      /(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/,
      /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
      /(\d{4})-(\d{2})-(\d{2})/,
    ];

    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    for (const pattern of datePatterns) {
      const match = value.match(pattern);
      if (match) {
        if (pattern === datePatterns[0]) {
          const day = parseInt(match[1]);
          const month = monthMap[match[2].toLowerCase()];
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          return new Date(year, month, day);
        } else if (pattern === datePatterns[1]) {
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1;
          let year = parseInt(match[3]);
          if (year < 100) year += 2000;
          return new Date(year, month, day);
        } else {
          return new Date(value);
        }
      }
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatDateForDisplay(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: '2-digit' });
}

function mapStatus(status: string): 'for_sale' | 'reserved' | 'agreed' | 'signed' | 'sold' {
  const lower = status?.toLowerCase() || '';
  if (lower.includes('sale') || lower.includes('available')) return 'for_sale';
  if (lower.includes('reserved')) return 'reserved';
  if (lower.includes('agreed')) return 'agreed';
  if (lower.includes('signed') || lower.includes('contract')) return 'signed';
  if (lower.includes('sold') || lower.includes('complete') || lower.includes('closed')) return 'sold';
  return 'for_sale';
}

function extractUnitNumber(address: string): string {
  const match = address.match(/^(\d+)/);
  return match ? match[1] : address.substring(0, 10);
}

function parsePrice(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[€$,\s]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function extractBedroomsFromCode(code: string): number {
  const match = code?.match(/(\d)/);
  return match ? parseInt(match[1]) : 3;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin']);

    const developmentId = params.id;
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const action = formData.get('action') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    if (action === 'parse') {
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        return {
          name,
          rowCount: Math.max(0, data.length - 1),
        };
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const firstSheetData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
      const columns = firstSheetData[0]?.map((c: any) => String(c || '').trim()).filter(Boolean) || [];

      return NextResponse.json({ sheets, columns });
    }

    if (action === 'getColumns') {
      const sheetName = formData.get('sheet') as string;
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return NextResponse.json({ error: 'Sheet not found' }, { status: 400 });
      }

      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const columns = data[0]?.map((c: any) => String(c || '').trim()).filter(Boolean) || [];

      return NextResponse.json({ columns });
    }

    if (action === 'preview' || action === 'import') {
      const sheetName = formData.get('sheet') as string;
      const mappingsStr = formData.get('mappings') as string;
      const optionsStr = formData.get('options') as string;

      const mappings: ColumnMappings = JSON.parse(mappingsStr || '{}');
      const options: ImportOptions = JSON.parse(optionsStr || '{}');

      const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

      const reverseMapping: Record<string, string> = {};
      for (const [col, field] of Object.entries(mappings)) {
        if (field) reverseMapping[field] = col;
      }

      const rows = data.map((row) => {
        const getValue = (field: string) => {
          const col = reverseMapping[field];
          return col ? row[col] : null;
        };

        const address = String(getValue('unit_address') || '').trim();
        const status = String(getValue('status') || 'For Sale').trim();
        const price = getValue('sale_price');
        const purchaser = String(getValue('purchaser_name') || '').trim();
        const bedrooms = getValue('bedrooms');
        const houseTypeCode = String(getValue('house_type_code') || '').trim();
        const comments = String(getValue('comments') || '').trim();

        const releaseDate = parseDate(getValue('release_date'));
        const depositDate = parseDate(getValue('deposit_date'));
        const saleAgreedDate = parseDate(getValue('sale_agreed_date'));
        const contractsIssuedDate = parseDate(getValue('contracts_issued_date'));
        const queriesRaisedDate = parseDate(getValue('queries_raised_date'));
        const queriesRepliedDate = parseDate(getValue('queries_replied_date'));
        const signedContractsDate = parseDate(getValue('signed_contracts_date'));
        const counterSignedDate = parseDate(getValue('counter_signed_date'));
        const estimatedCloseDate = parseDate(getValue('estimated_close_date'));
        let snagDate = parseDate(getValue('snag_date'));
        let handoverDate = parseDate(getValue('handover_date'));
        let drawdownDate = parseDate(getValue('drawdown_date'));

        if (options.extractHandover && comments.toLowerCase().includes('complete')) {
          const dateMatch = comments.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
          if (dateMatch && !handoverDate) {
            handoverDate = parseDate(dateMatch[0]);
          }
        }

        if (options.autoDrawdown && handoverDate && !drawdownDate) {
          drawdownDate = new Date(handoverDate);
          drawdownDate.setDate(drawdownDate.getDate() - 14);
        }

        if (options.autoSnag && drawdownDate && !snagDate) {
          snagDate = new Date(drawdownDate);
        }

        return {
          address,
          status,
          price: price ? `€${parsePrice(price)?.toLocaleString()}` : '',
          purchaser,
          release_date: formatDateForDisplay(releaseDate),
          deposit_date: formatDateForDisplay(depositDate),
          sale_agreed_date: formatDateForDisplay(saleAgreedDate),
          contracts_issued_date: formatDateForDisplay(contractsIssuedDate),
          queries_raised_date: formatDateForDisplay(queriesRaisedDate),
          queries_replied_date: formatDateForDisplay(queriesRepliedDate),
          signed_contracts_date: formatDateForDisplay(signedContractsDate),
          counter_signed_date: formatDateForDisplay(counterSignedDate),
          snag_date: formatDateForDisplay(snagDate),
          drawdown_date: formatDateForDisplay(drawdownDate),
          handover_date: formatDateForDisplay(handoverDate),
          estimated_close_date: formatDateForDisplay(estimatedCloseDate),
          bedrooms: bedrooms ? String(bedrooms) : '',
          house_type_code: houseTypeCode,
          comments,
          _raw: {
            releaseDate,
            depositDate,
            saleAgreedDate,
            contractsIssuedDate,
            queriesRaisedDate,
            queriesRepliedDate,
            signedContractsDate,
            counterSignedDate,
            snagDate,
            drawdownDate,
            handoverDate,
            estimatedCloseDate,
            priceNum: parsePrice(price),
            statusMapped: mapStatus(status),
            bedroomsNum: bedrooms ? parseInt(String(bedrooms)) : extractBedroomsFromCode(houseTypeCode),
          },
        };
      }).filter((row) => row.address);

      if (action === 'preview') {
        return NextResponse.json({ rows: rows.map(({ _raw, ...rest }) => rest) });
      }

      const [development] = await db
        .select({
          id: developments.id,
          tenant_id: developments.tenant_id,
          name: developments.name,
        })
        .from(developments)
        .where(eq(developments.id, developmentId))
        .limit(1);

      if (!development) {
        return NextResponse.json({ error: 'Development not found' }, { status: 404 });
      }

      let unitsCreated = 0;
      let pipelineCreated = 0;
      const summary: Record<string, number> = {
        for_sale: 0,
        agreed: 0,
        signed: 0,
        sold: 0,
      };

      for (const row of rows) {
        try {
          const unitNumber = extractUnitNumber(row.address);

          const [newUnit] = await db
            .insert(units)
            .values({
              development_id: developmentId,
              tenant_id: development.tenant_id,
              unit_number: unitNumber,
              address_line_1: row.address,
              house_type_code: row.house_type_code || 'UNKNOWN',
              bedrooms: row._raw.bedroomsNum || 3,
            })
            .returning({ id: units.id });

          unitsCreated++;

          await db.insert(unitSalesPipeline).values({
            unit_id: newUnit.id,
            development_id: developmentId,
            tenant_id: development.tenant_id,
            purchaser_name: row.purchaser || null,
            release_date: row._raw.releaseDate,
            deposit_date: row._raw.depositDate,
            sale_agreed_date: row._raw.saleAgreedDate,
            contracts_issued_date: row._raw.contractsIssuedDate,
            signed_contracts_date: row._raw.signedContractsDate,
            counter_signed_date: row._raw.counterSignedDate,
            snag_date: row._raw.snagDate,
            drawdown_date: row._raw.drawdownDate,
            handover_date: row._raw.handoverDate,
          });

          pipelineCreated++;
          summary[row._raw.statusMapped] = (summary[row._raw.statusMapped] || 0) + 1;
        } catch (e) {
          console.error('Error importing row:', row.address, e);
        }
      }

      return NextResponse.json({
        success: true,
        unitsCreated,
        pipelineCreated,
        summary,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Pipeline Import API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
