import { db } from '../packages/db';
import { tenants, developments, houseTypes, documents } from '../packages/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { extractRoomDimensionsFromFloorplan, isLikelyFloorplan } from '../packages/api/src/train/floorplan-vision';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  tenantSlug?: string;
  developmentSlug?: string;
}

function parseCLIArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tenantSlug' && args[i + 1]) {
      options.tenantSlug = args[i + 1];
      i++;
    } else if (args[i] === '--developmentSlug' && args[i + 1]) {
      options.developmentSlug = args[i + 1];
      i++;
    }
  }
  
  return options;
}

interface ProcessingResult {
  houseTypeCode: string;
  houseTypeName: string;
  processed: number;
  failed: number;
  skipped: number;
  details: Array<{
    fileName: string;
    success: boolean;
    roomsExtracted?: number;
    error?: string;
  }>;
}

async function findFloorplanFile(doc: any): Promise<Buffer | null> {
  const possiblePaths = [
    doc.file_url,
    doc.relative_path,
    path.join(process.cwd(), doc.file_url || ''),
    path.join(process.cwd(), doc.relative_path || ''),
    path.join(process.cwd(), 'uploads', path.basename(doc.file_url || doc.relative_path || '')),
    path.join(process.cwd(), 'attached_assets', path.basename(doc.file_url || doc.relative_path || '')),
  ].filter(Boolean);

  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      return fs.readFileSync(tryPath);
    }
  }

  return null;
}

async function reprocessAllFloorplans() {
  const options = parseCLIArgs();
  
  console.log('\n' + '='.repeat(80));
  console.log('BATCH FLOORPLAN REPROCESSING');
  console.log('='.repeat(80));
  
  if (options.developmentSlug) {
    console.log(`🔍 Filter: Development Slug = ${options.developmentSlug}`);
  }
  if (options.tenantSlug) {
    console.log(`🔍 Filter: Tenant Slug = ${options.tenantSlug}`);
  }
  console.log('');

  try {
    // Get tenant
    const tenantSlug = options.tenantSlug || 'openhouse-ai';
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant.length) {
      console.log(`❌ Tenant "${tenantSlug}" not found`);
      console.log('\n📋 Available tenants:');
      const allTenants = await db.select().from(tenants);
      allTenants.forEach(t => {
        console.log(`   - ${t.slug}: ${t.name}`);
      });
      return;
    }

    console.log(`✅ Tenant: ${tenant[0].name} (${tenant[0].slug})`);
    console.log(`   ID: ${tenant[0].id}\n`);

    // Get development(s)
    let developmentFilter = eq(developments.tenant_id, tenant[0].id);
    if (options.developmentSlug) {
      developmentFilter = and(
        developmentFilter,
        eq(developments.slug, options.developmentSlug)
      )!;
    }

    const devs = await db
      .select()
      .from(developments)
      .where(developmentFilter);

    if (!devs.length) {
      console.log(`❌ No developments found`);
      if (options.developmentSlug) {
        console.log(`   (searched for slug: ${options.developmentSlug})`);
      }
      return;
    }

    console.log(`✅ Found ${devs.length} development(s) to process\n`);

    const allResults: ProcessingResult[] = [];

    // Process each development
    for (const dev of devs) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📍 DEVELOPMENT: ${dev.name}`);
      console.log(`   Slug: ${dev.slug || 'none'}`);
      console.log(`   ID: ${dev.id}`);
      console.log(`${'='.repeat(80)}\n`);

      // Get all house types for this development
      const types = await db
        .select()
        .from(houseTypes)
        .where(
          and(
            eq(houseTypes.tenant_id, tenant[0].id),
            eq(houseTypes.development_id, dev.id)
          )
        );

      if (!types.length) {
        console.log('⚠️  No house types found for this development\n');
        continue;
      }

      console.log(`Found ${types.length} house type(s) to check for floorplans:\n`);

      // Process each house type
      for (const type of types) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`🏠 HOUSE TYPE: ${type.house_type_code} - ${type.name || '(unnamed)'}`);
        console.log(`   ID: ${type.id}`);
        console.log(`${'─'.repeat(80)}\n`);

        const result: ProcessingResult = {
          houseTypeCode: type.house_type_code || 'unknown',
          houseTypeName: type.name || '(unnamed)',
          processed: 0,
          failed: 0,
          skipped: 0,
          details: [],
        };

        // Find all documents for this house type
        const docs = await db
          .select()
          .from(documents)
          .where(
            and(
              eq(documents.tenant_id, tenant[0].id),
              eq(documents.development_id, dev.id),
              eq(documents.house_type_id, type.id)
            )
          );

        if (!docs.length) {
          console.log('   ⚠️  No documents found for this house type\n');
          result.skipped = 1;
          result.details.push({
            fileName: 'N/A',
            success: false,
            error: 'No documents found for house type',
          });
          allResults.push(result);
          continue;
        }

        console.log(`   Found ${docs.length} document(s), checking for floorplans...\n`);

        // Filter for floorplans
        const floorplans = docs.filter(doc => 
          isLikelyFloorplan(doc.file_name || '', doc.document_type || '')
        );

        if (!floorplans.length) {
          console.log('   ⚠️  No floorplan documents detected\n');
          console.log('   💡 Documents found:');
          docs.forEach(d => {
            console.log(`      • ${d.file_name} (type: ${d.document_type || 'unknown'})`);
          });
          console.log('');
          result.skipped = 1;
          result.details.push({
            fileName: 'N/A',
            success: false,
            error: 'No floorplan documents detected',
          });
          allResults.push(result);
          continue;
        }

        console.log(`   ✅ Found ${floorplans.length} floorplan(s) to process:\n`);
        floorplans.forEach(fp => {
          console.log(`      📄 ${fp.file_name}`);
        });
        console.log('');

        // Process each floorplan
        for (const floorplan of floorplans) {
          console.log(`   Processing: ${floorplan.file_name}...`);

          try {
            // Find file
            const buffer = await findFloorplanFile(floorplan);
            
            if (!buffer) {
              console.log(`   ⚠️  File not found on disk, skipping\n`);
              result.skipped++;
              result.details.push({
                fileName: floorplan.file_name || 'unknown',
                success: false,
                error: 'File not found on disk',
              });
              continue;
            }

            console.log(`   ✅ File loaded (${(buffer.length / 1024).toFixed(2)} KB)`);
            console.log(`   🚀 Starting Vision extraction...`);

            // Run Vision extraction
            const extractionResult = await extractRoomDimensionsFromFloorplan({
              tenant_id: tenant[0].id,
              development_id: dev.id,
              house_type_id: type.id,
              unit_type_code: type.house_type_code || 'unknown',
              document_id: floorplan.id,
              buffer,
              fileName: floorplan.file_name || 'unknown.pdf',
            });

            if (extractionResult.success) {
              console.log(`   ✅ SUCCESS: Extracted ${extractionResult.roomsExtracted} room(s)\n`);
              result.processed++;
              result.details.push({
                fileName: floorplan.file_name || 'unknown',
                success: true,
                roomsExtracted: extractionResult.roomsExtracted,
              });
            } else {
              console.log(`   ❌ FAILED: ${extractionResult.error}\n`);
              result.failed++;
              result.details.push({
                fileName: floorplan.file_name || 'unknown',
                success: false,
                error: extractionResult.error,
              });
            }
          } catch (error) {
            console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
            result.failed++;
            result.details.push({
              fileName: floorplan.file_name || 'unknown',
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        allResults.push(result);
      }
    }

    // Print summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('BATCH PROCESSING SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    let totalProcessed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    allResults.forEach(result => {
      console.log(`🏠 ${result.houseTypeCode} - ${result.houseTypeName}`);
      console.log(`   ✅ Processed: ${result.processed}`);
      console.log(`   ❌ Failed: ${result.failed}`);
      console.log(`   ⏭️  Skipped: ${result.skipped}\n`);
      
      totalProcessed += result.processed;
      totalFailed += result.failed;
      totalSkipped += result.skipped;
    });

    console.log(`${'─'.repeat(80)}`);
    console.log(`📊 TOTALS:`);
    console.log(`   ✅ Processed: ${totalProcessed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`${'='.repeat(80)}\n`);

    if (totalProcessed > 0) {
      console.log('✅ Next steps:');
      console.log('   1. Run: npx tsx scripts/inspect-room-dimensions.ts');
      console.log('   2. Test dimension questions in purchaser chat\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

console.log(`\n📖 Usage: npx tsx scripts/reprocess-all-floorplans.ts [options]`);
console.log(`   --tenantSlug <slug>        Tenant to process (default: openhouse-ai)`);
console.log(`   --developmentSlug <slug>   Development to process (default: all)\n`);

reprocessAllFloorplans()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
