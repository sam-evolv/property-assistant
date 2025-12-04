import { db } from '../packages/db';
import { tenants, developments, houseTypes, unit_room_dimensions } from '../packages/db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface CLIOptions {
  tenantSlug?: string;
  developmentSlug?: string;
  houseTypeCode?: string;
  all?: boolean;
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
    } else if (args[i] === '--houseTypeCode' && args[i + 1]) {
      options.houseTypeCode = args[i + 1];
      i++;
    } else if (args[i] === '--all') {
      options.all = true;
    }
  }
  
  return options;
}

async function inspectRoomDimensions() {
  const options = parseCLIArgs();
  
  console.log('\n' + '='.repeat(80));
  console.log('ROOM DIMENSIONS DIAGNOSTIC');
  console.log('='.repeat(80));
  
  if (options.houseTypeCode) {
    console.log(`🔍 Filter: House Type Code = ${options.houseTypeCode}`);
  }
  if (options.developmentSlug) {
    console.log(`🔍 Filter: Development Slug = ${options.developmentSlug}`);
  }
  if (options.tenantSlug) {
    console.log(`🔍 Filter: Tenant Slug = ${options.tenantSlug}`);
  }
  if (options.all) {
    console.log(`📊 Mode: Show all house types`);
  }
  console.log('');

  try {
    // Get tenant
    let tenantSlug = options.tenantSlug || 'openhouse-ai';
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

    console.log(`✅ Tenant: ${tenant[0].name} (slug: ${tenant[0].slug})\n`);

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

    console.log(`✅ Found ${devs.length} development(s):\n`);
    devs.forEach(d => {
      console.log(`   - ${d.name} (slug: ${d.slug || 'none'})`);
    });
    console.log('');

    // For each development, get house types and dimensions
    for (const dev of devs) {
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📍 DEVELOPMENT: ${dev.name}`);
      console.log(`${'─'.repeat(80)}\n`);

      // Get house types
      let houseTypeFilter = and(
        eq(houseTypes.tenant_id, tenant[0].id),
        eq(houseTypes.development_id, dev.id)
      );

      if (options.houseTypeCode) {
        houseTypeFilter = and(
          houseTypeFilter,
          eq(houseTypes.house_type_code, options.houseTypeCode)
        )!;
      }

      const types = await db
        .select()
        .from(houseTypes)
        .where(houseTypeFilter!);

      if (!types.length) {
        console.log('⚠️  No house types found for this development\n');
        continue;
      }

      console.log(`Found ${types.length} house type(s):\n`);

      // For each house type, get dimensions
      for (const type of types) {
        const dimensions = await db
          .select()
          .from(unit_room_dimensions)
          .where(
            and(
              eq(unit_room_dimensions.tenant_id, tenant[0].id),
              eq(unit_room_dimensions.development_id, dev.id),
              eq(unit_room_dimensions.house_type_id, type.id)
            )
          )
          .orderBy(unit_room_dimensions.level, unit_room_dimensions.room_name);

        console.log(`\n🏠 ${type.house_type_code} - ${type.name || '(unnamed)'}`);
        console.log(`   ID: ${type.id}`);

        if (dimensions.length === 0) {
          console.log(`   ⚠️  NO dimension data found`);
          console.log(`   💡 This means:`);
          console.log(`      • No floorplans have been processed for this house type`);
          console.log(`      • Vision extraction has not run yet`);
          console.log(`      • No manual dimension entries exist\n`);
          continue;
        }

        console.log(`   ✅ Found ${dimensions.length} room dimension(s):\n`);

        // Display table
        console.log('   ┌─────────────────┬──────────────────────┬─────────┬──────────┬─────────┬───────────────────┬────────────┐');
        console.log('   │ Level           │ Room Name            │ Area m² │ Length m │ Width m │ Source            │ Confidence │');
        console.log('   ├─────────────────┼──────────────────────┼─────────┼──────────┼─────────┼───────────────────┼────────────┤');

        dimensions.forEach(dim => {
          const level = (dim.level || 'N/A').padEnd(15);
          const roomName = (dim.room_name || 'N/A').padEnd(20);
          const area = (dim.area_m2?.toFixed(1) || 'N/A').padStart(7);
          const length = (dim.length_m?.toFixed(2) || 'N/A').padStart(8);
          const width = (dim.width_m?.toFixed(2) || 'N/A').padStart(7);
          const source = (dim.source || 'N/A').padEnd(17);
          const confidence = (dim.confidence?.toFixed(2) || 'N/A').padStart(10);

          console.log(`   │ ${level} │ ${roomName} │ ${area} │ ${length} │ ${width} │ ${source} │ ${confidence} │`);
        });

        console.log('   └─────────────────┴──────────────────────┴─────────┴──────────┴─────────┴───────────────────┴────────────┘\n');

        const visionCount = dimensions.filter(d => d.source === 'vision_floorplan').length;
        if (visionCount > 0) {
          console.log(`   ✅ Vision-extracted dimensions: ${visionCount}`);
        }
        const manualCount = dimensions.filter(d => d.source !== 'vision_floorplan').length;
        if (manualCount > 0) {
          console.log(`   📝 Manual/other dimensions: ${manualCount}`);
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }

  console.log('\n' + '='.repeat(80));
  console.log('');
}

console.log(`\n📖 Usage: npx tsx scripts/inspect-room-dimensions.ts [options]`);
console.log(`   --tenantSlug <slug>        Filter by tenant (default: openhouse-ai)`);
console.log(`   --developmentSlug <slug>   Filter by development`);
console.log(`   --houseTypeCode <code>     Filter by house type code (e.g., BD01, BS02)`);
console.log(`   --all                      Show all house types (default behavior)\n`);

inspectRoomDimensions()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
