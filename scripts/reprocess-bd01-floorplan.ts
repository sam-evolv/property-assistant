import { db } from '../packages/db';
import { documents } from '../packages/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { extractRoomDimensionsFromFloorplan } from '../packages/api/src/train/floorplan-vision';
import * as fs from 'fs';
import * as path from 'path';

async function reprocessBD01Floorplan() {
  console.log('\n' + '='.repeat(80));
  console.log('REPROCESS BD01 FLOORPLAN FOR DIMENSION EXTRACTION');
  console.log('='.repeat(80) + '\n');

  try {
    console.log('Finding BD01 floorplan document...\n');

    const floorplanDoc = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.house_type_code, 'BD01'),
          sql`LOWER(file_name) LIKE '%floor%plan%'`
        )
      )
      .limit(1);

    if (!floorplanDoc.length) {
      console.log('❌ No BD01 floorplan document found');
      return;
    }

    const doc = floorplanDoc[0];
    console.log(`✅ Found document: ${doc.file_name}`);
    console.log(`   ID: ${doc.id}`);
    console.log(`   House Type ID: ${doc.house_type_id || 'NULL'}`);
    console.log(`   House Type Code: ${doc.house_type_code || 'NULL'}\n`);

    if (!doc.house_type_id) {
      console.log('❌ Document has no house_type_id. Run link-bd01-documents.ts first.');
      return;
    }

    const filePath = doc.file_url || doc.relative_path;
    
    if (!filePath) {
      console.log('❌ No file path found for document');
      return;
    }

    console.log(`📁 File path: ${filePath}\n`);

    let buffer: Buffer;
    
    const possiblePaths = [
      filePath,
      path.join(process.cwd(), filePath),
      path.join(process.cwd(), 'uploads', path.basename(filePath)),
      path.join(process.cwd(), 'attached_assets', path.basename(filePath)),
    ];

    let foundPath: string | null = null;
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        foundPath = tryPath;
        break;
      }
    }

    if (!foundPath) {
      console.log(`⚠️  File not found on disk. Tried:\n${possiblePaths.map(p => `   - ${p}`).join('\n')}\n`);
      console.log('NOTE: This is expected if files are stored elsewhere or if this is a test document.');
      console.log('For testing, you can manually upload a BD01 floorplan PDF through the UI.');
      console.log('The Vision extraction will run automatically when you upload a document with:');
      console.log('  - Filename containing "BD01" and "floor" and "plan"');
      console.log('  - Linked to the BD01 house type\n');
      return;
    }

    console.log(`✅ Found file at: ${foundPath}\n`);
    buffer = fs.readFileSync(foundPath);
    console.log(`📊 File size: ${(buffer.length / 1024).toFixed(2)} KB\n`);

    console.log('🚀 Starting Vision extraction...\n');

    const result = await extractRoomDimensionsFromFloorplan({
      tenant_id: doc.tenant_id,
      development_id: doc.development_id,
      house_type_id: doc.house_type_id!,
      unit_type_code: doc.house_type_code || 'BD01',
      document_id: doc.id,
      buffer,
      fileName: doc.file_name || 'BD01-floorplan.pdf',
    });

    console.log('\n' + '='.repeat(80));
    if (result.success) {
      console.log('✅ VISION EXTRACTION COMPLETED SUCCESSFULLY');
      console.log(`   Rooms extracted: ${result.roomsExtracted}`);
      console.log('\nNext steps:');
      console.log('  1. Run: npx tsx scripts/inspect-room-dimensions.ts');
      console.log('  2. Test dimension questions in the purchaser chat');
    } else {
      console.log('❌ VISION EXTRACTION FAILED');
      console.log(`   Error: ${result.error || 'Unknown error'}`);
    }
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

reprocessBD01Floorplan()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
