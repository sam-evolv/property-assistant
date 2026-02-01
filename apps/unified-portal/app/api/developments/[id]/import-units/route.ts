export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, units } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import * as xlsx from 'xlsx';

export const runtime = 'nodejs';

interface CSVRow {
  address_line_1: string;
  house_type_code: string;
  bedrooms_raw?: string;
  property_designation?: string;
  property_type_raw?: string;
  eircode?: string;
}

interface ImportResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

function generateUnitCode(developmentCode: string, index: number): string {
  return `${developmentCode}-${String(index).padStart(3, '0')}`;
}

function generateRandomSuffix(length: number = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getDevelopmentPrefix(developmentCode: string): string {
  if (developmentCode.length <= 2) return developmentCode.toUpperCase();
  
  const words = developmentCode.split(/[-_\s]+/);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return developmentCode.substring(0, 2).toUpperCase();
}

function generateSecureUnitUid(developmentPrefix: string, unitNumber: string): string {
  const numMatch = unitNumber.match(/\d+/);
  const paddedNum = numMatch ? String(parseInt(numMatch[0], 10)).padStart(3, '0') : '001';
  const randomSuffix = generateRandomSuffix(4);
  return `${developmentPrefix}-${paddedNum}-${randomSuffix}`;
}

function parseBedroomsRaw(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function extractUnitNumber(address: string): string {
  const match = address.match(/^(\d+)/);
  if (match) return match[1];
  
  const words = address.split(/\s+/);
  return words[0] || address.substring(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['super_admin', 'admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const developmentId = params.id;

    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: {
        id: true,
        code: true,
        name: true,
        tenant_id: true,
      },
    });

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin') {
      if (!session.tenantId) {
        return NextResponse.json({ error: 'Forbidden - no tenant association' }, { status: 403 });
      }
      if (development.tenant_id !== session.tenantId) {
        return NextResponse.json({ error: 'Forbidden - development belongs to another tenant' }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file format. Please upload CSV or Excel file.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let rows: CSVRow[] = [];

    if (fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8');
      const workbook = xlsx.read(text, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json<CSVRow>(workbook.Sheets[sheetName]);
    } else {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json<CSVRow>(workbook.Sheets[sheetName]);
    }

    const result: ImportResult = {
      inserted: 0,
      skipped: 0,
      errors: [],
    };

    const existingUnits = await db.query.units.findMany({
      where: eq(units.development_id, developmentId),
      columns: { unit_uid: true, address_line_1: true },
    });

    const existingAddresses = new Set(
      existingUnits.map((u) => u.address_line_1.toLowerCase().trim())
    );
    const existingUids = new Set(existingUnits.map((u) => u.unit_uid));

    let unitIndex = existingUnits.length + 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      if (!row.address_line_1) {
        result.errors.push(`Row ${rowNum}: Missing address_line_1`);
        continue;
      }

      if (!row.house_type_code) {
        result.errors.push(`Row ${rowNum}: Missing house_type_code`);
        continue;
      }

      const normalizedAddress = row.address_line_1.toLowerCase().trim();
      if (existingAddresses.has(normalizedAddress)) {
        result.skipped++;
        continue;
      }

      const unitNumber = extractUnitNumber(row.address_line_1);
      const unitCode = generateUnitCode(development.code, unitIndex);
      const devPrefix = getDevelopmentPrefix(development.code);
      let unitUid = generateSecureUnitUid(devPrefix, unitNumber);

      while (existingUids.has(unitUid)) {
        unitUid = generateSecureUnitUid(devPrefix, unitNumber);
      }

      try {
        await db.insert(units).values({
          tenant_id: development.tenant_id,
          development_id: developmentId,
          development_code: development.code,
          unit_number: unitNumber,
          unit_code: unitCode,
          unit_uid: unitUid,
          address_line_1: row.address_line_1.trim(),
          house_type_code: row.house_type_code.trim(),
          bedrooms: parseBedroomsRaw(row.bedrooms_raw),
          eircode: row.eircode?.trim() || null,
          property_designation: row.property_designation?.trim() || null,
          property_type: row.property_type_raw?.trim() || null,
        });

        result.inserted++;
        existingAddresses.add(normalizedAddress);
        existingUids.add(unitUid);
        unitIndex++;
      } catch (err: any) {
        result.errors.push(`Row ${rowNum}: ${err.message || 'Insert failed'}`);
      }
    }

    return NextResponse.json({
      success: true,
      development: { id: development.id, name: development.name },
      totalRows: rows.length,
      ...result,
    });
  } catch (error: any) {
    console.error('[Import Units] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
