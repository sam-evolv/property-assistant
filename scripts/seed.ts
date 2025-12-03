import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { db, units, faqs, contacts, issue_types, tenants } from '@openhouse/db';
import { eq } from 'drizzle-orm';

const TENANT_SLUG = process.env.TENANT_SLUG || 'seaview';

async function loadCSV(filename: string): Promise<any[]> {
  const filepath = join(__dirname, 'data', filename);
  const content = readFileSync(filepath, 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
  });
}

async function seedUnits(tenantId: string) {
  console.log('📦 Seeding units...');
  const rows = await loadCSV('seaview_units.csv');
  
  for (const row of rows) {
    const data: any = row;
    await db.insert(units).values({
      tenant_id: tenantId,
      unit_number: data.unit_number,
      unit_code: data.unit_code,
      resident_name: data.resident_name,
      resident_email: data.resident_email,
      resident_phone: data.resident_phone,
      created_at: new Date(),
    }).onConflictDoNothing();
  }
  
  console.log(`✅ Seeded ${rows.length} units`);
}

async function seedFAQs(tenantId: string) {
  console.log('📦 Seeding FAQs...');
  const rows = await loadCSV('seaview_faqs.csv');
  
  for (const row of rows) {
    const data: any = row;
    await db.insert(faqs).values({
      tenant_id: tenantId,
      question: data.question,
      answer: data.answer,
      category: data.category,
      keywords: data.keywords,
      priority: parseInt(data.priority) || 0,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }).onConflictDoNothing();
  }
  
  console.log(`✅ Seeded ${rows.length} FAQs`);
}

async function seedContacts(tenantId: string) {
  console.log('📦 Seeding contacts...');
  const rows = await loadCSV('seaview_contacts.csv');
  
  for (const row of rows) {
    const data: any = row;
    await db.insert(contacts).values({
      tenant_id: tenantId,
      name: data.name,
      role: data.role,
      email: data.email,
      phone: data.phone,
      department: data.department,
      priority: parseInt(data.priority) || 0,
      active: true,
      created_at: new Date(),
    }).onConflictDoNothing();
  }
  
  console.log(`✅ Seeded ${rows.length} contacts`);
}

async function seedIssueTypes(tenantId: string) {
  console.log('📦 Seeding issue types...');
  const rows = await loadCSV('seaview_issue_types.csv');
  
  for (const row of rows) {
    const data: any = row;
    await db.insert(issue_types).values({
      tenant_id: tenantId,
      code: data.code,
      name: data.name,
      description: data.description,
      category: data.category,
      priority: data.priority || 'medium',
      sla_hours: parseInt(data.sla_hours) || null,
      active: true,
      created_at: new Date(),
    }).onConflictDoNothing();
  }
  
  console.log(`✅ Seeded ${rows.length} issue types`);
}

async function main() {
  console.log('🌱 Starting seed process...');
  console.log(`📌 Target tenant: ${TENANT_SLUG}`);
  
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, TENANT_SLUG),
  });
  
  if (!tenant) {
    console.error(`❌ Tenant "${TENANT_SLUG}" not found`);
    process.exit(1);
  }
  
  console.log(`✅ Found tenant: ${tenant.name} (${tenant.id})`);
  
  await seedUnits(tenant.id);
  await seedFAQs(tenant.id);
  await seedContacts(tenant.id);
  await seedIssueTypes(tenant.id);
  
  console.log('🎉 Seed completed successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Seed failed:', error);
  process.exit(1);
});
