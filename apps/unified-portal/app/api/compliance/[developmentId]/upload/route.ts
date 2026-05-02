export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import { sendNotification } from '@/lib/notifications';

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
      if (uploadError.message.includes('Bucket not found')) {
        const { error: createBucketError } = await supabaseAdmin.storage.createBucket('compliance-documents', {
          public: false,
        });
        if (createBucketError && !createBucketError.message.includes('already exists')) {
          return NextResponse.json({ error: 'Storage not available' }, { status: 500 });
        }
        const { error: retryError } = await supabaseAdmin.storage
          .from('compliance-documents')
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });
        if (retryError) {
          return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }
    }

    const uploadToUnit = async (targetUnitId: string) => {
      // Read the prior row (if any) to bump the version counter.
      // .maybeSingle() returns data:null on no rows rather than emitting
      // a PostgREST PGRST116 error the way .single() does.
      const { data: priorRow, error: priorErr } = await supabaseAdmin
        .from('compliance_documents')
        .select('id, version')
        .eq('unit_id', targetUnitId)
        .eq('document_type_id', documentTypeId)
        .maybeSingle();

      if (priorErr) throw priorErr;

      const nextVersion = (priorRow?.version ?? 0) + 1;

      // Atomic upsert keyed on the (unit_id, document_type_id) unique
      // constraint. Replaces in place when a row exists, inserts
      // otherwise. Closes the race window the previous two-step
      // select-then-insert pattern carried (two concurrent uploads
      // could both see "no row" and both INSERT, hitting the constraint).
      const { data: upsertedDoc, error: upsertError } = await supabaseAdmin
        .from('compliance_documents')
        .upsert(
          {
            tenant_id: tenantId,
            development_id: actualDevelopmentId,
            unit_id: targetUnitId,
            document_type_id: documentTypeId,
            status: 'uploaded',
            uploaded_by: session.email,
            version: nextVersion,
            expiry_date: expiryDate || null,
            notes: notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'unit_id,document_type_id' },
        )
        .select('id')
        .single();

      if (upsertError) throw upsertError;
      const documentId = upsertedDoc.id;
      const version = nextVersion;

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
        console.error('[compliance_upload] failed to insert compliance_files row', {
          documentId,
          targetUnitId,
          version,
          message: fileError.message,
        });
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
          } catch (_err) {
              // error handled silently
          }
        }
      }

      return NextResponse.json({ success: true, message: `Uploaded to ${units?.length || 0} units` });
    } else {
      const documentId = await uploadToUnit(unitId);

      // Send notification to the purchaser (non-blocking)
      sendNotification({
        userId: unitId,
        unitId,
        developmentId: actualDevelopmentId,
        title: 'New Document',
        body: `A new compliance document (${file.name}) has been uploaded to your property portal.`,
        category: 'compliance',
        triggeredBy: 'compliance.document_uploaded',
        actionUrl: '/documents',
      }).catch(() => { /* notification failure is non-critical */ });

      return NextResponse.json({ success: true, documentId });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
