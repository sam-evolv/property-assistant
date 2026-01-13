import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_ORG_ID = 'a1000000-0000-0000-0000-000000000001';
const DEMO_DEVELOPMENT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_ID = 'c0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_UID = 'OH-PARK-009';
const DEMO_DEVELOPMENT_CODE = 'OH-PARK';

const DEMO_DOCUMENTS = [
  { title: 'Homeowner Welcome Pack - OpenHouse Park', document_type: 'general', discipline: 'handover' },
  { title: 'Appliance Warranty Summary', document_type: 'warranty', discipline: 'warranties' },
  { title: 'Heating System Quick Start Guide', document_type: 'guide', discipline: 'mechanical' },
  { title: 'Floor Plan - Type A3', document_type: 'drawing', discipline: 'architectural' },
  { title: 'Bin Collection and Waste Guidelines', document_type: 'general', discipline: 'handover' },
  { title: 'Snagging and Defects Process', document_type: 'guide', discipline: 'snagging' },
  { title: 'Broadband and Utilities Setup', document_type: 'guide', discipline: 'electrical' },
  { title: 'Fire Safety Information', document_type: 'safety', discipline: 'fire' },
];

const DEMO_NOTICEBOARD = [
  { title: 'Move-in Day Checklist', content: 'Welcome to OpenHouse Park! Here\'s your essential move-in checklist:\n\n• Confirm utility connections (ESB, Gas Networks Ireland)\n• Set up broadband service\n• Register with local GP\n• Update your address with Revenue\n• Meet your neighbours!' },
  { title: 'Waste Collection Schedule', content: 'Bin collection days for OpenHouse Park:\n\n• General Waste (Black): Every Tuesday\n• Recycling (Green): Every second Tuesday\n• Organic (Brown): Every Tuesday\n\nPlease have bins out by 7:00 AM.' },
  { title: 'Resident Parking Guidelines', content: 'Each home has allocated parking spaces as shown on your site plan. Visitor parking is available near the entrance. Please ensure vehicles do not obstruct shared access routes.' },
  { title: 'Local Recommendations', content: 'Welcome to the neighbourhood! Here are some local favourites:\n\n• Dunnes Stores - 5 min drive\n• Centra - 2 min walk\n• Local pharmacy - 3 min walk\n• Bus stop (220) - 1 min walk' },
];

async function upsertRecord(table: string, id: string, idColumn: string, insertSql: string): Promise<boolean> {
  const checkResult = await db.execute(sql.raw(`SELECT 1 FROM ${table} WHERE ${idColumn} = '${id}' LIMIT 1`));
  if (checkResult.rows.length > 0) {
    console.log(`[Demo Seed] ${table} record already exists, skipping...`);
    return false;
  }
  await db.execute(sql.raw(insertSql));
  console.log(`[Demo Seed] Created ${table} record`);
  return true;
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
      'A stunning new development of premium family homes',
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
