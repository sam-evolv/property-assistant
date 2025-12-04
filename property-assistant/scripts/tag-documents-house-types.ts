import { db } from '../packages/db/client';
import { documents } from '../packages/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

async function tagDocumentsWithHouseTypes() {
  console.log('='.repeat(80));
  console.log('🏷️  TAGGING DOCUMENTS WITH HOUSE TYPE CODES');
  console.log('='.repeat(80));

  // Get Longview Park development ID
  const developmentId = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
  
  // Get all documents for Longview Park without house_type_code
  const docsWithoutHouseType = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.development_id, developmentId),
        isNull(documents.house_type_code)
      )
    );

  console.log(`Found ${docsWithoutHouseType.length} documents without house_type_code\n`);

  // House type patterns to match in filenames
  const houseTypePatterns = [
    { code: 'BD01', pattern: /BD01/i },
    { code: 'BD02', pattern: /BD02/i },
    { code: 'BD03', pattern: /BD03/i },
    { code: 'BD04', pattern: /BD04/i },
    { code: 'BD05', pattern: /BD05/i },
    { code: 'BD17', pattern: /BD17/i },
    { code: 'BS01', pattern: /BS01/i },
    { code: 'BS02', pattern: /BS02/i },
    { code: 'BS03', pattern: /BS03/i },
    { code: 'BS04', pattern: /BS04/i },
    { code: 'BT01', pattern: /BT01/i },
    { code: 'BZ01', pattern: /BZ01/i },
  ];

  let tagged = 0;
  let skipped = 0;

  for (const doc of docsWithoutHouseType) {
    const filename = doc.title || doc.file_name || '';
    let matchedType: string | null = null;

    // Try to match house type from filename
    for (const { code, pattern } of houseTypePatterns) {
      if (pattern.test(filename)) {
        matchedType = code;
        break;
      }
    }

    if (matchedType) {
      await db
        .update(documents)
        .set({ house_type_code: matchedType })
        .where(eq(documents.id, doc.id));
      
      tagged++;
      console.log(`✓ Tagged: ${filename.substring(0, 80)}... → ${matchedType}`);
    } else {
      skipped++;
      console.log(`○ Skipped (no house type in name): ${filename.substring(0, 60)}...`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('TAGGING COMPLETE');
  console.log('='.repeat(80));
  console.log(`Tagged: ${tagged}`);
  console.log(`Skipped (no house type): ${skipped}`);
  console.log('='.repeat(80));
}

tagDocumentsWithHouseTypes()
  .then(() => {
    console.log('\n✅ Tagging successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Tagging failed:', error);
    process.exit(1);
  });
