import { db } from '../packages/db';
import { tenants, developments, houseTypes, documents } from '../packages/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function linkBD01Documents() {
  console.log('\n' + '='.repeat(80));
  console.log('LINK BD01 DOCUMENTS TO HOUSE TYPE');
  console.log('='.repeat(80) + '\n');

  try {
    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, 'openhouse-ai'))
      .limit(1);

    if (!tenant.length) {
      console.log('❌ Tenant not found');
      return;
    }

    const development = await db
      .select()
      .from(developments)
      .where(
        and(
          eq(developments.tenant_id, tenant[0].id),
          eq(developments.name, 'Longview Park')
        )
      )
      .limit(1);

    if (!development.length) {
      console.log('❌ Development not found');
      return;
    }

    const houseType = await db
      .select()
      .from(houseTypes)
      .where(
        and(
          eq(houseTypes.tenant_id, tenant[0].id),
          eq(houseTypes.development_id, development[0].id),
          eq(houseTypes.house_type_code, 'BD01')
        )
      )
      .limit(1);

    if (!houseType.length) {
      console.log('❌ BD01 house type not found. Run create-bd01-house-type.ts first.');
      return;
    }

    console.log(`✅ House Type: ${houseType[0].name} (ID: ${houseType[0].id})\n`);

    console.log('Finding BD01 documents with NULL house_type_id...\n');

    const bd01Docs = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenant_id, tenant[0].id),
          eq(documents.development_id, development[0].id),
          eq(documents.house_type_code, 'BD01'),
          isNull(documents.house_type_id)
        )
      );

    if (bd01Docs.length === 0) {
      console.log('⚠️  No BD01 documents found with NULL house_type_id\n');
      console.log('Checking all BD01 documents...\n');
      
      const allBD01 = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.tenant_id, tenant[0].id),
            eq(documents.development_id, development[0].id),
            eq(documents.house_type_code, 'BD01')
          )
        );
      
      console.log(`Found ${allBD01.length} BD01 document(s):`);
      allBD01.forEach(doc => {
        const linked = doc.house_type_id ? '✅ Linked' : '❌ Not linked';
        console.log(`  ${linked} - ${doc.file_name}`);
      });
      return;
    }

    console.log(`Found ${bd01Docs.length} document(s) to link:\n`);
    bd01Docs.forEach(doc => {
      console.log(`  📄 ${doc.file_name}`);
    });

    console.log(`\nUpdating documents to link to house_type_id: ${houseType[0].id}...\n`);

    const result = await db
      .update(documents)
      .set({ house_type_id: houseType[0].id })
      .where(
        and(
          eq(documents.tenant_id, tenant[0].id),
          eq(documents.development_id, development[0].id),
          eq(documents.house_type_code, 'BD01'),
          isNull(documents.house_type_id)
        )
      );

    console.log(`✅ Updated ${bd01Docs.length} BD01 document(s) successfully!\n`);

    console.log('Next steps:');
    console.log('  1. Reprocess the BD01 floorplan documents to extract dimensions');
    console.log('  2. Use the developer portal reprocess feature OR');
    console.log('  3. Run a reprocess script for these document IDs\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }

  console.log('='.repeat(80) + '\n');
}

linkBD01Documents()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
