import { drizzle } from 'drizzle-orm/node-postgres';
import { sql, eq } from 'drizzle-orm';
import { Client } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

async function seedTenants() {
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

    console.log('🌱 Seeding additional tenants...\n');

    const tenantData = [
      {
        name: 'Harbour Heights',
        slug: 'harbour',
        logo_url: 'https://via.placeholder.com/200x80?text=Harbour+Heights',
        description: 'Luxury waterfront development with stunning harbour views',
        theme_color: '#0EA5E9',
      },
      {
        name: 'Oakfield View',
        slug: 'oakfield',
        logo_url: 'https://via.placeholder.com/200x80?text=Oakfield+View',
        description: 'Premium residential community surrounded by nature',
        theme_color: '#10B981',
      },
    ];

    for (const tenantInfo of tenantData) {
      const existing = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.slug, tenantInfo.slug))
        .limit(1);

      if (existing.length > 0) {
        console.log(`⚠️  Tenant "${tenantInfo.name}" already exists. Skipping...`);
        continue;
      }

      const [tenant] = await db
        .insert(schema.tenants)
        .values(tenantInfo)
        .returning();

      console.log(`✅ Created tenant: ${tenant.name} (slug: ${tenant.slug})`);

      const [admin] = await db
        .insert(schema.admins)
        .values({
          tenant_id: tenant.id,
          email: `admin@${tenant.slug}.com`,
          role: 'admin',
        })
        .returning();

      console.log(`   └─ Created admin: ${admin.email}`);

      await db.insert(schema.pois).values([
        {
          tenant_id: tenant.id,
          name: 'Community Pool',
          category: 'Amenity',
          lat: 37.7749 + Math.random() * 0.01,
          lng: -122.4194 + Math.random() * 0.01,
          meta: { address: 'Main Complex' },
        },
        {
          tenant_id: tenant.id,
          name: 'Gym & Fitness',
          category: 'Amenity',
          lat: 37.7750 + Math.random() * 0.01,
          lng: -122.4195 + Math.random() * 0.01,
          meta: { address: 'Ground Floor' },
        },
      ]);

      console.log(`   └─ Created 2 sample POIs\n`);
    }

    console.log('🎉 Additional tenants seeded successfully!');
    console.log('\n📋 All Tenants:');
    
    const allTenants = await db.select().from(schema.tenants);
    allTenants.forEach(t => {
      console.log(`   • ${t.name} - http://localhost:5000?tenant=${t.slug}`);
    });
    
  } catch (error) {
    console.error('❌ Error seeding tenants:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedTenants();
