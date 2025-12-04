import { db } from '@openhouse/db/client';
import { tenants, developments, homeowners, admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * PHASE 16: Longview Park Pilot Deployment
 * Seeds a complete real-world development with houses ready for QR onboarding
 */

const LONGVIEW_TENANT_SLUG = 'longview-estates';

interface HouseData {
  houseNumber: string;
  houseType: 'A' | 'B' | 'C' | 'D';
  lotNumber: string;
  address: string;
}

// 20 houses for pilot - realistic sample set
const PILOT_HOUSES: HouseData[] = [
  // Type A Houses (4 bed detached)
  { houseNumber: '1', houseType: 'A', lotNumber: 'LV-001', address: '1 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '2', houseType: 'A', lotNumber: 'LV-002', address: '2 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '5', houseType: 'A', lotNumber: 'LV-005', address: '5 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '12', houseType: 'A', lotNumber: 'LV-012', address: '12 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '20', houseType: 'A', lotNumber: 'LV-020', address: '20 Longview Park, Drogheda, Co. Louth' },

  // Type B Houses (3 bed semi-detached)
  { houseNumber: '3', houseType: 'B', lotNumber: 'LV-003', address: '3 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '4', houseType: 'B', lotNumber: 'LV-004', address: '4 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '7', houseType: 'B', lotNumber: 'LV-007', address: '7 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '8', houseType: 'B', lotNumber: 'LV-008', address: '8 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '15', houseType: 'B', lotNumber: 'LV-015', address: '15 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '16', houseType: 'B', lotNumber: 'LV-016', address: '16 Longview Park, Drogheda, Co. Louth' },

  // Type C Houses (2 bed terraced)
  { houseNumber: '6', houseType: 'C', lotNumber: 'LV-006', address: '6 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '9', houseType: 'C', lotNumber: 'LV-009', address: '9 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '10', houseType: 'C', lotNumber: 'LV-010', address: '10 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '13', houseType: 'C', lotNumber: 'LV-013', address: '13 Longview Park, Drogheda, Co. Louth' },

  // Type D Houses (3 bed end-terrace)
  { houseNumber: '11', houseType: 'D', lotNumber: 'LV-011', address: '11 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '14', houseType: 'D', lotNumber: 'LV-014', address: '14 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '17', houseType: 'D', lotNumber: 'LV-017', address: '17 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '18', houseType: 'D', lotNumber: 'LV-018', address: '18 Longview Park, Drogheda, Co. Louth' },
  { houseNumber: '19', houseType: 'D', lotNumber: 'LV-019', address: '19 Longview Park, Drogheda, Co. Louth' },
];

async function main() {
  console.log('🏘️  PHASE 16: Longview Park Pilot Deployment');
  console.log('============================================\n');

  // Step 1: Create Longview Estates Tenant
  console.log('📋 Step 1: Creating Longview Estates tenant...');
  
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, LONGVIEW_TENANT_SLUG),
  });

  if (tenant) {
    console.log(`   ✓ Tenant already exists: ${tenant.name} (${tenant.id})`);
  } else {
    const [newTenant] = await db.insert(tenants).values({
      name: 'Longview Estates',
      slug: LONGVIEW_TENANT_SLUG,
      description: 'Longview Estates - Premier residential developments in Drogheda',
      logo_url: null,
      theme_color: '#10b981', // Green theme
      brand: {
        primaryColor: '#10b981',
        companyName: 'Longview Estates',
        tagline: 'Building Communities, Creating Homes',
      },
      contact: {
        email: 'info@longviewestates.ie',
        phone: '+353 41 987 6543',
        address: 'Longview Business Park, Drogheda, Co. Louth, Ireland',
      },
    }).returning();
    
    tenant = newTenant;
    console.log(`   ✓ Created tenant: ${tenant.name} (${tenant.id})`);
  }

  // Step 2: Create Longview Park Development
  console.log('\n📍 Step 2: Creating Longview Park development...');
  
  let development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
  });

  if (development) {
    console.log(`   ✓ Development already exists: ${development.name} (${development.id})`);
  } else {
    const [newDevelopment] = await db.insert(developments).values({
      tenant_id: tenant.id,
      name: 'Longview Park',
      address: 'Longview Park, Drogheda, Co. Louth, Ireland',
      description: 'A modern residential development featuring 20 energy-efficient homes in the heart of Drogheda. Longview Park offers a range of 2, 3, and 4 bedroom homes with contemporary design and excellent transport links.',
      system_instructions: `You are the AI assistant for Longview Park, a new residential development in Drogheda, County Louth. 

Key Information:
- Development: Longview Park, managed by Longview Estates
- Location: Drogheda, Co. Louth (53.7189° N, 6.3476° W)
- House Types: A (4 bed detached), B (3 bed semi-detached), C (2 bed terraced), D (3 bed end-terrace)
- Total Units: 20 homes
- Features: A-rated energy efficiency, solar panels, EV charging points
- Amenities: Landscaped green spaces, children's playground, secure parking

Developer Contact:
- Email: info@longviewestates.ie
- Phone: +353 41 987 6543
- Emergency: After-hours maintenance hotline

Be helpful, friendly, and provide accurate information about the development. Always cite document sources when answering questions about warranties, appliance manuals, or technical specifications.`,
    }).returning();
    
    development = newDevelopment;
    console.log(`   ✓ Created development: ${development.name} (${development.id})`);
  }

  // Step 3: Create Houses (Homeowners) with QR Tokens
  console.log('\n🏠 Step 3: Creating houses with QR tokens...');
  console.log(`   Creating ${PILOT_HOUSES.length} houses...\n`);

  const createdHouses: Array<typeof homeowners.$inferSelect> = [];

  for (const house of PILOT_HOUSES) {
    const qrToken = randomUUID();
    
    // Check if house already exists by address (unique per development)
    const existingHouse = await db.query.homeowners.findFirst({
      where: (homeowners, { and, eq }) => and(
        eq(homeowners.development_id, development.id),
        eq(homeowners.address, house.address)
      ),
    });

    if (existingHouse) {
      console.log(`   ⊙ House ${house.houseNumber} (${house.houseType}) already exists`);
      createdHouses.push(existingHouse);
      continue;
    }

    // NOTE: Email is placeholder - homeowners update this during QR onboarding
    // Onboarding flow: Scan QR → Enter real email → Supabase magic link → Access portal
    const [newHouse] = await db.insert(homeowners).values({
      tenant_id: tenant.id,
      development_id: development.id,
      name: `House ${house.houseNumber}`, // Updated during onboarding
      email: `house${house.houseNumber}@pending.onboarding`, // Placeholder - replaced during onboarding
      house_type: house.houseType,
      address: house.address,
      unique_qr_token: qrToken,
      metadata: {
        houseNumber: house.houseNumber,
        lotNumber: house.lotNumber,
        onboardingStatus: 'pending',
        onboardingCompleted: false,
        houseTypeDescription: getHouseTypeDescription(house.houseType),
      },
    }).returning();

    createdHouses.push(newHouse);
    console.log(`   ✓ House ${house.houseNumber} (Type ${house.houseType}) - QR: ${qrToken.substring(0, 8)}...`);
  }

  // Step 4: Create Developer Staff Accounts
  console.log('\n👥 Step 4: Creating developer staff accounts...');
  
  const staffMembers = [
    {
      email: 'sarah.murphy@longviewestates.ie',
      role: 'developer',
      name: 'Sarah Murphy - Development Manager',
    },
    {
      email: 'james.oconnor@longviewestates.ie',
      role: 'developer',
      name: 'James O\'Connor - Customer Care Lead',
    },
    {
      email: 'emma.walsh@longviewestates.ie',
      role: 'developer',
      name: 'Emma Walsh - Technical Coordinator',
    },
  ];

  for (const staff of staffMembers) {
    const existingAdmin = await db.query.admins.findFirst({
      where: eq(admins.email, staff.email),
    });

    if (existingAdmin) {
      console.log(`   ⊙ ${staff.name} already exists`);
      continue;
    }

    await db.insert(admins).values({
      tenant_id: tenant.id,
      email: staff.email,
      role: staff.role as 'admin' | 'developer',
    });

    console.log(`   ✓ Created: ${staff.name}`);
  }

  // Summary
  console.log('\n✅ PILOT DEPLOYMENT COMPLETE!');
  console.log('================================');
  console.log(`Tenant: ${tenant.name}`);
  console.log(`Development: ${development.name}`);
  console.log(`Houses Created: ${createdHouses.length}`);
  console.log(`Staff Accounts: ${staffMembers.length}`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Run QR generation: npm run generate:qrs');
  console.log('   2. Upload sample documents to development');
  console.log('   3. Test onboarding flow with generated QR codes');
  console.log('   4. Share QR codes with pilot homeowners\n');

  process.exit(0);
}

function getHouseTypeDescription(type: string): string {
  const descriptions = {
    A: '4 Bedroom Detached - Premium family home with large garden and driveway',
    B: '3 Bedroom Semi-Detached - Spacious family home with front and rear gardens',
    C: '2 Bedroom Terraced - Modern starter home perfect for first-time buyers',
    D: '3 Bedroom End-Terrace - Bright corner home with additional side access',
  };
  return descriptions[type as keyof typeof descriptions] || 'Residential Property';
}

main().catch((error) => {
  console.error('❌ Error during seed:', error);
  process.exit(1);
});
