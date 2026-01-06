import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { scheme_profile } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';

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
          ...body,
          updated_at: new Date(),
        })
        .where(eq(scheme_profile.id, schemeId))
        .returning();
      
      return NextResponse.json({ 
        profile: updated[0],
        message: 'Profile updated successfully'
      });
    } else {
      const created = await db
        .insert(scheme_profile)
        .values({
          id: schemeId,
          developer_org_id: auth.tenantId,
          scheme_name: body.scheme_name || 'Untitled Scheme',
          ...body,
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
    
    const created = await db
      .insert(scheme_profile)
      .values({
        id: schemeId,
        developer_org_id: auth.tenantId,
        scheme_name: body.scheme_name || 'Untitled Scheme',
        ...body,
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
