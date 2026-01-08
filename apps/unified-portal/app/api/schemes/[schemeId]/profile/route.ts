import { NextRequest, NextResponse } from 'next/server';
import { db, scheme_profile } from '@db/client';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verifySchemeOwnership(schemeId: string, tenantId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', schemeId)
      .single();
    
    if (error || !data) {
      console.error('[verifySchemeOwnership] Project not found:', schemeId);
      return false;
    }
    
    if (!data.organization_id) {
      console.error('[verifySchemeOwnership] Project has no organization_id:', schemeId);
      return false;
    }
    
    if (data.organization_id !== tenantId) {
      console.error('[verifySchemeOwnership] Tenant mismatch:', data.organization_id, '!==', tenantId);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[verifySchemeOwnership] Error:', error);
    return false;
  }
}

const WRITABLE_FIELDS = [
  'scheme_name',
  'scheme_address',
  'scheme_lat',
  'scheme_lng',
  'scheme_status',
  'homes_count',
  'managing_agent_name',
  'contact_email',
  'contact_phone',
  'emergency_contact_phone',
  'emergency_contact_notes',
  'snag_reporting_method',
  'snag_reporting_details',
  'heating_type',
  'heating_controls',
  'broadband_type',
  'water_billing',
  'waste_setup',
  'bin_storage_notes',
  'waste_provider',
  'parking_type',
  'visitor_parking',
  'parking_notes',
  'has_house_rules',
  'exterior_changes_require_approval',
  'rules_notes',
  'authority_contacts',
  'authority_core_facts',
  'authority_waste_parking',
  'authority_rules',
  'authority_snagging',
] as const;

function sanitizePayload(body: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      sanitized[field] = body[field];
    }
  }
  return sanitized;
}

async function getAuthContext() {
  const cookieStore = cookies();
  const adminId = cookieStore.get('admin_id')?.value;
  const tenantId = cookieStore.get('tenant_id')?.value;
  const role = cookieStore.get('user_role')?.value;
  
  if (!adminId || !tenantId) {
    return null;
  }
  
  return { adminId, tenantId, role };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { schemeId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (auth.role !== 'developer' && auth.role !== 'admin' && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { schemeId } = params;
    
    const profiles = await db
      .select()
      .from(scheme_profile)
      .where(eq(scheme_profile.id, schemeId))
      .limit(1);
    
    if (profiles.length === 0) {
      return NextResponse.json({ 
        profile: null,
        message: 'No profile found. Create one to get started.'
      });
    }
    
    const profile = profiles[0];
    
    if (auth.role === 'developer' && profile.developer_org_id !== auth.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[GET /api/schemes/[schemeId]/profile] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { schemeId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (auth.role !== 'developer' && auth.role !== 'admin' && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { schemeId } = params;
    const body = await request.json();
    const sanitizedData = sanitizePayload(body);
    
    const existingProfiles = await db
      .select()
      .from(scheme_profile)
      .where(eq(scheme_profile.id, schemeId))
      .limit(1);
    
    if (existingProfiles.length > 0) {
      const existing = existingProfiles[0];
      
      if (auth.role === 'developer' && existing.developer_org_id !== auth.tenantId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      
      const updated = await db
        .update(scheme_profile)
        .set({
          ...sanitizedData,
          updated_at: new Date(),
        })
        .where(eq(scheme_profile.id, schemeId))
        .returning();
      
      return NextResponse.json({ 
        profile: updated[0],
        message: 'Profile updated successfully'
      });
    } else {
      if (auth.role === 'developer') {
        const isOwner = await verifySchemeOwnership(schemeId, auth.tenantId);
        if (!isOwner) {
          return NextResponse.json({ error: 'Forbidden: scheme does not belong to your organization' }, { status: 403 });
        }
      }
      
      if (!sanitizedData.scheme_name) {
        sanitizedData.scheme_name = 'Untitled Scheme';
      }
      
      const created = await db
        .insert(scheme_profile)
        .values({
          id: schemeId,
          developer_org_id: auth.tenantId,
          ...sanitizedData,
        })
        .returning();
      
      return NextResponse.json({ 
        profile: created[0],
        message: 'Profile created successfully'
      });
    }
  } catch (error) {
    console.error('[PUT /api/schemes/[schemeId]/profile] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { schemeId: string } }
) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (auth.role !== 'developer' && auth.role !== 'admin' && auth.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { schemeId } = params;
    const body = await request.json();
    const sanitizedData = sanitizePayload(body);
    
    const existingProfiles = await db
      .select()
      .from(scheme_profile)
      .where(eq(scheme_profile.id, schemeId))
      .limit(1);
    
    if (existingProfiles.length > 0) {
      return NextResponse.json({ 
        error: 'Profile already exists. Use PUT to update.'
      }, { status: 400 });
    }
    
    if (auth.role === 'developer') {
      const isOwner = await verifySchemeOwnership(schemeId, auth.tenantId);
      if (!isOwner) {
        return NextResponse.json({ error: 'Forbidden: scheme does not belong to your organization' }, { status: 403 });
      }
    }
    
    if (!sanitizedData.scheme_name) {
      sanitizedData.scheme_name = 'Untitled Scheme';
    }
    
    const created = await db
      .insert(scheme_profile)
      .values({
        id: schemeId,
        developer_org_id: auth.tenantId,
        ...sanitizedData,
      })
      .returning();
    
    return NextResponse.json({ 
      profile: created[0],
      message: 'Profile created successfully'
    });
  } catch (error) {
    console.error('[POST /api/schemes/[schemeId]/profile] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
