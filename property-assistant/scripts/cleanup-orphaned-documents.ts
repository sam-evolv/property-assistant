/**
 * One-time cleanup script to remove orphaned document records
 * 
 * This script:
 * 1. Scans all documents in the database
 * 2. Checks if physical files exist on disk
 * 3. Deletes database records for missing files
 * 4. Keeps only valid documents with existing files
 * 
 * Usage: npx tsx scripts/cleanup-orphaned-documents.ts
 */

import { db } from '../packages/db/client';
import { documents, doc_chunks } from '../packages/db/schema';
import { eq } from 'drizzle-orm';
import { access, constants } from 'fs/promises';
import { join } from 'path';

async function cleanupOrphanedDocuments() {
  console.log('🧹 Starting orphaned documents cleanup...\n');

  try {
    // Fetch all documents from the database
    const allDocuments = await db.select().from(documents);
    
    console.log(`📊 Found ${allDocuments.length} documents in database\n`);

    const uploadsDir = join(process.cwd(), 'apps/unified-portal/public/uploads');
    const validDocuments: typeof allDocuments = [];
    const orphanedDocuments: typeof allDocuments = [];
    const emptyFileUrls: typeof allDocuments = [];

    // Check each document for file existence
    for (const doc of allDocuments) {
      // Check for empty file URLs
      if (!doc.file_url || doc.file_url.trim() === '') {
        emptyFileUrls.push(doc);
        console.log(`❌ Empty URL: ${doc.file_name || doc.title} (ID: ${doc.id})`);
        continue;
      }

      // Extract filename from file_url
      let fileName = doc.file_url;
      if (fileName.startsWith('/uploads/')) {
        fileName = fileName.substring('/uploads/'.length);
      } else if (fileName.startsWith('uploads/')) {
        fileName = fileName.substring('uploads/'.length);
      }

      const filePath = join(uploadsDir, fileName);

      // Check if file exists
      try {
        await access(filePath, constants.R_OK);
        validDocuments.push(doc);
        console.log(`✅ Valid: ${doc.file_name || doc.title}`);
      } catch (error) {
        orphanedDocuments.push(doc);
        console.log(`❌ Missing: ${doc.file_name || doc.title} (expected at: ${fileName})`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total documents: ${allDocuments.length}`);
    console.log(`   ✅ Valid files: ${validDocuments.length}`);
    console.log(`   ❌ Orphaned records: ${orphanedDocuments.length}`);
    console.log(`   ⚠️  Empty URLs: ${emptyFileUrls.length}`);
    console.log(`   🗑️  To delete: ${orphanedDocuments.length + emptyFileUrls.length}\n`);

    // Delete orphaned documents
    const toDelete = [...orphanedDocuments, ...emptyFileUrls];
    
    if (toDelete.length === 0) {
      console.log('✨ No orphaned documents found. Database is clean!');
      return;
    }

    console.log(`🗑️  Deleting ${toDelete.length} orphaned records...\n`);
    
    let deletedDocCount = 0;
    let deletedChunkCount = 0;
    
    for (const doc of toDelete) {
      // First, delete all doc_chunks associated with this document
      const chunksResult = await db
        .delete(doc_chunks)
        .where(eq(doc_chunks.document_id, doc.id));
      
      // Count how many chunks were actually deleted
      if (chunksResult.rowCount && chunksResult.rowCount > 0) {
        deletedChunkCount++;
      }
      
      // Now delete the document itself
      await db.delete(documents).where(eq(documents.id, doc.id));
      deletedDocCount++;
      
      if (deletedDocCount % 10 === 0) {
        console.log(`   Deleted ${deletedDocCount}/${toDelete.length} documents...`);
      }
    }
    
    console.log(`   ✓ Deleted ${deletedDocCount} documents`);
    if (deletedChunkCount > 0) {
      console.log(`   ✓ Also removed related doc_chunks for ${deletedChunkCount} documents`);
    }

    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`   🗑️  Deleted: ${deletedDocCount} orphaned records`);
    console.log(`   ✅ Kept: ${validDocuments.length} valid documents`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Upload the missing documents through the Developer Portal`);
    console.log(`   2. Documents will be properly stored with unique identifiers`);
    console.log(`   3. Downloads will work correctly for all uploaded documents`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupOrphanedDocuments()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
