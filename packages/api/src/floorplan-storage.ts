import { createServerSupabaseClient } from './supabase';
import { db } from '@openhouse/db/client';
import { houseTypes, developments } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export interface FloorplanUploadResult {
  success: boolean;
  houseTypeCode: string;
  storagePath: string;
  houseTypeId?: string;
  error?: string;
}

export interface FloorplanDimensions {
  [roomName: string]: {
    length?: number;
    width?: number;
    area?: number;
  };
}

const HOUSE_TYPE_CODE_PATTERN = /\b([A-Z]{2,4}\d{1,3}[A-Z]?)\b/i;

export function extractHouseTypeCodeFromFilename(filename: string): string | null {
  const match = filename.match(HOUSE_TYPE_CODE_PATTERN);
  if (match) {
    return match[1].toUpperCase();
  }
  return null;
}

export async function uploadFloorplanToStorage(
  buffer: Buffer,
  developmentId: string,
  houseTypeCode: string,
  mimeType: string = 'application/pdf'
): Promise<{ success: boolean; path: string; error?: string }> {
  const supabase = createServerSupabaseClient();
  
  const storagePath = `floorplans/${developmentId}/${houseTypeCode}.pdf`;
  
  const { error } = await supabase.storage
    .from('floorplans')
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
  
  if (error) {
    console.error('[FloorplanStorage] Upload error:', error);
    return { success: false, path: storagePath, error: error.message };
  }
  
  return { success: true, path: storagePath };
}

export async function getFloorplanSignedUrl(
  developmentId: string,
  houseTypeCode: string,
  expiresIn: number = 3600
): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  
  const storagePath = `floorplans/${developmentId}/${houseTypeCode}.pdf`;
  
  const { data, error } = await supabase.storage
    .from('floorplans')
    .createSignedUrl(storagePath, expiresIn);
  
  if (error || !data) {
    console.log('[FloorplanStorage] Could not get signed URL:', error?.message);
    return null;
  }
  
  return data.signedUrl;
}

export async function ensureFloorplansBucketExists(): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('[FloorplanStorage] Error listing buckets:', listError);
    return false;
  }
  
  const exists = buckets?.some(b => b.name === 'floorplans');
  
  if (!exists) {
    const { error: createError } = await supabase.storage.createBucket('floorplans', {
      public: false,
      fileSizeLimit: 52428800,
    });
    
    if (createError) {
      console.error('[FloorplanStorage] Error creating bucket:', createError);
      return false;
    }
    
    console.log('[FloorplanStorage] Created floorplans bucket');
  }
  
  return true;
}

export async function processFloorplanUpload(
  buffer: Buffer,
  filename: string,
  developmentId: string,
  tenantId: string
): Promise<FloorplanUploadResult> {
  const houseTypeCode = extractHouseTypeCodeFromFilename(filename);
  
  if (!houseTypeCode) {
    return {
      success: false,
      houseTypeCode: '',
      storagePath: '',
      error: `Could not extract house type code from filename: ${filename}. Expected format like BD01, BS02, etc.`,
    };
  }
  
  await ensureFloorplansBucketExists();
  
  const uploadResult = await uploadFloorplanToStorage(buffer, developmentId, houseTypeCode);
  
  if (!uploadResult.success) {
    return {
      success: false,
      houseTypeCode,
      storagePath: uploadResult.path,
      error: uploadResult.error,
    };
  }
  
  let houseType = await db.query.houseTypes.findFirst({
    where: and(
      eq(houseTypes.development_id, developmentId),
      eq(houseTypes.house_type_code, houseTypeCode)
    ),
  });
  
  if (!houseType) {
    const [newHouseType] = await db.insert(houseTypes).values({
      tenant_id: tenantId,
      development_id: developmentId,
      house_type_code: houseTypeCode,
      name: `House Type ${houseTypeCode}`,
    }).returning();
    
    houseType = newHouseType;
    console.log(`[FloorplanStorage] Created new house type: ${houseTypeCode}`);
  }
  
  return {
    success: true,
    houseTypeCode,
    storagePath: uploadResult.path,
    houseTypeId: houseType.id,
  };
}

export async function storeDimensionsInHouseType(
  houseTypeId: string,
  dimensions: FloorplanDimensions
): Promise<boolean> {
  try {
    await db.update(houseTypes)
      .set({ dimensions })
      .where(eq(houseTypes.id, houseTypeId));
    
    console.log(`[FloorplanStorage] Stored dimensions for house type ${houseTypeId}`);
    return true;
  } catch (error) {
    console.error('[FloorplanStorage] Error storing dimensions:', error);
    return false;
  }
}

export async function getHouseTypeDimensions(
  houseTypeId: string
): Promise<FloorplanDimensions | null> {
  const houseType = await db.query.houseTypes.findFirst({
    where: eq(houseTypes.id, houseTypeId),
    columns: { dimensions: true },
  });
  
  if (!houseType?.dimensions) {
    return null;
  }
  
  return houseType.dimensions as FloorplanDimensions;
}
