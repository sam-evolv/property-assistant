#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

async function testIntelPipeline() {
  console.log('='.repeat(80));
  console.log('DOCUMENT INTELLIGENCE PIPELINE TEST');
  console.log('='.repeat(80));
  console.log('');

  const checks = {
    tables: false,
    profiles: false,
    extractions: false,
    chat: false,
  };

  console.log('1. CHECKING DATABASE TABLES');
  console.log('-'.repeat(80));
  
  try {
    const profileTableCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM unit_intelligence_profiles
    `);
    console.log(`✅ unit_intelligence_profiles table exists (${profileTableCheck.rows[0].count} records)`);

    const extractionTableCheck = await db.execute(sql`
      SELECT COUNT(*) as count FROM intel_extractions
    `);
    console.log(`✅ intel_extractions table exists (${extractionTableCheck.rows[0].count} records)`);
    
    checks.tables = true;
  } catch (error) {
    console.log(`❌ Database tables not found: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('');
  console.log('2. CHECKING INTELLIGENCE PROFILES');
  console.log('-'.repeat(80));

  try {
    const profiles = await db.execute(sql`
      SELECT 
        p.id,
        p.development_id,
        p.house_type_code,
        p.version,
        p.quality_score,
        p.is_current,
        d.name as development_name
      FROM unit_intelligence_profiles p
      LEFT JOIN developments d ON d.id = p.development_id
      WHERE p.is_current = true
      ORDER BY p.created_at DESC
      LIMIT 10
    `);

    if (profiles.rows.length > 0) {
      console.log(`Found ${profiles.rows.length} active profiles:`);
      for (const profile of profiles.rows) {
        const confidence = profile.quality_score ? ((profile.quality_score as number) * 100).toFixed(0) : 'N/A';
        console.log(`  - ${profile.development_name} / ${profile.house_type_code} (v${profile.version}, ${confidence}% quality)`);
      }
      checks.profiles = true;
    } else {
      console.log('⚠️ No intelligence profiles found yet');
      console.log('   Run document reprocessing to generate profiles');
    }
  } catch (error) {
    console.log(`❌ Profile check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('');
  console.log('3. CHECKING EXTRACTION AUDIT TRAIL');
  console.log('-'.repeat(80));

  try {
    const extractions = await db.execute(sql`
      SELECT 
        extraction_method,
        COUNT(*) as count,
        SUM(cost_cents) as total_cost_cents
      FROM intel_extractions
      GROUP BY extraction_method
      ORDER BY count DESC
    `);

    if (extractions.rows.length > 0) {
      console.log('Extraction methods used:');
      for (const row of extractions.rows) {
        const totalCost = row.total_cost_cents ? `$${((row.total_cost_cents as number) / 100).toFixed(4)}` : '$0';
        console.log(`  - ${row.extraction_method}: ${row.count} extractions (${totalCost} cost)`);
      }
      checks.extractions = true;
    } else {
      console.log('⚠️ No extractions logged yet');
      checks.extractions = true;
    }
  } catch (error) {
    console.log(`❌ Extraction check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('');
  console.log('4. CHECKING CHAT LAYER USAGE');
  console.log('-'.repeat(80));

  try {
    const chatMessages = await db.execute(sql`
      SELECT 
        metadata->>'source' as source,
        COUNT(*) as count
      FROM messages
      WHERE metadata->>'source' IS NOT NULL
      GROUP BY metadata->>'source'
      ORDER BY count DESC
    `);

    if (chatMessages.rows.length > 0) {
      console.log('Chat answer sources:');
      for (const row of chatMessages.rows) {
        console.log(`  - ${row.source || 'rag'}: ${row.count} messages`);
      }
      checks.chat = true;
    } else {
      console.log('⚠️ No chat messages with source tracking yet');
    }
  } catch (error) {
    console.log(`❌ Chat check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('');
  console.log('5. SAMPLE PROFILE DATA');
  console.log('-'.repeat(80));

  try {
    const sampleProfile = await db.execute(sql`
      SELECT 
        p.house_type_code,
        p.rooms,
        p.suppliers,
        p.ber_rating,
        p.heating,
        p.extraction_passes,
        d.name as development_name
      FROM unit_intelligence_profiles p
      LEFT JOIN developments d ON d.id = p.development_id
      WHERE p.is_current = true
      AND (
        p.rooms IS NOT NULL 
        OR p.suppliers IS NOT NULL 
        OR p.ber_rating IS NOT NULL
      )
      LIMIT 1
    `);

    if (sampleProfile.rows.length > 0) {
      const profile = sampleProfile.rows[0];
      console.log(`Sample: ${profile.development_name} / ${profile.house_type_code}`);
      
      if (profile.rooms) {
        const rooms = profile.rooms as Record<string, any>;
        const roomKeys = Object.keys(rooms);
        console.log(`  Rooms (${roomKeys.length}): ${roomKeys.slice(0, 5).join(', ')}${roomKeys.length > 5 ? '...' : ''}`);
      }
      
      if (profile.suppliers) {
        const suppliers = profile.suppliers as Record<string, any>;
        const supplierKeys = Object.keys(suppliers);
        console.log(`  Suppliers (${supplierKeys.length}): ${supplierKeys.slice(0, 5).join(', ')}${supplierKeys.length > 5 ? '...' : ''}`);
      }
      
      console.log(`  Specs: BER=${profile.ber_rating || 'N/A'}, Heating=${profile.heating || 'N/A'}`);
      
      if (profile.extraction_passes) {
        const passes = profile.extraction_passes as Array<any>;
        console.log(`  Extraction passes: ${passes.length} (${passes.map((p: any) => p.method).join(', ')})`);
      }
    } else {
      console.log('⚠️ No profiles with extracted data found');
    }
  } catch (error) {
    console.log(`❌ Sample profile check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  
  const passCount = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;
  
  console.log(`Checks passed: ${passCount}/${totalChecks}`);
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  }
  
  if (passCount === totalChecks) {
    console.log('\n🎉 Document Intelligence Pipeline is fully operational!');
  } else if (passCount >= 2) {
    console.log('\n⚠️ Pipeline is partially set up. Run document reprocessing to populate data.');
  } else {
    console.log('\n❌ Pipeline needs setup. Check database migrations.');
  }

  console.log('');
  process.exit(passCount >= 2 ? 0 : 1);
}

testIntelPipeline().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
