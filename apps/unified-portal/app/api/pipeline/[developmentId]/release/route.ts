/**
 * Sales Pipeline API - Release Units
 *
 * POST /api/pipeline/[developmentId]/release
 * Create new units for a development with release date set to today
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(
    url,
    key
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ReleaseUnitRow {
  unitNumber: string;
  address: string;
  houseType: string;
  beds: number;
  price: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { developmentId: string } }
) {
  try {
    const auth = await requireRole(['developer', 'admin', 'super_admin']);

    const { developmentId } = params;
    const body = await request.json();
    const units: ReleaseUnitRow[] = body.units || [];

    if (!units.length) {
      return NextResponse.json({ error: 'No units provided' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get development info
    const { data: development, error: devError } = await supabase
      .from('developments')
      .select('id, development_code, name, tenant_id')
      .eq('id', developmentId)
      .single();

    if (devError || !development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const today = new Date().toISOString().split('T')[0];
    const createdUnits: any[] = [];
    const errors: string[] = [];

    for (const unit of units) {
      try {
        // Check if unit already exists
        const { data: existing } = await supabase
          .from('units')
          .select('id')
          .eq('development_id', developmentId)
          .eq('unit_number', unit.unitNumber)
          .single();

        if (existing) {
          errors.push(`Unit ${unit.unitNumber} already exists`);
          continue;
        }

        // Generate access code: XX-NNN-XXXX format
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const randomLetters = () => letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
        const randomNumbers = () => String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        const randomFour = () => letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)] + 
                                  letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
        const accessCode = `${randomLetters()}-${randomNumbers()}-${randomFour()}`;

        // Create the unit
        const { data: newUnit, error: unitError } = await supabase
          .from('units')
          .insert({
            development_id: developmentId,
            development_code: development.development_code,
            tenant_id: development.tenant_id,
            unit_number: unit.unitNumber,
            address: unit.address,
            house_type_code: unit.houseType,
            bedrooms: unit.beds,
            price: unit.price,
            unit_uid: accessCode,
          })
          .select('id')
          .single();

        if (unitError) {
          errors.push(`Failed to create unit ${unit.unitNumber}: ${unitError.message}`);
          continue;
        }

        // Create pipeline record with release date
        const { error: pipelineError } = await supabase
          .from('unit_sales_pipeline')
          .insert({
            unit_id: newUnit.id,
            development_id: developmentId,
            release_date: today,
            release_updated_by: auth.id,
            release_updated_at: new Date().toISOString(),
          });

        if (pipelineError) {
          errors.push(`Failed to create pipeline for unit ${unit.unitNumber}: ${pipelineError.message}`);
          continue;
        }

        createdUnits.push({
          id: newUnit.id,
          unitNumber: unit.unitNumber,
          address: unit.address,
        });
      } catch (err: any) {
        errors.push(`Error processing unit ${unit.unitNumber}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      count: createdUnits.length,
      units: createdUnits,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error releasing units:', error);
    return NextResponse.json({ error: error.message || 'Failed to release units' }, { status: 500 });
  }
}
