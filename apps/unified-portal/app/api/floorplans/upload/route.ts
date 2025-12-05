import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, houseTypes } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { 
  processFloorplanUpload, 
  extractHouseTypeCodeFromFilename,
  FloorplanUploadResult 
} from '@openhouse/api/floorplan-storage';
import { extractRoomDimensionsFromFloorplan } from '@openhouse/api/train/floorplan-vision';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ALLOWED_MIME_TYPES = ['application/pdf'];

export async function POST(request: NextRequest) {
  console.log('\n🚀 [FLOORPLAN UPLOAD] Request received at:', new Date().toISOString());
  
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const developmentId = formData.get('development_id') as string | null;
    const autoExtractDimensions = formData.get('auto_extract') !== 'false';

    if (!developmentId) {
      return NextResponse.json({ error: 'Development ID is required' }, { status: 400 });
    }

    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
      columns: { id: true, tenant_id: true, name: true },
    });

    if (!development) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && development.tenant_id !== tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    console.log(`[FLOORPLAN UPLOAD] Processing ${files.length} files for development: ${development.name}`);

    const results: FloorplanUploadResult[] = [];
    const extractionJobs: Promise<void>[] = [];

    for (const file of files) {
      if (!file || !(file instanceof File)) {
        continue;
      }

      const mimeType = file.type || 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        console.warn(`[FLOORPLAN UPLOAD] Skipping non-PDF file: ${file.name}`);
        results.push({
          success: false,
          houseTypeCode: '',
          storagePath: '',
          error: `Only PDF files are allowed. Got: ${mimeType}`,
        });
        continue;
      }

      const houseTypeCode = extractHouseTypeCodeFromFilename(file.name);
      if (!houseTypeCode) {
        console.warn(`[FLOORPLAN UPLOAD] Could not extract house type from: ${file.name}`);
        results.push({
          success: false,
          houseTypeCode: '',
          storagePath: '',
          error: `Could not extract house type code from filename: ${file.name}. Expected format like BD01_floorplan.pdf or BS02-Ground.pdf`,
        });
        continue;
      }

      console.log(`[FLOORPLAN UPLOAD] Processing: ${file.name} → House Type: ${houseTypeCode}`);

      const buffer = Buffer.from(await file.arrayBuffer());
      
      const result = await processFloorplanUpload(
        buffer,
        file.name,
        developmentId,
        tenantId
      );

      results.push(result);

      if (result.success && result.houseTypeId && autoExtractDimensions) {
        const houseTypeIdCapture = result.houseTypeId;
        const fileNameCapture = file.name;
        
        const extractionJob = extractRoomDimensionsFromFloorplan({
          tenant_id: tenantId,
          development_id: developmentId,
          house_type_id: houseTypeIdCapture,
          unit_type_code: houseTypeCode,
          document_id: `floorplan-${houseTypeIdCapture}`,
          buffer,
          fileName: fileNameCapture,
        }).then(async (extractResult) => {
          if (extractResult.success && extractResult.rawPayload) {
            console.log(`[FLOORPLAN UPLOAD] OCR extracted ${extractResult.roomsExtracted} rooms from ${fileNameCapture}`);
            
            const dimensions: Record<string, { length?: number; width?: number; area?: number }> = {};
            for (const level of extractResult.rawPayload.levels) {
              for (const room of level.rooms) {
                const roomKey = room.room_name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                dimensions[roomKey] = {
                  length: room.length_m,
                  width: room.width_m,
                  area: room.area_m2,
                };
              }
            }
            
            if (Object.keys(dimensions).length > 0) {
              await db.update(houseTypes)
                .set({ dimensions })
                .where(eq(houseTypes.id, houseTypeIdCapture));
              console.log(`[FLOORPLAN UPLOAD] Stored dimensions in house_types for ${fileNameCapture}`);
            }
          } else {
            console.log(`[FLOORPLAN UPLOAD] OCR extraction failed for ${fileNameCapture}: ${extractResult.error}`);
          }
        }).catch((err: Error) => {
          console.error(`[FLOORPLAN UPLOAD] OCR error for ${fileNameCapture}:`, err);
        });

        extractionJobs.push(extractionJob);
      }
    }

    Promise.allSettled(extractionJobs).then(() => {
      console.log('[FLOORPLAN UPLOAD] All background OCR jobs completed');
    });

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[FLOORPLAN UPLOAD] Complete: ${successful} succeeded, ${failed} failed`);

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    });
  } catch (error) {
    console.error('[FLOORPLAN UPLOAD] Error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'UNAUTHORIZED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to upload floorplans' },
      { status: 500 }
    );
  }
}
