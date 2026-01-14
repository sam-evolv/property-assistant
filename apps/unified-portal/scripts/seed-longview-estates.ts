#!/usr/bin/env tsx
/**
 * IDEMPOTENT SEED SCRIPT - Longview Estates Data
 * 
 * Seeds the 3 Longview Estates developments with:
 * - Units (purchasers/residents) in Supabase
 * - Messages in Drizzle (for testing stats)
 * 
 * Safe to re-run - checks for existing records before inserting.
 * 
 * Usage: npx tsx apps/unified-portal/scripts/seed-longview-estates.ts
 */
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LONGVIEW_ESTATES_TENANT_ID = '4cee69c6-be4b-486e-9c33-2b5a7d30e287';

interface Development {
  projectId: string;
  devId: string;
  name: string;
  code: string;
  units: { num: string; name: string; email: string }[];
}

const DEVELOPMENTS: Development[] = [
  {
    projectId: '57dc3919-2725-4575-8046-9179075ac88e',
    devId: '34316432-f1e8-4297-b993-d9b5c88ee2d8',
    name: 'Longview Park',
    code: 'LONGVIEW',
    units: [
      { num: '1', name: 'John Murphy', email: 'john.murphy@example.com' },
      { num: '2', name: "Mary O'Brien", email: 'mary.obrien@example.com' },
      { num: '3', name: 'Patrick Walsh', email: 'patrick.walsh@example.com' },
      { num: '4', name: 'Aoife Kelly', email: 'aoife.kelly@example.com' },
      { num: '5', name: 'Conor Ryan', email: 'conor.ryan@example.com' },
      { num: '6', name: 'Siobhan Byrne', email: 'siobhan.byrne@example.com' },
      { num: '7', name: "Sean O'Connor", email: 'sean.oconnor@example.com' },
      { num: '8', name: 'Niamh McCarthy', email: 'niamh.mccarthy@example.com' },
    ],
  },
  {
    projectId: '6d3789de-2e46-430c-bf31-22224bd878da',
    devId: 'e0833063-55ac-4201-a50e-f329c090fbd6',
    name: 'Rathard Park',
    code: 'RATHARD_PARK',
    units: [
      { num: '1', name: 'Declan Fitzgerald', email: 'declan.fitzgerald@example.com' },
      { num: '2', name: 'Emma Doyle', email: 'emma.doyle@example.com' },
      { num: '3', name: 'Ciaran Kennedy', email: 'ciaran.kennedy@example.com' },
      { num: '4', name: 'Orla Brennan', email: 'orla.brennan@example.com' },
      { num: '5', name: 'Liam Gallagher', email: 'liam.gallagher@example.com' },
      { num: '6', name: 'Sarah Lynch', email: 'sarah.lynch@example.com' },
    ],
  },
  {
    projectId: '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
    devId: '39c49eeb-54a6-4b04-a16a-119012c531cb',
    name: 'Rathard Lawn',
    code: 'RATHARD_LAWN',
    units: [
      { num: '1', name: 'Michael Healy', email: 'michael.healy@example.com' },
      { num: '2', name: 'Claire Dunne', email: 'claire.dunne@example.com' },
      { num: '3', name: "Kevin O'Sullivan", email: 'kevin.osullivan@example.com' },
      { num: '4', name: 'Fiona Moran', email: 'fiona.moran@example.com' },
      { num: '5', name: 'Brian Quinn', email: 'brian.quinn@example.com' },
      { num: '6', name: 'Anna Burke', email: 'anna.burke@example.com' },
    ],
  },
];

async function ensureLongviewEstatesTenant() {
  console.log('=== PHASE 1: ENSURE LONGVIEW ESTATES TENANT ===\n');

  const existing = await db.execute(sql`
    SELECT id FROM tenants WHERE id = ${LONGVIEW_ESTATES_TENANT_ID}::uuid
  `);

  if (existing.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO tenants (id, name, slug, created_at)
      VALUES (${LONGVIEW_ESTATES_TENANT_ID}::uuid, 'Longview Estates', 'longview-estates', NOW())
    `);
    console.log('✓ Created Longview Estates tenant');
  } else {
    console.log('- Longview Estates tenant exists');
  }

  console.log('\nChecking 3 developments tenant linkage...');
  for (const dev of DEVELOPMENTS) {
    const result = await db.execute(sql`
      SELECT tenant_id FROM developments WHERE id = ${dev.devId}::uuid
    `);
    const currentTenantId = (result.rows[0] as any)?.tenant_id;

    if (currentTenantId === LONGVIEW_ESTATES_TENANT_ID) {
      console.log(`  - ${dev.name}: already correct`);
    } else {
      await db.execute(sql`
        UPDATE developments SET tenant_id = ${LONGVIEW_ESTATES_TENANT_ID}::uuid
        WHERE id = ${dev.devId}::uuid
      `);
      console.log(`  ✓ ${dev.name}: updated to Longview Estates`);
    }
  }
}

async function seedSupabaseUnits() {
  console.log('\n=== PHASE 2: SEED SUPABASE UNITS ===\n');

  let totalCreated = 0;

  for (const dev of DEVELOPMENTS) {
    console.log(`📍 ${dev.name}`);

    const { data: existing } = await supabase
      .from('units')
      .select('unit_number')
      .eq('project_id', dev.projectId);

    const existingNums = new Set(existing?.map((u) => u.unit_number) || []);

    for (const u of dev.units) {
      if (existingNums.has(u.num)) {
        console.log(`  - Unit ${u.num}: already exists`);
        continue;
      }

      const unitUid = `${dev.code}-${u.num.padStart(3, '0')}`;

      const { error } = await supabase.from('units').insert({
        id: randomUUID(),
        project_id: dev.projectId,
        tenant_id: LONGVIEW_ESTATES_TENANT_ID,
        development_id: dev.devId,
        development_code: dev.code,
        unit_number: u.num,
        unit_code: u.num.padStart(3, '0'),
        unit_uid: unitUid,
        address: `${u.num} ${dev.name}, Cork, Ireland`,
        address_line_1: `${u.num} ${dev.name}`,
        city: 'Cork',
        country: 'Ireland',
        purchaser_name: u.name,
        house_type_code: 'A',
        bedrooms: 3,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.log(`  ⚠ Unit ${u.num}: ${error.message}`);
      } else {
        console.log(`  ✓ Unit ${u.num}: ${u.name}`);
        totalCreated++;
      }
    }
  }

  console.log(`\n✓ Created ${totalCreated} new units`);
}

async function seedMessages() {
  console.log('\n=== PHASE 3: SEED MESSAGES ===\n');

  const questions = [
    'When will my house be ready for closing?',
    'Can I schedule a snagging inspection?',
    'What documents do I need for the closing?',
    'How do I connect my utilities?',
    'When will the landscaping be complete?',
  ];

  for (const dev of DEVELOPMENTS) {
    console.log(`📍 ${dev.name}`);

    const { count } = await db
      .execute(
        sql`
      SELECT COUNT(*)::int as count FROM messages 
      WHERE development_id = ${dev.devId}::uuid
    `
      )
      .then((r) => ({ count: (r.rows[0] as any).count }));

    if (count > 10) {
      console.log(`  - Already has ${count} messages, skipping`);
      continue;
    }

    for (let i = 0; i < 15; i++) {
      const question = questions[Math.floor(Math.random() * questions.length)];

      try {
        await db.execute(sql`
          INSERT INTO messages (
            tenant_id, development_id, user_message, assistant_message, question_topic, created_at
          )
          VALUES (
            ${LONGVIEW_ESTATES_TENANT_ID}::uuid,
            ${dev.devId}::uuid,
            ${question},
            'Thank you for your question. Our team will respond shortly.',
            'general',
            NOW() - (random() * interval '30 days')
          )
        `);
      } catch (e) {
        // Ignore errors
      }
    }
    console.log(`  ✓ Seeded messages`);
  }
}

async function generateIntegrityReport() {
  console.log('\n' + '═'.repeat(70));
  console.log('                    TENANT INTEGRITY REPORT');
  console.log('═'.repeat(70) + '\n');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  console.log('\n--- TENANTS ---');
  const tenants = await db.execute(sql`SELECT id, name FROM tenants ORDER BY name`);
  tenants.rows.forEach((t: any) => console.log(`  ${t.name} (id: ${t.id})`));

  console.log('\n--- DEVELOPMENTS BY TENANT ---');
  const devsByTenant = await db.execute(sql`
    SELECT t.name as tenant_name, d.name as dev_name, d.logo_url
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
    console.log(`    - ${row.dev_name} (logo: ${row.logo_url || 'NOT SET'})`);
  }

  console.log('\n--- SUPABASE UNITS BY DEVELOPMENT ---');
  const { data: projects } = await supabase.from('projects').select('id, name');
  for (const p of projects || []) {
    const { count } = await supabase
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', p.id);
    console.log(`  ${p.name}: ${count} units`);
  }

  console.log('\n--- MESSAGES BY DEVELOPMENT ---');
  const msgs = await db.execute(sql`
    SELECT d.name as dev_name, COUNT(m.id)::int as count
    FROM developments d
    LEFT JOIN messages m ON m.development_id = d.id
    GROUP BY d.id, d.name
    ORDER BY d.name
  `);
  msgs.rows.forEach((r: any) => console.log(`  ${r.dev_name}: ${r.count} messages`));

  console.log('\n' + '═'.repeat(70) + '\n');
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     LONGVIEW ESTATES SEED SCRIPT (IDEMPOTENT)                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);

  await ensureLongviewEstatesTenant();
  await seedSupabaseUnits();
  await seedMessages();
  await generateIntegrityReport();

  console.log('✅ Seed complete!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
