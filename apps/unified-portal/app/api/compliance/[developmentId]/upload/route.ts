import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const unitId = formData.get('unitId') as string;
    const documentTypeId = formData.get('documentTypeId') as string;
    const expiryDate = formData.get('expiryDate') as string | null;
    const notes = formData.get('notes') as string | null;
    const applyToAll = formData.get('applyToAll') === 'true';

    if (!file || !unitId || !documentTypeId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const url = new URL(request.url);
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

    const fileBuffer = await file.arrayBuffer();
    const fileName = `${Date.now()}_${file.name}`;
    const storagePath = `${tenantId}/${actualDevelopmentId}/${unitId}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('compliance-documents')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Compliance Upload] Storage error:', uploadError);
      if (uploadError.message.includes('Bucket not found')) {
        const { error: createBucketError } = await supabaseAdmin.storage.createBucket('compliance-documents', {
          public: false,
        });
        if (createBucketError && !createBucketError.message.includes('already exists')) {
          console.error('[Compliance Upload] Create bucket error:', createBucketError);
          return NextResponse.json({ error: 'Storage not available' }, { status: 500 });
        }
        const { error: retryError } = await supabaseAdmin.storage
          .from('compliance-documents')
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });
        if (retryError) {
          console.error('[Compliance Upload] Retry upload error:', retryError);
          return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }
    }

    const uploadToUnit = async (targetUnitId: string) => {
      const { data: existing } = await supabaseAdmin
        .from('compliance_documents')
        .select('id, version')
        .eq('unit_id', targetUnitId)
        .eq('document_type_id', documentTypeId)
        .single();

      let documentId: string;
      let version = 1;

      if (existing) {
        version = (existing.version || 0) + 1;
        const { data: updatedDoc, error: updateError } = await supabaseAdmin
          .from('compliance_documents')
          .update({
            status: 'uploaded',
            uploaded_by: session.email,
            version,
            expiry_date: expiryDate || null,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        documentId = existing.id;
      } else {
        const { data: newDoc, error: insertError } = await supabaseAdmin
          .from('compliance_documents')
          .insert({
            tenant_id: tenantId,
            development_id: actualDevelopmentId,
            unit_id: targetUnitId,
            document_type_id: documentTypeId,
            status: 'uploaded',
            uploaded_by: session.email,
            version: 1,
            expiry_date: expiryDate || null,
            notes: notes || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        documentId = newDoc.id;
      }

      const { error: fileError } = await supabaseAdmin
        .from('compliance_files')
        .insert({
          tenant_id: tenantId,
          document_id: documentId,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: targetUnitId === unitId ? storagePath : storagePath.replace(unitId, targetUnitId),
          version,
          uploaded_by: session.email,
        });

      if (fileError) {
        console.error('[Compliance Upload] File record error:', fileError);
      }

      return documentId;
    };

    if (applyToAll) {
      const { data: units } = await supabaseAdmin
        .from('units')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('development_id', actualDevelopmentId);

      if (units) {
        for (const unit of units) {
          try {
            await uploadToUnit(unit.id);
          } catch (err) {
            console.error('[Compliance Upload] Error uploading to unit:', unit.id, err);
          }
        }
      }

      return NextResponse.json({ success: true, message: `Uploaded to ${units?.length || 0} units` });
    } else {
      const documentId = await uploadToUnit(unitId);
      return NextResponse.json({ success: true, documentId });
    }
  } catch (error: any) {
    console.error('[Compliance Upload] Error:', error);
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
