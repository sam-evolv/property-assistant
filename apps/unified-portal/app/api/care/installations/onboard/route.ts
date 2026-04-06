export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function generateAccessCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      address_line_1,
      city,
      county,
      system_type,
      system_size_kwp,
      inverter_model,
      panel_model,
      panel_count,
      install_date,
      job_reference,
      telemetry_source,
      serial_number,
      telemetry_api_key,
    } = body;

    if (!customer_name || !address_line_1 || !city || !job_reference) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_name, address_line_1, city, job_reference' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const access_code = generateAccessCode();

    const { data: installation, error } = await supabase
      .from('installations')
      .insert({
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        address_line_1,
        city,
        county: county || null,
        system_type: system_type || 'solar_pv',
        system_size_kwp: system_size_kwp || null,
        inverter_model: inverter_model || null,
        panel_model: panel_model || null,
        panel_count: panel_count || null,
        install_date: install_date || null,
        job_reference,
        telemetry_source: telemetry_source || null,
        serial_number: serial_number || null,
        telemetry_api_key: telemetry_api_key || null,
        access_code,
        health_status: 'healthy',
        portal_status: 'active',
        is_active: true,
        system_specs: {},
      })
      .select('id, access_code, customer_name')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A installation with this job reference already exists' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ installation });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create installation' },
      { status: 500 }
    );
  }
}
