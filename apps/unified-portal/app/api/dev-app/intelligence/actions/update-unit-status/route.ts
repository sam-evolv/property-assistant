import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface UnitUpdate {
  unit_id: string;
  new_status: string;
}

interface RequestBody {
  scheme_id: string;
  units: UnitUpdate[];
  natural_language_instruction?: string;
  action: 'confirm' | 'cancel';
}

const VALID_STATUSES = ['Available', 'Reserved', 'Sold', 'Withdrawn'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const { scheme_id, units, natural_language_instruction, action } = body;

    if (!scheme_id || !units || !Array.isArray(units) || units.length === 0) {
      return NextResponse.json(
        { error: 'scheme_id and units array are required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Verify the user has access to this development (scheme)
    const { data: development } = await admin
      .from('developments')
      .select('id, name')
      .eq('id', scheme_id)
      .eq('developer_user_id', user.id)
      .single();

    if (!development) {
      return NextResponse.json(
        { error: 'You do not have access to this development' },
        { status: 403 }
      );
    }

    // Handle cancellation
    if (action === 'cancel') {
      await admin.from('intelligence_audit_log').insert({
        user_id: user.id,
        scheme_id,
        tool_name: 'update_unit_status',
        natural_language_instruction: natural_language_instruction || null,
        parameters: { units },
        result: { cancelled: true },
        status: 'cancelled',
      });

      return NextResponse.json({
        success: true,
        cancelled: true,
        message: 'Action cancelled',
      });
    }

    // Validate all statuses before executing any writes
    for (const unit of units) {
      if (!VALID_STATUSES.includes(unit.new_status)) {
        return NextResponse.json(
          {
            error: `Invalid status "${unit.new_status}". Valid statuses: ${VALID_STATUSES.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    // Verify all unit IDs belong to this development
    const unitIds = units.map((u) => u.unit_id);
    const { data: validUnits } = await admin
      .from('units')
      .select('id')
      .in('id', unitIds)
      .eq('development_id', scheme_id);

    const validUnitIds = new Set((validUnits || []).map((u: { id: string }) => u.id));
    const invalidIds = unitIds.filter((id) => !validUnitIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          error: `Units not found in this development: ${invalidIds.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Execute updates
    const errors: string[] = [];
    let updated = 0;

    for (const unit of units) {
      const { error } = await admin
        .from('units')
        .update({
          unit_status: unit.new_status.toLowerCase(),
        })
        .eq('id', unit.unit_id)
        .eq('development_id', scheme_id);

      if (error) {
        errors.push(`Failed to update unit ${unit.unit_id}: ${error.message}`);
      } else {
        updated++;
      }
    }

    // Write to audit log
    const auditStatus = errors.length === 0 ? 'confirmed' : 'failed';
    await admin.from('intelligence_audit_log').insert({
      user_id: user.id,
      scheme_id,
      tool_name: 'update_unit_status',
      natural_language_instruction: natural_language_instruction || null,
      parameters: { units },
      result: { updated, errors },
      status: auditStatus,
    });

    return NextResponse.json({
      success: errors.length === 0,
      updated,
      errors,
    });
  } catch (error) {
    console.error('[Intelligence] update-unit-status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
