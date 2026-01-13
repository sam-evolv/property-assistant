import { db } from '@openhouse/db/client';
import { noticeboard_posts } from '@openhouse/db/schema';
import { sql, eq } from 'drizzle-orm';

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = 'a1000000-0000-0000-0000-000000000001';
const DEMO_DEVELOPMENT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_UID = 'OH-PARK-009';
const DEMO_DEVELOPMENT_CODE = 'OH-PARK';

const DEMO_NOTICEBOARD = [
  { 
    id: 'n0000000-0000-0000-0000-000000000001',
    title: 'Welcome to OpenHouse Park - Residents Intro Evening', 
    content: 'Welcome to the neighbourhood! We\'re hosting a residents\' intro evening this Friday at 7pm in the community room.\n\nCome along for tea and coffee to meet your new neighbours and the OpenHouse team. We\'ll be there to answer any questions about your new home.\n\nLooking forward to seeing you there!\n\n— The OpenHouse Team',
    priority: 3,
    author_name: 'OpenHouse Team'
  },
  { 
    id: 'n0000000-0000-0000-0000-000000000002',
    title: 'Waste Collection Schedule', 
    content: 'Bin collection days for OpenHouse Park:\n\n• General Waste (Black): Every Tuesday\n• Recycling (Green): Every second Tuesday\n• Organic (Brown): Every Tuesday\n\nPlease have bins out by 7:00 AM. Remember to bring bins in by evening.',
    priority: 2,
    author_name: 'Community Manager'
  },
  { 
    id: 'n0000000-0000-0000-0000-000000000003',
    title: 'Parking and Visitor Bays - Quick Reminder', 
    content: 'Each home has allocated parking spaces as shown on your site plan.\n\nVisitor parking is available near the main entrance. Please ensure vehicles do not obstruct shared access routes or emergency vehicle access.\n\nThank you for your cooperation!',
    priority: 1,
    author_name: 'Community Manager'
  },
  { 
    id: 'n0000000-0000-0000-0000-000000000004',
    title: 'Local Recommendations - Coffee, Gyms, Schools', 
    content: 'Welcome to the area! Here are some local favourites recommended by your neighbours:\n\n☕ Coffee: The Coffee Bean - 3 min walk\n🏋️ Gyms: FlyeFit Cork - 5 min drive\n🏫 Schools: Scoil Mhuire Primary - 8 min walk\n🛒 Shopping: Dunnes Stores Ballyvolane - 5 min drive\n🏥 Medical: Ballyvolane Medical Centre - 4 min walk\n\nFeel free to share your own recommendations on the noticeboard!',
    priority: 1,
    author_name: 'OpenHouse Team'
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
      51.8985,
      -8.4756,
      'You are a helpful assistant for OpenHouse Park, a premium residential development in Cork, Ireland. Help homeowners with questions about their new home.'
    )
  `);
  
  await upsertRecord('units', DEMO_UNIT_ID, 'id', `
    INSERT INTO units (
      id, project_id, tenant_id, development_id, development_code, unit_number, unit_code, unit_uid,
      address_line_1, address, city, country, eircode, house_type_code, bedrooms, bathrooms, purchaser_name
    )
    VALUES (
      '${DEMO_UNIT_ID}',
      '${DEMO_PROJECT_ID}',
      '${DEMO_TENANT_ID}',
      '${DEMO_DEVELOPMENT_ID}',
      '${DEMO_DEVELOPMENT_CODE}',
      '9',
      '009',
      '${DEMO_UNIT_UID}',
      '9 OpenHouse Way',
      '9 OpenHouse Way, Cork, Ireland',
      'Cork',
      'Ireland',
      'T12 AB12',
      'A3',
      4,
      3,
      'Keely O''Grady'
    )
  `);
  
  // Seed noticeboard posts using Drizzle ORM with ON CONFLICT
  console.log('[Demo Seed] Creating noticeboard posts...');
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
        author_unit: '9 OpenHouse Way',
      }).onConflictDoNothing();
      console.log(`[Demo Seed] Created/skipped noticeboard: "${notice.title.substring(0, 30)}..."`);
    } catch (e: any) {
      console.log(`[Demo Seed] Notice "${notice.title.substring(0, 30)}..." error: ${e.message}`);
    }
  }
  
  // Seed video
  console.log('[Demo Seed] Creating demo video (if table exists)...');
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
    console.log(`[Demo Seed] Video table not available: ${e.message}`);
  }
  
  console.log('[Demo Seed] Demo data seeded successfully!');
  console.log(`[Demo Seed] Access code: ${DEMO_UNIT_UID}`);
  
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
    { table: 'video_resources', where: `tenant_id = '${DEMO_TENANT_ID}'` },
    { table: 'units', where: `id = '${DEMO_UNIT_ID}'` },
    { table: 'units', where: `project_id = '${DEMO_PROJECT_ID}'` },
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
