import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { purchaserAgreements } from '@openhouse/db/schema';
import { desc, eq } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export async function GET(request: NextRequest) {
  try {
    // Fetch all agreements
    const agreements = await db
      .select()
      .from(purchaserAgreements)
      .where(eq(purchaserAgreements.development_id, PROJECT_ID))
      .orderBy(desc(purchaserAgreements.agreed_at));

    // Enrich with unit info from Supabase
    const enrichedAgreements = await Promise.all(
      agreements.map(async (agreement) => {
        const { data: unit } = await supabase
          .from('units')
          .select('unit_code, house_type, purchaser_name')
          .eq('id', agreement.unit_id)
          .single();

        return {
          ...agreement,
          unit_code: unit?.unit_code || 'Unknown',
          house_type: unit?.house_type || 'Unknown',
          unit_purchaser_name: unit?.purchaser_name,
        };
      })
    );

    return NextResponse.json({ agreements: enrichedAgreements });
  } catch (error) {
    console.error('[Agreements API Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch agreements' }, { status: 500 });
  }
}
