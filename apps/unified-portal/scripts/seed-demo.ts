import { db } from '@openhouse/db/client';
import { noticeboard_posts } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = 'a1000000-0000-0000-0000-000000000001';
const DEMO_DEVELOPMENT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_TYPE_ID = 'd0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_UID = 'OH-PARK-009';
const DEMO_DEVELOPMENT_CODE = 'OH-PARK';

const CORK_LAT = 51.8985;
const CORK_LNG = -8.4756;

const DEMO_NOTICEBOARD = [
  { 
    id: 'e0000000-0000-0000-0000-000000000001',
    title: 'Welcome to OpenHouse Park - Residents Intro Evening', 
    content: 'Welcome to the neighbourhood! We\'re hosting a residents\' intro evening this Friday at 7pm in the community room.\n\nCome along for tea and coffee to meet your new neighbours and the OpenHouse team. We\'ll be there to answer any questions about your new home.\n\nLooking forward to seeing you there!\n\n— The OpenHouse Team',
    priority: 3,
    author_name: 'OpenHouse Team'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000002',
    title: 'Bins and Recycling - Collection Schedule', 
    content: 'Bin collection days for OpenHouse Park:\n\n• General Waste (Black): Every Tuesday\n• Recycling (Green): Every second Tuesday\n• Organic (Brown): Every Tuesday\n\nPlease have bins out by 7:00 AM. Remember to bring bins in by evening.',
    priority: 2,
    author_name: 'Community Manager'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000003',
    title: 'Parking and Visitor Bays - Quick Reminder', 
    content: 'Each home has allocated parking spaces as shown on your site plan.\n\nVisitor parking is available near the main entrance. Please ensure vehicles do not obstruct shared access routes or emergency vehicle access.\n\nThank you for your cooperation!',
    priority: 1,
    author_name: 'Community Manager'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000004',
    title: 'Local Recommendations - Coffee, Gyms, Schools', 
    content: 'Welcome to the area! Here are some local favourites recommended by your neighbours:\n\n☕ Coffee: The Coffee Bean - 3 min walk\n🏋️ Gyms: FlyeFit Cork - 5 min drive\n🏫 Schools: Scoil Mhuire Primary - 8 min walk\n🛒 Shopping: Dunnes Stores Ballyvolane - 5 min drive\n🏥 Medical: Ballyvolane Medical Centre - 4 min walk\n\nFeel free to share your own recommendations on the noticeboard!',
    priority: 1,
    author_name: 'OpenHouse Team'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000005',
    title: 'Lost keys near the green?', 
    content: 'Hi all, I found a set of keys with a blue keyring near the green this evening. If they\'re yours, DM me and describe the keyring and I\'ll drop them over. [Aisling - Unit 14]',
    priority: 1,
    author_name: 'Aisling Murphy',
    author_unit: '14'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000006',
    title: 'Any recommendations for a local plumber?', 
    content: 'Quick one, has anyone used a good local plumber recently for small bits around the house? Looking for someone reliable. Cheers. [Conor - Unit 3]',
    priority: 1,
    author_name: 'Conor Walsh',
    author_unit: '3'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000007',
    title: 'Kids bikes and scooters - storage reminder', 
    content: 'Just a gentle reminder to keep bikes/scooters clear of the footpaths by the entrances. Keeps it safer for buggies and wheelchairs. Thanks all. [Niamh - Unit 22]',
    priority: 1,
    author_name: 'Niamh O\'Sullivan',
    author_unit: '22'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000008',
    title: 'Coffee morning this Saturday', 
    content: 'Anyone up for a casual coffee morning this Saturday at 11am? We\'ll meet by the green (weather permitting). Nice way to say hello and meet neighbours. [Dara - Unit 9]',
    priority: 1,
    author_name: 'Dara O\'Connell',
    author_unit: '9'
  },
  { 
    id: 'e0000000-0000-0000-0000-000000000009',
    title: 'Parcel taken in by mistake', 
    content: 'Hi folks, I think a parcel for Unit 9 may have been taken in by someone else today (Amazon). If you have it, no panic, just let me know and I\'ll collect. Thanks! [Keely - Unit 9]',
    priority: 1,
    author_name: 'Keely O\'Grady',
    author_unit: '9'
  },
  { 
    id: 'e0000000-0000-0000-0000-00000000000a',
    title: 'Dog walking group - weekday evenings?', 
    content: 'Would anyone be interested in a small dog walking group on weekday evenings around 7pm? Could be a handy way to meet people and get steps in. [Brian - Unit 6]',
    priority: 1,
    author_name: 'Brian Keane',
    author_unit: '6'
  },
];

const DEMO_DOCUMENTS = [
  {
    id: 'f0000000-0000-0000-0000-000000000001',
    title: 'Homeowner Welcome Pack - OpenHouse Park',
    category: 'welcome_pack',
    discipline: 'handover',
    is_important: true,
    must_read: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000002',
    title: 'Floor Plan - Type A3 Ground Floor',
    category: 'floorplans',
    discipline: 'architectural',
    is_important: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000003',
    title: 'Floor Plan - Type A3 First Floor',
    category: 'floorplans',
    discipline: 'architectural',
    is_important: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000004',
    title: 'Appliance Warranty Summary',
    category: 'warranties',
    discipline: 'handover',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000005',
    title: 'Heating System Quick Start Guide',
    category: 'heating',
    discipline: 'mechanical',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000006',
    title: 'Broadband and Utilities Setup',
    category: 'other',
    discipline: 'handover',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000007',
    title: 'Waste and Recycling Guidelines',
    category: 'waste_parking',
    discipline: 'handover',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000008',
    title: 'Fire Safety and Alarms Guide',
    category: 'fire_safety',
    discipline: 'handover',
    is_important: true,
    must_read: true,
  },
  {
    id: 'f0000000-0000-0000-0000-000000000009',
    title: 'Snagging and Defects Process',
    category: 'snagging',
    discipline: 'handover',
  },
  {
    id: 'f0000000-0000-0000-0000-000000000010',
    title: 'Resident Handbook - Community Guidelines',
    category: 'house_rules',
    discipline: 'handover',
  },
];

async function upsertRecord(table: string, id: string, idColumn: string, insertSql: string): Promise<boolean> {
  try {
    const checkResult = await db.execute(sql.raw(`SELECT 1 FROM ${table} WHERE ${idColumn} = '${id}' LIMIT 1`));
    if (checkResult.rows.length > 0) {
      console.log(`[Demo Seed] ${table} record already exists, skipping...`);
      return false;
    }
    await db.execute(sql.raw(insertSql));
    console.log(`[Demo Seed] Created ${table} record`);
    return true;
  } catch (e: any) {
    console.log(`[Demo Seed] ${table} upsert error: ${e.message}`);
    return false;
  }
}

async function seedDemoData() {
  console.log('[Demo Seed] Starting demo data seed...');
  console.log('[Demo Seed] Target: Supabase');
  
  await upsertRecord('tenants', DEMO_TENANT_ID, 'id', `
    INSERT INTO tenants (id, name, slug)
    VALUES ('${DEMO_TENANT_ID}', 'OpenHouse Demo Tenant', 'openhouse-demo')
  `);
  
  await upsertRecord('organisations', DEMO_ORG_ID, 'id', `
    INSERT INTO organisations (id, name)
    VALUES ('${DEMO_ORG_ID}', 'OpenHouse Demo Org')
  `);
  
  await upsertRecord('projects', DEMO_PROJECT_ID, 'id', `
    INSERT INTO projects (id, organization_id, name, address)
    VALUES ('${DEMO_PROJECT_ID}', '${DEMO_ORG_ID}', 'OpenHouse Park', 'OpenHouse Way, Cork, Ireland')
  `);
  
  await upsertRecord('developments', DEMO_DEVELOPMENT_ID, 'id', `
    INSERT INTO developments (id, tenant_id, code, name, slug, address, description, is_active, latitude, longitude, system_instructions)
    VALUES (
      '${DEMO_DEVELOPMENT_ID}',
      '${DEMO_TENANT_ID}',
      '${DEMO_DEVELOPMENT_CODE}',
      'OpenHouse Park',
      'openhouse-park',
      'OpenHouse Way, Cork, Ireland',
      'A stunning new development of premium family homes in Cork City',
      true,
      ${CORK_LAT},
      ${CORK_LNG},
      'You are a helpful assistant for OpenHouse Park, a premium residential development in Cork, Ireland. Help homeowners with questions about their new home.'
    )
  `);
  
  // Create unit_type for demo with bedrooms/bathrooms in specification_json
  console.log('[Demo Seed] Creating unit_type A3...');
  try {
    const typeCheck = await db.execute(sql.raw(`SELECT 1 FROM unit_types WHERE id = '${DEMO_UNIT_TYPE_ID}' LIMIT 1`));
    if (typeCheck.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO unit_types (id, project_id, name, specification_json)
        VALUES (
          ${DEMO_UNIT_TYPE_ID}::uuid,
          ${DEMO_PROJECT_ID}::uuid,
          'A3',
          ${JSON.stringify({ bedrooms: 3, bathrooms: 3, floor_area_sqm: 145, property_type: '3 Bed Semi-Detached' })}::jsonb
        )
      `);
      console.log('[Demo Seed] Created unit_type A3');
    } else {
      // Update existing unit_type
      await db.execute(sql`
        UPDATE unit_types 
        SET specification_json = ${JSON.stringify({ bedrooms: 3, bathrooms: 3, floor_area_sqm: 145, property_type: '3 Bed Semi-Detached' })}::jsonb
        WHERE id = ${DEMO_UNIT_TYPE_ID}::uuid
      `);
      console.log('[Demo Seed] Updated unit_type A3');
    }
  } catch (e: any) {
    console.log(`[Demo Seed] unit_type error: ${e.message}`);
  }
  
  // Create or update demo unit with correct bedrooms/bathrooms and unit_type_id
  console.log('[Demo Seed] Creating/updating demo unit...');
  const unitCheck = await db.execute(sql.raw(`SELECT 1 FROM units WHERE id = '${DEMO_UNIT_ID}' LIMIT 1`));
  if (unitCheck.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO units (
        id, project_id, tenant_id, development_id, development_code, unit_number, unit_code, unit_uid,
        address_line_1, address, city, country, eircode, house_type_code, bedrooms, bathrooms, 
        purchaser_name, unit_type_id, latitude, longitude
      )
      VALUES (
        ${DEMO_UNIT_ID}::uuid,
        ${DEMO_PROJECT_ID}::uuid,
        ${DEMO_TENANT_ID}::uuid,
        ${DEMO_DEVELOPMENT_ID}::uuid,
        ${DEMO_DEVELOPMENT_CODE},
        '9',
        '009',
        ${DEMO_UNIT_UID},
        '9 OpenHouse Way',
        '9 OpenHouse Way, Cork, Ireland',
        'Cork',
        'Ireland',
        'T12 AB12',
        'A3',
        3,
        3,
        'Keely O''Grady',
        ${DEMO_UNIT_TYPE_ID}::uuid,
        ${CORK_LAT},
        ${CORK_LNG}
      )
    `);
    console.log('[Demo Seed] Created demo unit');
  } else {
    // Update existing unit with correct bedrooms/bathrooms and unit_type_id
    await db.execute(sql`
      UPDATE units SET 
        bedrooms = 3,
        bathrooms = 3,
        unit_type_id = ${DEMO_UNIT_TYPE_ID}::uuid,
        house_type_code = 'A3',
        latitude = ${CORK_LAT},
        longitude = ${CORK_LNG}
      WHERE id = ${DEMO_UNIT_ID}::uuid
    `);
    console.log('[Demo Seed] Updated demo unit (3 beds, 3 baths)');
  }
  
  // Create scheme_profile for POI functionality
  console.log('[Demo Seed] Creating scheme_profile for POI...');
  try {
    const schemeCheck = await db.execute(sql.raw(`SELECT 1 FROM scheme_profile WHERE id = '${DEMO_PROJECT_ID}' LIMIT 1`));
    if (schemeCheck.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO scheme_profile (id, scheme_lat, scheme_lng, scheme_address)
        VALUES (
          ${DEMO_PROJECT_ID}::uuid,
          ${CORK_LAT},
          ${CORK_LNG},
          'OpenHouse Way, Cork, Ireland'
        )
      `);
      console.log('[Demo Seed] Created scheme_profile');
    } else {
      await db.execute(sql`
        UPDATE scheme_profile SET 
          scheme_lat = ${CORK_LAT},
          scheme_lng = ${CORK_LNG}
        WHERE id = ${DEMO_PROJECT_ID}::uuid
      `);
      console.log('[Demo Seed] Updated scheme_profile coordinates');
    }
  } catch (e: any) {
    console.log(`[Demo Seed] scheme_profile error: ${e.message}`);
  }
  
  // Seed noticeboard posts
  console.log('[Demo Seed] Creating noticeboard posts...');
  let noticeCount = 0;
  for (const notice of DEMO_NOTICEBOARD) {
    try {
      await db.insert(noticeboard_posts).values({
        id: notice.id,
        tenant_id: DEMO_TENANT_ID,
        development_id: DEMO_DEVELOPMENT_ID,
        unit_id: DEMO_UNIT_UID,
        title: notice.title,
        content: notice.content,
        priority: notice.priority,
        active: true,
        author_name: notice.author_name,
        author_unit: (notice as any).author_unit || '9 OpenHouse Way',
      }).onConflictDoNothing();
      noticeCount++;
      console.log(`[Demo Seed] Created noticeboard: "${notice.title.substring(0, 40)}..."`);
    } catch (e: any) {
      console.log(`[Demo Seed] Notice error: ${e.message}`);
    }
  }
  console.log(`[Demo Seed] Noticeboard posts: ${noticeCount}/${DEMO_NOTICEBOARD.length}`);
  
  // Seed documents into document_sections
  console.log('[Demo Seed] Creating document_sections...');
  let docCount = 0;
  for (const doc of DEMO_DOCUMENTS) {
    try {
      const docCheck = await db.execute(sql.raw(`SELECT 1 FROM document_sections WHERE id = '${doc.id}' LIMIT 1`));
      if (docCheck.rows.length === 0) {
        await db.execute(sql`
          INSERT INTO document_sections (id, project_id, content, metadata)
          VALUES (
            ${doc.id}::uuid,
            ${DEMO_PROJECT_ID}::uuid,
            ${'Demo document content for ' + doc.title},
            ${JSON.stringify({
              source: doc.title + '.pdf',
              file_name: doc.title + '.pdf',
              file_url: `https://openhouse.ie/demo-docs/${doc.id}.pdf`,
              discipline: doc.discipline,
              category: doc.category,
              is_important: doc.is_important || false,
              must_read: doc.must_read || false,
              created_at: new Date().toISOString(),
            })}::jsonb
          )
        `);
        docCount++;
        console.log(`[Demo Seed] Created doc: "${doc.title.substring(0, 40)}..."`);
      }
    } catch (e: any) {
      console.log(`[Demo Seed] Document error: ${e.message}`);
    }
  }
  console.log(`[Demo Seed] Documents created: ${docCount}/${DEMO_DOCUMENTS.length}`);
  
  // Seed video
  console.log('[Demo Seed] Creating demo video...');
  try {
    const videoCheck = await db.execute(sql.raw(`SELECT 1 FROM video_resources WHERE tenant_id = '${DEMO_TENANT_ID}' LIMIT 1`));
    if (videoCheck.rows.length === 0) {
      await db.execute(sql`
        INSERT INTO video_resources (tenant_id, development_id, title, description, provider, video_url, video_id, embed_url, thumbnail_url, is_active, sort_order)
        VALUES (
          ${DEMO_TENANT_ID}::uuid,
          ${DEMO_DEVELOPMENT_ID}::uuid,
          'Welcome to OpenHouse Park',
          'A brief introduction to your new home and community',
          'youtube',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'dQw4w9WgXcQ',
          'https://www.youtube.com/embed/dQw4w9WgXcQ',
          'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
          true,
          1
        )
      `);
      console.log('[Demo Seed] Created video record');
    }
  } catch (e: any) {
    console.log(`[Demo Seed] Video error: ${e.message}`);
  }
  
  // Print summary
  console.log('\n========================================');
  console.log('[Demo Seed] SEED SUMMARY');
  console.log('========================================');
  console.log(`Access Code: ${DEMO_UNIT_UID}`);
  console.log(`Coordinates: ${CORK_LAT}, ${CORK_LNG} (Cork City)`);
  console.log(`Bedrooms: 3, Bathrooms: 3`);
  console.log(`Noticeboard Posts: ${noticeCount}`);
  console.log(`Documents: ${docCount}`);
  console.log('========================================\n');
  
  console.log('[Demo Seed] Demo data seeded successfully!');
  
  return { success: true, message: 'Demo data seeded successfully', accessCode: DEMO_UNIT_UID };
}

async function removeDemoData() {
  console.log('[Demo Seed] Removing demo data...');
  
  // Remove noticeboard posts using Drizzle ORM
  try {
    await db.delete(noticeboard_posts).where(eq(noticeboard_posts.tenant_id, DEMO_TENANT_ID));
    console.log('[Demo Seed] Cleaned noticeboard_posts');
  } catch (e: any) {
    console.warn(`[Demo Seed] Failed to clean noticeboard_posts: ${e.message}`);
  }
  
  const deletes = [
    { table: 'document_sections', where: `project_id = '${DEMO_PROJECT_ID}'` },
    { table: 'video_resources', where: `tenant_id = '${DEMO_TENANT_ID}'` },
    { table: 'scheme_profile', where: `id = '${DEMO_PROJECT_ID}'` },
    { table: 'units', where: `id = '${DEMO_UNIT_ID}'` },
    { table: 'unit_types', where: `id = '${DEMO_UNIT_TYPE_ID}'` },
    { table: 'developments', where: `id = '${DEMO_DEVELOPMENT_ID}'` },
    { table: 'projects', where: `id = '${DEMO_PROJECT_ID}'` },
    { table: 'organisations', where: `id = '${DEMO_ORG_ID}'` },
    { table: 'tenants', where: `id = '${DEMO_TENANT_ID}'` },
  ];
  
  let errors: string[] = [];
  for (const { table, where } of deletes) {
    try {
      await db.execute(sql.raw(`DELETE FROM ${table} WHERE ${where}`));
      console.log(`[Demo Seed] Cleaned ${table}`);
    } catch (e: any) {
      const errMsg = `Failed to clean ${table}: ${e.message}`;
      console.warn(`[Demo Seed] ${errMsg}`);
      errors.push(errMsg);
    }
  }
  
  if (errors.length > 0) {
    console.warn('[Demo Seed] Some cleanup operations failed - manual cleanup may be needed');
  }
  
  console.log('[Demo Seed] Demo data removal completed');
  return { success: errors.length === 0, message: 'Demo data removed', errors };
}

const action = process.argv[2] || 'seed';

if (action === 'remove') {
  removeDemoData()
    .then((result) => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Demo Seed] Error:', err);
      process.exit(1);
    });
} else {
  seedDemoData()
    .then((result) => {
      console.log(result);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Demo Seed] Error:', err);
      process.exit(1);
    });
}

export { seedDemoData, removeDemoData, DEMO_TENANT_ID, DEMO_UNIT_UID };
