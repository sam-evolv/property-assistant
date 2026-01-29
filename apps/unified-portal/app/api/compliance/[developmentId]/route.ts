import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const devName = url.searchParams.get('name');
    console.log('[Compliance API] GET request for development:', developmentId, 'name param:', devName);

    const { data: allDevs } = await supabaseAdmin
      .from('developments')
      .select('id, name, code')
      .eq('tenant_id', tenantId);

    let development = allDevs?.find(d => d.id === developmentId);
    let actualDevelopmentId = developmentId;
    
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) {
        console.log('[Compliance API] Found development by name:', development.name);
        actualDevelopmentId = development.id;
      }
    }
    
    if (!development && allDevs && allDevs.length > 0) {
      console.log('[Compliance API] Using first available development');
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }

    if (!development) {
      return NextResponse.json({ error: 'No developments found' }, { status: 404 });
    }

    console.log('[Compliance API] Using development:', development.name, '(', actualDevelopmentId, ')');
    console.log('[Compliance API] Querying units for tenant:', tenantId, 'development:', actualDevelopmentId);

    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select('id, name, unit_number, purchaser_name, house_type_code, bedrooms, address')
      .eq('tenant_id', tenantId)
      .eq('development_id', actualDevelopmentId)
      .order('unit_number', { ascending: true });
    
    console.log('[Compliance API] Units query result:', units?.length || 0, 'units, error:', unitsError?.message || 'none');

    const { data: documentTypes } = await supabaseAdmin
      .from('compliance_document_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('development_id', actualDevelopmentId)
      .order('category', { ascending: true });

    const { data: documents } = await supabaseAdmin
      .from('compliance_documents')
      .select('*, files:compliance_files(*)')
      .eq('tenant_id', tenantId)
      .eq('development_id', actualDevelopmentId);

    const stats = {
      totalUnits: units?.length || 0,
      totalDocTypes: documentTypes?.length || 0,
      uploaded: documents?.filter(d => d.status === 'uploaded').length || 0,
      verified: documents?.filter(d => d.status === 'verified').length || 0,
      missing: (units?.length || 0) * (documentTypes?.length || 0) - (documents?.length || 0),
      expired: documents?.filter(d => d.status === 'expired').length || 0,
    };

    return NextResponse.json({
      development: { id: actualDevelopmentId, name: development.name },
      units: units || [],
      documentTypes: documentTypes || [],
      documents: documents || [],
      stats,
    });
  } catch (error: any) {
    console.error('[Compliance API] Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
    const actionParam = url.searchParams.get('action');
    const body = await request.json();
    const action = actionParam || body.action;
    const data = body;
    const devName = url.searchParams.get('name');

    const { data: allDevs } = await supabaseAdmin
      .from('developments')
      .select('id, name')
      .eq('tenant_id', tenantId);

    let development = allDevs?.find(d => d.id === developmentId);
    let actualDevelopmentId = developmentId;
    
    if (!development && devName && allDevs) {
      development = allDevs.find(d => d.name.toLowerCase() === devName.toLowerCase());
      if (development) actualDevelopmentId = development.id;
    }
    
    if (!development && allDevs && allDevs.length > 0) {
      development = allDevs[0];
      actualDevelopmentId = allDevs[0].id;
    }

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    switch (action) {
      case 'addDocType':
      case 'add_document_type': {
        const { name, category, description, houseType, required } = data;
        
        const { data: newType, error } = await supabaseAdmin
          .from('compliance_document_types')
          .insert({
            tenant_id: tenantId,
            development_id: actualDevelopmentId,
            name,
            category: category || 'Certification',
            description,
            house_type: houseType || null,
            required: required !== false,
          })
          .select()
          .single();

        if (error) {
          console.error('[Compliance API] Error adding document type:', error);
          return NextResponse.json({ error: 'Failed to add document type' }, { status: 500 });
        }

        return NextResponse.json({ success: true, documentType: newType });
      }

      case 'removeDocType':
      case 'remove_document_type': {
        const { docTypeId } = data;
        
        if (!docTypeId) {
          return NextResponse.json({ error: 'Document type ID required' }, { status: 400 });
        }

        await supabaseAdmin
          .from('compliance_documents')
          .delete()
          .eq('document_type_id', docTypeId);

        const { error } = await supabaseAdmin
          .from('compliance_document_types')
          .delete()
          .eq('id', docTypeId)
          .eq('tenant_id', tenantId);

        if (error) {
          console.error('[Compliance API] Error removing document type:', error);
          return NextResponse.json({ error: 'Failed to remove document type' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      case 'update_document': {
        const { documentId, status, notes, expiryDate } = data;

        const updates: any = { updated_at: new Date().toISOString() };
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;
        if (expiryDate !== undefined) updates.expiry_date = expiryDate;
        if (status === 'verified') {
          updates.verified_by = session.email;
          updates.verified_at = new Date().toISOString();
        }

        const { data: updated, error } = await supabaseAdmin
          .from('compliance_documents')
          .update(updates)
          .eq('id', documentId)
          .select()
          .single();

        if (error) {
          console.error('[Compliance API] Error updating document:', error);
          return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
        }

        return NextResponse.json({ success: true, document: updated });
      }

      case 'create_document': {
        const { unitId, documentTypeId, status } = data;

        const { data: existing } = await supabaseAdmin
          .from('compliance_documents')
          .select('id')
          .eq('unit_id', unitId)
          .eq('document_type_id', documentTypeId)
          .single();

        if (existing) {
          return NextResponse.json({ error: 'Document already exists' }, { status: 400 });
        }

        const { data: newDoc, error } = await supabaseAdmin
          .from('compliance_documents')
          .insert({
            tenant_id: tenantId,
            development_id: actualDevelopmentId,
            unit_id: unitId,
            document_type_id: documentTypeId,
            status: status || 'missing',
            uploaded_by: session.email,
          })
          .select()
          .single();

        if (error) {
          console.error('[Compliance API] Error creating document:', error);
          return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
        }

        return NextResponse.json({ success: true, document: newDoc });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Compliance API] POST Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
