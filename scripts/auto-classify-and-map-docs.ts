#!/usr/bin/env tsx
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { classifyDocument, autoMapFloorplanToHouseType } from '../packages/api/src';
import { eq, isNull } from 'drizzle-orm';

async function autoClassifyAndMapAllDocuments() {
  console.log('\n' + '='.repeat(80));
  console.log('🤖 BATCH AUTO-CLASSIFICATION & HOUSE-TYPE MAPPING');
  console.log('='.repeat(80) + '\n');

  const documentsToProcess = await db
    .select()
    .from(documents)
    .where(isNull(documents.doc_kind));

  console.log(`📋 Found ${documentsToProcess.length} documents without classification\n`);

  if (documentsToProcess.length === 0) {
    console.log('✅ All documents are already classified. Exiting.\n');
    return;
  }

  let classifiedCount = 0;
  let floorplanCount = 0;
  let mappedCount = 0;
  let reviewNeededCount = 0;

  for (const doc of documentsToProcess) {
    console.log('\n' + '─'.repeat(80));
    console.log(`📄 Processing: ${doc.original_file_name || doc.file_name}`);
    console.log(`   Document ID: ${doc.id}`);
    console.log('─'.repeat(80));

    // Classify document
    const classification = await classifyDocument(doc);
    classifiedCount++;

    let finalHouseTypeId: string | null = null;
    let finalHouseTypeCode: string | null = null;
    let finalConfidence = classification.mapping_confidence;
    let finalNeedsReview = classification.needs_review;

    // If floorplan, attempt auto-mapping
    if (classification.doc_kind === 'floorplan') {
      floorplanCount++;
      
      if (doc.development_id) {
        const mapping = await autoMapFloorplanToHouseType({
          id: doc.id,
          tenant_id: doc.tenant_id,
          development_id: doc.development_id,
          file_name: doc.file_name,
          original_file_name: doc.original_file_name,
        });

        finalHouseTypeId = mapping.house_type_id;
        finalHouseTypeCode = mapping.house_type_code;

        if (mapping.house_type_id) {
          mappedCount++;
          finalConfidence = Math.min(classification.mapping_confidence + 0.05, 1.0);
          finalNeedsReview = false;
        } else {
          finalNeedsReview = mapping.needs_review;
        }
      } else {
        // Floorplan without development_id - flag for review
        console.log('   ⚠️  Floorplan has no development_id - flagging for manual review');
        finalNeedsReview = true;
      }
    }

    if (finalNeedsReview) {
      reviewNeededCount++;
    }

    // Update database
    await db
      .update(documents)
      .set({
        doc_kind: classification.doc_kind,
        mapping_confidence: finalConfidence,
        needs_review: finalNeedsReview,
        auto_mapped: finalHouseTypeId !== null,
        house_type_id: finalHouseTypeId,
        house_type_code: finalHouseTypeCode,
        updated_at: new Date(),
      })
      .where(eq(documents.id, doc.id));

    console.log(`✅ Updated document ${doc.id}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 BATCH PROCESSING COMPLETE');
  console.log('='.repeat(80));
  console.log(`✅ Classified: ${classifiedCount} documents`);
  console.log(`🏠 Floorplans: ${floorplanCount}`);
  console.log(`🎯 Auto-mapped: ${mappedCount} floorplans to house types`);
  console.log(`⚠️  Needs Review: ${reviewNeededCount} documents`);
  console.log('='.repeat(80) + '\n');
}

autoClassifyAndMapAllDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Batch processing failed:', error);
    process.exit(1);
  });
