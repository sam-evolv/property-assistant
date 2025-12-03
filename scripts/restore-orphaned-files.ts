/**
 * Restore database records for files that exist on disk but lost their DB records
 * 
 * Usage: npx tsx scripts/restore-orphaned-files.ts
 */

import { db } from '../packages/db/client';
import { documents } from '../packages/db/schema';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { eq } from 'drizzle-orm';

async function restoreOrphanedFiles() {
  console.log('🔄 Starting file restoration...\n');

  try {
    const uploadsDir = join(process.cwd(), 'apps/unified-portal/public/uploads');
    
    // Get all files on disk
    const filesOnDisk = await readdir(uploadsDir);
    console.log(`📁 Found ${filesOnDisk.length} files on disk\n`);

    // Get all documents in database
    const docsInDb = await db.select().from(documents);
    console.log(`💾 Found ${docsInDb.length} documents in database\n`);

    // Create a set of file_urls from database for quick lookup
    const dbFileUrls = new Set(docsInDb.map(doc => {
      if (doc.file_url.startsWith('/uploads/')) {
        return doc.file_url.substring('/uploads/'.length);
      }
      return doc.file_url;
    }));

    // Find files that don't have database records
    const orphanedFiles = filesOnDisk.filter(file => !dbFileUrls.has(file));
    
    console.log(`🔍 Found ${orphanedFiles.length} files without database records:\n`);
    orphanedFiles.forEach(file => console.log(`   - ${file}`));

    if (orphanedFiles.length === 0) {
      console.log('\n✨ No orphaned files found. All files have database records!');
      return;
    }

    console.log('\n📝 Creating database records for orphaned files...\n');

    // Get the development ID and tenant ID from existing documents
    const existingDoc = docsInDb[0];
    if (!existingDoc) {
      console.error('❌ No existing documents found to copy tenant/development info from');
      return;
    }

    const tenantId = existingDoc.tenant_id;
    const developmentId = existingDoc.development_id;

    console.log(`   Using tenant_id: ${tenantId}`);
    console.log(`   Using development_id: ${developmentId}\n`);

    let restoredCount = 0;

    for (const fileName of orphanedFiles) {
      // Extract clean filename (remove nanoid prefix)
      const cleanName = fileName.replace(/^[a-zA-Z0-9_-]+-/, '');
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      
      // Determine mime type
      let mimeType = 'application/octet-stream';
      if (extension === 'pdf') mimeType = 'application/pdf';
      else if (extension === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (extension === 'doc') mimeType = 'application/msword';
      else if (extension === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // Create database record
      await db.insert(documents).values({
        tenant_id: tenantId,
        development_id: developmentId,
        document_type: 'property_manual',
        title: cleanName.replace(/\.[^/.]+$/, ''), // Remove extension
        file_name: fileName,
        original_file_name: cleanName,
        relative_path: '',
        file_url: `/uploads/${fileName}`,
        mime_type: mimeType,
        size_kb: 0, // Will be updated when file is accessed
        status: 'completed',
        version: 1,
        is_important: false,
      });

      restoredCount++;
      console.log(`✅ Restored: ${fileName}`);
    }

    console.log(`\n✅ Successfully restored ${restoredCount} database records!`);
    console.log(`\n📊 Summary:`);
    console.log(`   Total files on disk: ${filesOnDisk.length}`);
    console.log(`   Documents in database: ${docsInDb.length + restoredCount}`);
    console.log(`   Restored records: ${restoredCount}`);

  } catch (error) {
    console.error('❌ Error during restoration:', error);
    throw error;
  }
}

// Run the restoration
restoreOrphanedFiles()
  .then(() => {
    console.log('\n✨ Restoration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Restoration failed:', error);
    process.exit(1);
  });
