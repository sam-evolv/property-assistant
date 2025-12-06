import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { documents, admins, houseTypes, userDevelopments } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { classifyDocumentWithAI, extractHouseTypeCodes } from '@/lib/ai-classify';
import type { DisciplineType } from '@/lib/archive-constants';

interface UploadMetadata {
  discipline?: DisciplineType | null;
  houseTypeId?: string | null;
  isImportant?: boolean;
  mustRead?: boolean;
}

async function validateTenantAdminAccess(
  email: string,
  tenantId: string,
  developmentId: string
): Promise<{ valid: boolean; error?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.email, email),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    console.log('[Upload] No admin found for email:', email, 'tenant:', tenantId);
    return { valid: false, error: 'Admin not found for this tenant' };
  }

  if (admin.role === 'super_admin' || admin.role === 'tenant_admin') {
    return { valid: true };
  }

  if (admin.role !== 'developer' && admin.role !== 'admin') {
    return { valid: false, error: 'Insufficient permissions to upload documents' };
  }

  const hasAccess = await db.query.userDevelopments.findFirst({
    where: and(
      eq(userDevelopments.user_id, admin.id),
      eq(userDevelopments.development_id, developmentId)
    ),
    columns: { user_id: true }
  });

  if (!hasAccess) {
    return { valid: false, error: 'No access to this development' };
  }

  return { valid: true };
}

async function uploadToSupabaseStorage(
  supabase: ReturnType<typeof createServerComponentClient>,
  file: File,
  tenantId: string,
  developmentId: string
): Promise<{ path: string; publicUrl: string } | { error: string }> {
  const fileExt = file.name.split('.').pop() || 'pdf';
  const uniqueId = crypto.randomUUID();
  const storagePath = `tenant/${tenantId}/development/${developmentId}/${uniqueId}.${fileExt}`;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'documents');

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 52428800,
      });
      if (createError && !createError.message.includes('already exists')) {
        console.warn('[Upload] Could not create bucket, continuing without storage:', createError.message);
        return { path: storagePath, publicUrl: '' };
      }
    }

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.warn('[Upload] Storage upload failed, continuing without file storage:', uploadError.message);
      return { path: storagePath, publicUrl: '' };
    }

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    return {
      path: storagePath,
      publicUrl: publicUrlData?.publicUrl || ''
    };
  } catch (err) {
    console.warn('[Upload] Storage error, continuing without file storage:', err);
    return { path: storagePath, publicUrl: '' };
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return '';
  }
  
  if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.csv')) {
    const text = await file.text();
    return text.slice(0, 10000);
  }

  return '';
}

async function findHouseTypeIdFromCodes(
  codes: string[],
  developmentId: string,
  tenantId: string
): Promise<string | null> {
  if (codes.length === 0) return null;

  for (const code of codes) {
    const houseType = await db.query.houseTypes.findFirst({
      where: and(
        eq(houseTypes.development_id, developmentId),
        eq(houseTypes.tenant_id, tenantId),
        eq(houseTypes.house_type_code, code)
      ),
      columns: { id: true }
    });

    if (houseType) {
      return houseType.id;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const admin = await db.query.admins.findFirst({
      where: eq(admins.email, user.email),
      columns: { id: true, tenant_id: true, role: true }
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin account not found' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const tenantId = formData.get('tenantId') as string;
    const developmentId = formData.get('developmentId') as string;
    const metadataStr = formData.get('metadata') as string;
    const files = formData.getAll('files') as File[];

    if (!tenantId || !developmentId) {
      return NextResponse.json(
        { error: 'tenantId and developmentId are required' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 }
      );
    }

    const accessCheck = await validateTenantAdminAccess(admin.id, tenantId, developmentId);
    if (!accessCheck.valid) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: 403 }
      );
    }

    let metadata: UploadMetadata = {};
    try {
      metadata = metadataStr ? JSON.parse(metadataStr) : {};
    } catch {
      metadata = {};
    }

    const uploadedDocuments: Array<{
      id: string;
      fileName: string;
      discipline: string | null;
      houseTypeCode: string | null;
      isImportant: boolean;
      mustRead: boolean;
      aiClassified: boolean;
    }> = [];

    for (const file of files) {
      console.log(`[Upload] Processing file: ${file.name}`);

      const storageResult = await uploadToSupabaseStorage(
        supabase,
        file,
        tenantId,
        developmentId
      );

      if ('error' in storageResult) {
        console.error(`[Upload] Failed to upload ${file.name}:`, storageResult.error);
        continue;
      }

      let discipline = metadata.discipline || null;
      let houseTypeId = metadata.houseTypeId || null;
      let houseTypeCode: string | null = null;
      let aiClassified = false;

      const houseTypeCodes = extractHouseTypeCodes(file.name);
      if (houseTypeCodes.length > 0) {
        houseTypeCode = houseTypeCodes[0];
        if (!houseTypeId) {
          houseTypeId = await findHouseTypeIdFromCodes(houseTypeCodes, developmentId, tenantId);
        }
      }

      if (!discipline) {
        try {
          const textContent = await extractTextFromFile(file);
          const classification = await classifyDocumentWithAI(file.name, textContent);
          
          discipline = classification.discipline;
          aiClassified = true;
          
          if (houseTypeCodes.length === 0 && classification.houseTypeCodes.length > 0) {
            houseTypeCode = classification.houseTypeCodes[0];
            houseTypeId = await findHouseTypeIdFromCodes(
              classification.houseTypeCodes,
              developmentId,
              tenantId
            );
          }

          console.log(`[Upload] AI classified ${file.name} as ${discipline} (confidence: ${classification.confidence})`);
        } catch (classifyError) {
          console.error(`[Upload] Classification failed for ${file.name}:`, classifyError);
          discipline = 'other';
        }
      }

      const documentId = crypto.randomUUID();
      const title = file.name.replace(/\.[^/.]+$/, '');

      await db.insert(documents).values({
        id: documentId,
        tenant_id: tenantId,
        development_id: developmentId,
        title,
        file_name: file.name,
        original_file_name: file.name,
        relative_path: storageResult.path,
        storage_url: storageResult.path,
        file_url: null,
        mime_type: file.type,
        size_kb: Math.round(file.size / 1024),
        document_type: discipline || 'other',
        discipline,
        house_type_id: houseTypeId,
        house_type_code: houseTypeCode,
        is_important: metadata.isImportant || false,
        must_read: metadata.mustRead || false,
        uploaded_by: admin.id,
        status: 'active',
        processing_status: 'pending',
        ai_classified: aiClassified,
        ai_classified_at: aiClassified ? new Date() : null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      uploadedDocuments.push({
        id: documentId,
        fileName: file.name,
        discipline,
        houseTypeCode,
        isImportant: metadata.isImportant || false,
        mustRead: metadata.mustRead || false,
        aiClassified,
      });

      console.log(`[Upload] Document saved: ${documentId}`);
    }

    return NextResponse.json({
      success: true,
      uploaded: uploadedDocuments,
      message: `Successfully uploaded ${uploadedDocuments.length} document(s)`,
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
