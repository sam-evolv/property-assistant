import { seedBase } from './seed-base';
import { seedTenants } from './seed-tenants';
import dotenv from 'dotenv';

dotenv.config();

async function seedAll() {
  console.log('🚀 Starting complete database seed...\n');
  console.log('=' .repeat(50));
  
  try {
    console.log('\n📦 Step 1: Seeding base tenant (Seaview Estates)...\n');
    await seedBase();
    
    console.log('\n' + '='.repeat(50));
    console.log('\n📦 Step 2: Seeding additional tenants...\n');
    await seedTenants();
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All seed operations completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ Base tenant (Seaview Estates) with admin & sample data');
    console.log('   ✓ Additional tenants (Harbour Heights, Oakfield View)');
    console.log('   ✓ Multi-tenant database ready for development');
    console.log('\n🔗 Access portals:');
    console.log('   • Tenant Portal: http://localhost:5000');
    console.log('   • Developer Portal: http://localhost:3001');
    console.log('\n' + '='.repeat(50) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed process failed:', error);
    process.exit(1);
  }
}

seedAll();
