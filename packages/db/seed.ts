import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in environment variables');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const db = drizzle(client, { schema });

    console.log('🌱 Seeding database...');

    const existingTenants = await db.select().from(schema.tenants).limit(1);
    
    let tenant;
    if (existingTenants.length > 0) {
      console.log('⚠️  Tenant already exists. Using existing tenant...');
      tenant = existingTenants[0];
      console.log(`✅ Using tenant: ${tenant.name} (ID: ${tenant.id})`);
    } else {
      [tenant] = await db
        .insert(schema.tenants)
        .values({
          name: 'Seaview Estates',
          slug: 'seaview-estates',
          logo_url: 'https://via.placeholder.com/200x80?text=Seaview+Estates',
        })
        .returning();

      console.log(`✅ Created tenant: ${tenant.name} (ID: ${tenant.id})`);
    }

    const existingAdmins = await db
      .select()
      .from(schema.admins)
      .where(sql`${schema.admins.email} = 'admin@seaview-estates.com'`)
      .limit(1);

    let admin;
    if (existingAdmins.length > 0) {
      console.log('⚠️  Admin already exists. Skipping admin creation...');
      admin = existingAdmins[0];
    } else {
      [admin] = await db
        .insert(schema.admins)
        .values({
          tenant_id: tenant.id,
          email: 'admin@seaview-estates.com',
          role: 'admin',
        })
        .returning();
      console.log(`✅ Created admin: ${admin.email}`);
    }

    const existingDocuments = await db.select().from(schema.documents).limit(1);
    if (existingDocuments.length === 0) {
      await db.insert(schema.documents).values([
      {
        tenant_id: tenant.id,
        title: 'Resident Handbook 2024',
        file_url: '/documents/handbook-2024.pdf',
        version: 1,
      },
      {
        tenant_id: tenant.id,
        title: 'Pool Rules & Regulations',
        file_url: '/documents/pool-rules.pdf',
        version: 1,
      },
      {
        tenant_id: tenant.id,
        title: 'Parking Guidelines',
        file_url: '/documents/parking-guidelines.pdf',
        version: 2,
      },
      ]);
      console.log('✅ Created 3 sample documents');
    } else {
      console.log('⚠️  Documents already exist. Skipping...');
    }

    const existingPois = await db.select().from(schema.pois).limit(1);
    if (existingPois.length === 0) {
      await db.insert(schema.pois).values([
      {
        tenant_id: tenant.id,
        name: 'Main Pool',
        category: 'Amenity',
        lat: 37.7749,
        lng: -122.4194,
        meta: { address: 'Building A, Ground Floor' },
      },
      {
        tenant_id: tenant.id,
        name: 'Fitness Center',
        category: 'Amenity',
        lat: 37.7750,
        lng: -122.4195,
        meta: { address: 'Building B, 2nd Floor' },
      },
      {
        tenant_id: tenant.id,
        name: 'Guest Parking',
        category: 'Parking',
        lat: 37.7748,
        lng: -122.4193,
        meta: { address: 'North Lot, Level 1' },
      },
      {
        tenant_id: tenant.id,
        name: 'Package Room',
        category: 'Service',
        lat: 37.7751,
        lng: -122.4196,
        meta: { address: 'Lobby, Building A' },
      },
      ]);
      console.log('✅ Created 4 sample POIs');
    } else {
      console.log('⚠️  POIs already exist. Skipping...');
    }

    const existingPosts = await db.select().from(schema.noticeboard_posts).limit(1);
    if (existingPosts.length === 0) {
      await db.insert(schema.noticeboard_posts).values([
      {
        tenant_id: tenant.id,
        title: 'Pool Maintenance Scheduled',
        content: 'The main pool will be closed for routine maintenance from Nov 5-7.',
        author_id: admin.id,
      },
      {
        tenant_id: tenant.id,
        title: 'Holiday Party Announcement',
        content: 'Join us for the annual holiday party on December 15th in the clubhouse!',
        author_id: admin.id,
      },
      ]);
      console.log('✅ Created 2 sample noticeboard posts');
    } else {
      console.log('⚠️  Noticeboard posts already exist. Skipping...');
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Demo Tenant Details:');
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   Admin Email: ${admin.email}`);
    console.log(`\n🔗 Access the app:`);
    console.log(`   Resident App: http://localhost:5000`);
    console.log(`   Master Admin: http://localhost:3000`);
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
