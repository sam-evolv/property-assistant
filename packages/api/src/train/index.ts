import { parseFile } from './parse';
import { chunkTrainingItems } from './chunk';
import { embedChunks } from './embed';
import { ingestEmbeddings, createDocument, markDocumentFailed, updateDocumentChunkCount } from './ingest';
import { createJob, updateJobStatus, updateJobProgress, getJob, getTenantJobs } from './status';
import { TrainingPipelineResult, TrainingJob } from './types';
import { extractRoomDimensionsFromFloorplan, isLikelyFloorplan } from './floorplan-vision';

export async function trainFromFile(
  buffer: Buffer,
  fileName: string,
  tenantId: string,
  developmentId: string,
  fileType?: string
): Promise<TrainingPipelineResult> {
  let jobId: string | undefined;
  let documentId: string | undefined;
  
  try {
    jobId = await createJob(tenantId, developmentId, fileName, fileType || 'unknown');
    await updateJobStatus(jobId, 'processing');
    
    const items = await parseFile(buffer, fileName, tenantId, fileType);

    const chunkedItems = await chunkTrainingItems(items);
    const allChunks = chunkedItems.flatMap(ci => ci.chunks);
    
    await updateJobProgress(jobId, 0, allChunks.length);
    
    const embeddings = await embedChunks(allChunks);
    
    await updateJobProgress(jobId, Math.floor(allChunks.length / 2), allChunks.length);
    
    const docResult = await createDocument(tenantId, developmentId, fileName);
    documentId = docResult.id;
    const houseTypeCode = docResult.houseTypeCode;
    if (isLikelyFloorplan(fileName, docResult.documentType) && houseTypeCode && docResult.houseTypeId) {
      try {
        const floorplanResult = await extractRoomDimensionsFromFloorplan({
          tenant_id: tenantId,
          development_id: developmentId,
          house_type_id: docResult.houseTypeId,
          unit_type_code: houseTypeCode,
          document_id: documentId,
          buffer,
          fileName,
        });
        
      } catch (error) {
      }
    }

    const result = await ingestEmbeddings(
      embeddings,
      tenantId,
      developmentId,
      items[0]?.sourceType || 'unknown',
      documentId,
      houseTypeCode
    );
    
    if (!result.success) {
      throw new Error(`Failed to ingest embeddings: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    await updateDocumentChunkCount(documentId, result.chunksInserted);
    
    await updateJobProgress(jobId, allChunks.length, allChunks.length);
    await updateJobStatus(jobId, 'completed');
    
    return {
      success: true,
      tenantId,
      chunks: allChunks.length,
      inserted: result.chunksInserted,
      jobId,
    };
  } catch (error) {
    if (jobId) {
      await updateJobStatus(
        jobId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    
    if (documentId) {
      await markDocumentFailed(documentId);
    }
    
    return {
      success: false,
      tenantId,
      chunks: 0,
      inserted: 0,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export { getJob, getTenantJobs };
export type { TrainingJob, TrainingPipelineResult };
export * from './types';
