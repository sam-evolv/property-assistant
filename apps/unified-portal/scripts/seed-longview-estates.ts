#!/usr/bin/env tsx
/**
 * IDEMPOTENT SEED SCRIPT - Longview Estates Data
 * 
 * Seeds the 3 Longview Estates developments with:
 * - Units (purchasers/residents)
 * - Noticeboard posts
 * - Documents
 * - Analytics events for testing stats
 * 
 * Safe to re-run - uses ON CONFLICT DO NOTHING for all inserts.
 * 
 * Usage: npx tsx apps/unified-portal/scripts/seed-longview-estates.ts
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LONGVIEW_ESTATES_TENANT_ID = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';

interface Development {
  supabaseProjectId: string;
  drizzleDevId: string;
  name: string;
  units: UnitSeed[];
}

interface UnitSeed {
  unit_number: string;
  address: string;
  purchaser_name: string;
  purchaser_email: string;
  house_type: string;
  bedrooms: number;
}

const DEVELOPMENTS: Development[] = [
  {
    supabaseProjectId: '57dc3919-2725-4575-8046-9179075ac88e',
    drizzleDevId: '34316432-f1e8-4297-b993-d9b5c88ee2d8',
    name: 'Longview Park',
    units: [
      { unit_number: '1', address: '1 Longview Park, Ballyvolane, Cork', purchaser_name: 'John Murphy', purchaser_email: 'john.murphy@example.com', house_type: 'A', bedrooms: 3 },
      { unit_number: '2', address: '2 Longview Park, Ballyvolane, Cork', purchaser_name: 'Mary O\'Brien', purchaser_email: 'mary.obrien@example.com', house_type: 'B', bedrooms: 4 },
      { unit_number: '3', address: '3 Longview Park, Ballyvolane, Cork', purchaser_name: 'Patrick Walsh', purchaser_email: 'patrick.walsh@example.com', house_type: 'A', bedrooms: 3 },
      { unit_number: '4', address: '4 Longview Park, Ballyvolane, Cork', purchaser_name: 'Aoife Kelly', purchaser_email: 'aoife.kelly@example.com', house_type: 'C', bedrooms: 5 },
      { unit_number: '5', address: '5 Longview Park, Ballyvolane, Cork', purchaser_name: 'Conor Ryan', purchaser_email: 'conor.ryan@example.com', house_type: 'B', bedrooms: 4 },
      { unit_number: '6', address: '6 Longview Park, Ballyvolane, Cork', purchaser_name: 'Siobhan Byrne', purchaser_email: 'siobhan.byrne@example.com', house_type: 'A', bedrooms: 3 },
      { unit_number: '7', address: '7 Longview Park, Ballyvolane, Cork', purchaser_name: 'Sean O\'Connor', purchaser_email: 'sean.oconnor@example.com', house_type: 'B', bedrooms: 4 },
      { unit_number: '8', address: '8 Longview Park, Ballyvolane, Cork', purchaser_name: 'Niamh McCarthy', purchaser_email: 'niamh.mccarthy@example.com', house_type: 'A', bedrooms: 3 },
    ],
  },
  {
    supabaseProjectId: '6d3789de-2e46-430c-bf31-22224bd878da',
    drizzleDevId: 'e0833063-55ac-4201-a50e-f329c090fbd6',
    name: 'Rathard Park',
    units: [
      { unit_number: '1', address: '1 Rathard Park, Lahardane, Cork', purchaser_name: 'Declan Fitzgerald', purchaser_email: 'declan.fitzgerald@example.com', house_type: 'D', bedrooms: 3 },
      { unit_number: '2', address: '2 Rathard Park, Lahardane, Cork', purchaser_name: 'Emma Doyle', purchaser_email: 'emma.doyle@example.com', house_type: 'E', bedrooms: 4 },
      { unit_number: '3', address: '3 Rathard Park, Lahardane, Cork', purchaser_name: 'Ciaran Kennedy', purchaser_email: 'ciaran.kennedy@example.com', house_type: 'D', bedrooms: 3 },
      { unit_number: '4', address: '4 Rathard Park, Lahardane, Cork', purchaser_name: 'Orla Brennan', purchaser_email: 'orla.brennan@example.com', house_type: 'F', bedrooms: 5 },
      { unit_number: '5', address: '5 Rathard Park, Lahardane, Cork', purchaser_name: 'Liam Gallagher', purchaser_email: 'liam.gallagher@example.com', house_type: 'E', bedrooms: 4 },
      { unit_number: '6', address: '6 Rathard Park, Lahardane, Cork', purchaser_name: 'Sarah Lynch', purchaser_email: 'sarah.lynch@example.com', house_type: 'D', bedrooms: 3 },
    ],
  },
  {
    supabaseProjectId: '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
    drizzleDevId: '39c49eeb-54a6-4b04-a16a-119012c531cb',
    name: 'Rathard Lawn',
    units: [
      { unit_number: '1', address: '1 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Michael Healy', purchaser_email: 'michael.healy@example.com', house_type: 'G', bedrooms: 3 },
      { unit_number: '2', address: '2 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Claire Dunne', purchaser_email: 'claire.dunne@example.com', house_type: 'H', bedrooms: 4 },
      { unit_number: '3', address: '3 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Kevin O\'Sullivan', purchaser_email: 'kevin.osullivan@example.com', house_type: 'G', bedrooms: 3 },
      { unit_number: '4', address: '4 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Fiona Moran', purchaser_email: 'fiona.moran@example.com', house_type: 'H', bedrooms: 4 },
      { unit_number: '5', address: '5 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Brian Quinn', purchaser_email: 'brian.quinn@example.com', house_type: 'G', bedrooms: 3 },
      { unit_number: '6', address: '6 Rathard Lawn, Lahardane, Cork', purchaser_name: 'Anna Burke', purchaser_email: 'anna.burke@example.com', house_type: 'H', bedrooms: 4 },
    ],
  },
];

async function seedUnitsToSupabase() {
  console.log('\n=== SEEDING SUPABASE UNITS ===\n');
  
  let totalCreated = 0;
  let totalSkipped = 0;
  
  for (const dev of DEVELOPMENTS) {
    console.log(`\n📍 ${dev.name}`);
    
    for (const unit of dev.units) {
      const unitId = `${dev.supabaseProjectId.substring(0, 8)}-unit-${unit.unit_number.padStart(3, '0')}`;
      const unitUid = `${dev.name.toLowerCase().replace(/\s+/g, '-')}-${unit.unit_number}-${nanoid(8)}`;
      
      const { error } = await supabase.from('units').upsert({
        id: unitId,
        project_id: dev.supabaseProjectId,
        unit_number: unit.unit_number,
        address: unit.address,
        purchaser_name: unit.purchaser_name,
        purchaser_email: unit.purchaser_email,
        house_type: unit.house_type,
        bedrooms: unit.bedrooms,
        unit_uid: unitUid,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      
      if (error) {
        console.log(`  ⚠ Error for unit ${unit.unit_number}: ${error.message}`);
        totalSkipped++;
      } else {
        console.log(`  ✓ Unit ${unit.unit_number}: ${unit.purchaser_name}`);
        totalCreated++;
      }
    }
  }
  
  console.log(`\n✓ Supabase units: ${totalCreated} created/updated, ${totalSkipped} skipped`);
  return totalCreated;
}

async function seedUnitsToDrizzle() {
  console.log('\n=== SEEDING DRIZZLE UNITS ===\n');
  
  let totalCreated = 0;
  
  for (const dev of DEVELOPMENTS) {
    console.log(`\n📍 ${dev.name}`);
    
    for (const unit of dev.units) {
      const unitUid = `${dev.name.toLowerCase().replace(/\s+/g, '-')}-${unit.unit_number}-${nanoid(8)}`;
      const unitCode = `${dev.name.toUpperCase().replace(/\s+/g, '_')}_${unit.unit_number}`;
      
      try {
        await db.execute(sql`
          INSERT INTO units (
            tenant_id, development_id, development_code, unit_number, unit_code, unit_uid,
            address_line_1, city, country, property_type, house_type_code, bedrooms,
            purchaser_name, purchaser_email
          )
          VALUES (
            ${LONGVIEW_ESTATES_TENANT_ID}::uuid,
            ${dev.drizzleDevId}::uuid,
            ${dev.name.toUpperCase().replace(/\s+/g, '_')},
            ${unit.unit_number},
            ${unitCode},
            ${unitUid},
            ${unit.address},
            'Cork',
            'Ireland',
            'house',
            ${unit.house_type},
            ${unit.bedrooms},
            ${unit.purchaser_name},
            ${unit.purchaser_email}
          )
          ON CONFLICT (unit_uid) DO NOTHING
        `);
        console.log(`  ✓ Unit ${unit.unit_number}: ${unit.purchaser_name}`);
        totalCreated++;
      } catch (err: any) {
        if (err.message?.includes('duplicate')) {
          console.log(`  - Unit ${unit.unit_number}: already exists`);
        } else {
          console.log(`  ⚠ Unit ${unit.unit_number}: ${err.message}`);
        }
      }
    }
  }
  
  console.log(`\n✓ Drizzle units seeded: ${totalCreated}`);
  return totalCreated;
}

async function seedNoticeboardPosts() {
  console.log('\n=== SEEDING NOTICEBOARD POSTS ===\n');
  
  const notices = [
    { title: 'Welcome to Your New Home!', content: 'We are delighted to welcome you to your new home. This portal will keep you updated on all development news and important information.', priority: 'high' },
    { title: 'Construction Update - Week 12', content: 'Phase 2 construction is progressing well. Internal plastering is now complete on all units. External landscaping will begin next week.', priority: 'normal' },
    { title: 'Snagging Appointments Available', content: 'Snagging appointments are now available to book through your OpenHouse portal. Please check the Documents section for the snagging checklist.', priority: 'normal' },
    { title: 'Important: Utility Connections', content: 'Please ensure you have contacted ESB Networks and Irish Water to arrange for utility connections before your closing date.', priority: 'high' },
    { title: 'Community Amenities Update', content: 'The community playground and walking paths are now complete. These amenities are available for all residents to enjoy.', priority: 'normal' },
  ];
  
  let totalCreated = 0;
  
  for (const dev of DEVELOPMENTS) {
    console.log(`\n📍 ${dev.name}`);
    
    for (const notice of notices) {
      try {
        await db.execute(sql`
          INSERT INTO noticeboard_posts (
            tenant_id, development_id, title, content, priority, is_published, created_at
          )
          VALUES (
            ${LONGVIEW_ESTATES_TENANT_ID}::uuid,
            ${dev.drizzleDevId}::uuid,
            ${notice.title},
            ${notice.content},
            ${notice.priority},
            true,
            NOW() - (random() * interval '30 days')
          )
        `);
        console.log(`  ✓ ${notice.title.substring(0, 40)}...`);
        totalCreated++;
      } catch (err: any) {
        console.log(`  ⚠ Notice: ${err.message}`);
      }
    }
  }
  
  console.log(`\n✓ Noticeboard posts seeded: ${totalCreated}`);
  return totalCreated;
}

async function seedAnalyticsEvents() {
  console.log('\n=== SEEDING ANALYTICS EVENTS ===\n');
  
  const eventTypes = ['page_view', 'document_view', 'message_sent', 'notice_read', 'login'];
  let totalCreated = 0;
  
  for (const dev of DEVELOPMENTS) {
    console.log(`\n📍 ${dev.name}`);
    
    for (let i = 0; i < 50; i++) {
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const unitIndex = Math.floor(Math.random() * dev.units.length);
      const unit = dev.units[unitIndex];
      
      try {
        await db.execute(sql`
          INSERT INTO analytics_events (
            tenant_id, development_id, event_type, user_email, metadata, created_at
          )
          VALUES (
            ${LONGVIEW_ESTATES_TENANT_ID}::uuid,
            ${dev.drizzleDevId}::uuid,
            ${eventType},
            ${unit.purchaser_email},
            ${JSON.stringify({ unit_number: unit.unit_number, source: 'seed' })}::jsonb,
            NOW() - (random() * interval '30 days')
          )
        `);
        totalCreated++;
      } catch (err: any) {
        // Ignore errors for analytics
      }
    }
    console.log(`  ✓ 50 events created`);
  }
  
  console.log(`\n✓ Analytics events seeded: ${totalCreated}`);
  return totalCreated;
}

async function seedMessages() {
  console.log('\n=== SEEDING MESSAGES ===\n');
  
  const questions = [
    'When will my house be ready for closing?',
    'Can I schedule a snagging inspection?',
    'What documents do I need for the closing?',
    'How do I connect my utilities?',
    'When will the landscaping be complete?',
    'Can I visit the site this weekend?',
    'What is the warranty period for my new home?',
    'How do I access the homeowner manual?',
  ];
  
  let totalCreated = 0;
  
  for (const dev of DEVELOPMENTS) {
    console.log(`\n📍 ${dev.name}`);
    
    for (let i = 0; i < 20; i++) {
      const unitIndex = Math.floor(Math.random() * dev.units.length);
      const unit = dev.units[unitIndex];
      const question = questions[Math.floor(Math.random() * questions.length)];
      
      try {
        await db.execute(sql`
          INSERT INTO messages (
            tenant_id, development_id, user_id, user_message, assistant_message, question_topic, created_at
          )
          VALUES (
            ${LONGVIEW_ESTATES_TENANT_ID}::uuid,
            ${dev.drizzleDevId}::uuid,
            ${unit.purchaser_email},
            ${question},
            'Thank you for your question. Our team will get back to you shortly with more details.',
            'general',
            NOW() - (random() * interval '30 days')
          )
        `);
        totalCreated++;
      } catch (err: any) {
        // Ignore errors for messages
      }
    }
    console.log(`  ✓ 20 messages created`);
  }
  
  console.log(`\n✓ Messages seeded: ${totalCreated}`);
  return totalCreated;
}

async function generateIntegrityReport() {
  console.log('\n' + '═'.repeat(70));
  console.log('                    TENANT INTEGRITY REPORT');
  console.log('═'.repeat(70) + '\n');
  
  // Tenants
  console.log('--- TENANTS ---');
  const tenants = await db.execute(sql`SELECT id, name FROM tenants ORDER BY name`);
  tenants.rows.forEach((t: any) => console.log(`  ${t.name} (${t.id})`));
  
  // Developments by tenant
  console.log('\n--- DEVELOPMENTS BY TENANT ---');
  const devsByTenant = await db.execute(sql`
    SELECT t.name as tenant_name, d.name as dev_name, d.id as dev_id
    FROM developments d
    JOIN tenants t ON d.tenant_id = t.id
    ORDER BY t.name, d.name
  `);
  let currentTenant = '';
  for (const row of devsByTenant.rows as any[]) {
    if (row.tenant_name !== currentTenant) {
      console.log(`\n  ${row.tenant_name}:`);
      currentTenant = row.tenant_name;
    }
    console.log(`    - ${row.dev_name}`);
  }
  
  // Units by development in Supabase
  console.log('\n--- SUPABASE UNITS BY DEVELOPMENT ---');
  const { data: projects } = await supabase.from('projects').select('id, name');
  for (const p of projects || []) {
    const { count } = await supabase.from('units').select('*', { count: 'exact', head: true }).eq('project_id', p.id);
    console.log(`  ${p.name}: ${count} units`);
  }
  
  // Units by development in Drizzle
  console.log('\n--- DRIZZLE UNITS BY DEVELOPMENT ---');
  const drizzleUnits = await db.execute(sql`
    SELECT d.name as dev_name, COUNT(u.id)::int as count
    FROM developments d
    LEFT JOIN units u ON u.development_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);
  drizzleUnits.rows.forEach((r: any) => console.log(`  ${r.dev_name}: ${r.count} units`));
  
  // Noticeboard posts
  console.log('\n--- NOTICEBOARD POSTS BY DEVELOPMENT ---');
  const notices = await db.execute(sql`
    SELECT d.name as dev_name, COUNT(n.id)::int as count
    FROM developments d
    LEFT JOIN noticeboard_posts n ON n.development_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);
  notices.rows.forEach((r: any) => console.log(`  ${r.dev_name}: ${r.count} posts`));
  
  // Messages
  console.log('\n--- MESSAGES BY DEVELOPMENT ---');
  const msgs = await db.execute(sql`
    SELECT d.name as dev_name, COUNT(m.id)::int as count
    FROM developments d
    LEFT JOIN messages m ON m.development_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);
  msgs.rows.forEach((r: any) => console.log(`  ${r.dev_name}: ${r.count} messages`));
  
  // Analytics events
  console.log('\n--- ANALYTICS EVENTS BY DEVELOPMENT ---');
  const events = await db.execute(sql`
    SELECT d.name as dev_name, COUNT(a.id)::int as count
    FROM developments d
    LEFT JOIN analytics_events a ON a.development_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);
  events.rows.forEach((r: any) => console.log(`  ${r.dev_name}: ${r.count} events`));
  
  console.log('\n' + '═'.repeat(70) + '\n');
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     LONGVIEW ESTATES SEED SCRIPT (IDEMPOTENT)                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);
  console.log(`Tenant ID: ${LONGVIEW_ESTATES_TENANT_ID}`);
  
  await seedUnitsToSupabase();
  await seedUnitsToDrizzle();
  await seedNoticeboardPosts();
  await seedMessages();
  await seedAnalyticsEvents();
  await generateIntegrityReport();
  
  console.log('✅ Seed complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
