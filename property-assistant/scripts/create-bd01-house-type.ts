import { db } from '../packages/db';
import { tenants, developments, houseTypes } from '../packages/db/schema';
import { eq, and } from 'drizzle-orm';

async function createBD01HouseType() {
  console.log('\n' + '='.repeat(80));
  console.log('CREATE BD01 HOUSE TYPE');
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

    console.log(`✅ Tenant: ${tenant[0].name}\n`);

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

    console.log(`✅ Development: ${development[0].name}\n`);

    const existing = await db
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

    if (existing.length > 0) {
      console.log(`⚠️  BD01 house type already exists (ID: ${existing[0].id})`);
      console.log(`   Name: ${existing[0].name || 'N/A'}`);
      console.log(`   Description: ${existing[0].description || 'N/A'}\n`);
      return;
    }

    console.log('Creating BD01 house type...\n');

    const result = await db
      .insert(houseTypes)
      .values({
        tenant_id: tenant[0].id,
        development_id: development[0].id,
        house_type_code: 'BD01',
        name: 'House Type BD01',
        description: '3-bedroom detached house with ground and first floor',
        total_floor_area_sqm: null,
        room_dimensions: {},
      })
      .returning({ id: houseTypes.id });

    console.log(`✅ BD01 house type created successfully!`);
    console.log(`   ID: ${result[0].id}`);
    console.log(`   Code: BD01`);
    console.log(`   Name: House Type BD01\n`);

    console.log('Next steps:');
    console.log('  1. Reprocess BD01 floorplan documents to extract dimensions');
    console.log('  2. Run: npx tsx scripts/inspect-room-dimensions.ts to verify\n');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }

  console.log('='.repeat(80) + '\n');
}

createBD01HouseType()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
