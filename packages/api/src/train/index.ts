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
  console.log('\n' + '='.repeat(80));
  console.log('🚀 TRAINING PIPELINE STARTED');
  console.log('='.repeat(80));
  console.log(`📁 File: ${fileName}`);
  console.log(`🏢 Tenant: ${tenantId}`);
  console.log(`🏗️  Development: ${developmentId}`);
  console.log('');
  
  let jobId: string | undefined;
  let documentId: string | undefined;
  
  try {
    jobId = await createJob(tenantId, developmentId, fileName, fileType || 'unknown');
    await updateJobStatus(jobId, 'processing');
    
    console.log('STEP 1: PARSING FILE');
    console.log('-'.repeat(80));
    const items = await parseFile(buffer, fileName, tenantId, fileType);
    console.log(`✅ Parsed ${items.length} items\n`);
    
    console.log('STEP 2: CHUNKING TEXT');
    console.log('-'.repeat(80));
    const chunkedItems = await chunkTrainingItems(items);
    const allChunks = chunkedItems.flatMap(ci => ci.chunks);
    console.log(`✅ Created ${allChunks.length} chunks\n`);
    
    await updateJobProgress(jobId, 0, allChunks.length);
    
    console.log('STEP 3: GENERATING EMBEDDINGS');
    console.log('-'.repeat(80));
    const embeddings = await embedChunks(allChunks);
    console.log(`✅ Generated ${embeddings.length} embeddings\n`);
    
    await updateJobProgress(jobId, Math.floor(allChunks.length / 2), allChunks.length);
    
    console.log('STEP 4: CREATING DOCUMENT RECORD');
    console.log('-'.repeat(80));
    const docResult = await createDocument(tenantId, developmentId, fileName);
    documentId = docResult.id;
    const houseTypeCode = docResult.houseTypeCode;
    console.log(`✅ Document created with ID: ${documentId}\n`);
    
    console.log('STEP 5: FLOORPLAN DIMENSION EXTRACTION (if applicable)');
    console.log('-'.repeat(80));
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
        
        if (floorplanResult.success) {
          console.log(`✅ Extracted ${floorplanResult.roomsExtracted} room dimensions\n`);
        } else {
          console.log(`⚠️  Floorplan extraction failed: ${floorplanResult.error}\n`);
        }
      } catch (error) {
        console.error('⚠️  Floorplan extraction error (non-fatal):', error);
      }
    } else {
      console.log(`⏭️  Skipped (not a floorplan or no house type)\n`);
    }
    
    console.log('STEP 6: STORING IN DATABASE');
    console.log('-'.repeat(80));
    const result = await ingestEmbeddings(
      embeddings,
      tenantId,
      developmentId,
      items[0]?.sourceType || 'unknown',
      documentId,
      houseTypeCode
    );
    console.log(`✅ Stored ${result.chunksInserted} chunks\n`);
    
    if (!result.success) {
      throw new Error(`Failed to ingest embeddings: ${result.errors?.join(', ') || 'Unknown error'}`);
    }
    
    console.log('STEP 7: UPDATING DOCUMENT CHUNK COUNT');
    console.log('-'.repeat(80));
    await updateDocumentChunkCount(documentId, result.chunksInserted);
    console.log(`✅ Updated document with ${result.chunksInserted} chunks\n`);
    
    await updateJobProgress(jobId, allChunks.length, allChunks.length);
    await updateJobStatus(jobId, 'completed');
    
    console.log('='.repeat(80));
    console.log('✅ TRAINING PIPELINE COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`📊 Summary:`);
    console.log(`   • Items parsed: ${items.length}`);
    console.log(`   • Chunks created: ${allChunks.length}`);
    console.log(`   • Embeddings generated: ${embeddings.length}`);
    console.log(`   • Chunks stored: ${result.chunksInserted}`);
    console.log(`   • Job ID: ${jobId}`);
    console.log('='.repeat(80));
    console.log('');
    
    return {
      success: true,
      tenantId,
      chunks: allChunks.length,
      inserted: result.chunksInserted,
      jobId,
    };
  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TRAINING PIPELINE FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('='.repeat(80));
    console.error('');
    
    if (jobId) {
      await updateJobStatus(
        jobId,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
    
    if (documentId) {
      console.log('🗑️  Cleaning up document due to failure...');
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
