import QRCode from 'qrcode';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { db } from '@openhouse/db/client';
import { homeowners, developments, tenants } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PHASE 16: Generate QR Codes for Longview Park
 * Creates QR codes for each house linking to the onboarding URL
 */

// Use environment variable for base URL (staging vs production)
const BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL || 'https://app.openhouseai.ie';
const OUTPUT_DIR = join(process.cwd(), 'attached_assets', 'qrs');
const DEVELOPMENT_NAME = 'Longview Park';

interface QRCodeData {
  house_id: string;
  house_number: string;
  qr_uid: string;
  onboarding_url: string;
  file_path: string;
  house_type: string;
  address: string;
}

async function main() {
  console.log('🎯 PHASE 16: QR Code Generation for Longview Park');
  console.log('=================================================\n');

  // Find the development
  console.log('📍 Looking up Longview Park development...');
  const development = await db.query.developments.findFirst({
    where: eq(developments.name, DEVELOPMENT_NAME),
    with: {
      tenant: true,
    },
  });

  if (!development) {
    console.error(`❌ Development "${DEVELOPMENT_NAME}" not found`);
    console.log('\n💡 Run the seed script first: npm run seed:longview');
    process.exit(1);
  }

  console.log(`✓ Found: ${development.name}`);
  console.log(`   Tenant: ${development.tenant.name}\n`);

  // Fetch all houses for this development
  console.log('🏠 Fetching houses...');
  const houses = await db.query.homeowners.findMany({
    where: eq(homeowners.development_id, development.id),
    orderBy: (homeowners, { asc }) => [asc(homeowners.metadata)],
  });

  if (houses.length === 0) {
    console.error('❌ No houses found for this development');
    process.exit(1);
  }

  console.log(`✓ Found ${houses.length} houses\n`);

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`✓ Created output directory: ${OUTPUT_DIR}\n`);
  }

  // QR code options
  const qrOptions = {
    errorCorrectionLevel: 'H' as const,
    type: 'png' as const,
    width: 600,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  };

  // Generate QR codes
  console.log('🎨 Generating QR codes...\n');
  const qrData: QRCodeData[] = [];

  for (const house of houses) {
    const qrToken = house.unique_qr_token;
    
    if (!qrToken) {
      console.warn(`⚠️  House ${house.id} has no QR token, skipping...`);
      continue;
    }

    const metadata = house.metadata as { houseNumber?: string; lotNumber?: string } || {};
    const houseNumber = metadata.houseNumber || house.id.substring(0, 8);
    const onboardingUrl = `${BASE_URL}/onboarding/${qrToken}`;
    // Use house ID for deterministic filenames to prevent overwrites
    const filename = `house_${house.id}.png`;
    const filepath = join(OUTPUT_DIR, filename);

    try {
      // Generate QR code
      await QRCode.toFile(filepath, onboardingUrl, qrOptions);
      
      qrData.push({
        house_id: house.id,
        house_number: houseNumber,
        qr_uid: qrToken,
        onboarding_url: onboardingUrl,
        file_path: filepath,
        house_type: house.house_type || 'Unknown',
        address: house.address || 'N/A',
      });

      console.log(`✓ House ${houseNumber.padEnd(3)} (Type ${house.house_type}) - ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate QR for house ${houseNumber}:`, error);
    }
  }

  // Generate summary JSON
  console.log('\n📄 Creating summary manifest...');
  const summaryPath = join(OUTPUT_DIR, 'qr-manifest.json');
  const summary = {
    generated_at: new Date().toISOString(),
    development: {
      id: development.id,
      name: development.name,
      tenant: development.tenant.name,
    },
    base_url: BASE_URL,
    environment: process.env.NODE_ENV || 'development',
    total_houses: houses.length,
    qr_codes_generated: qrData.length,
    houses: qrData,
  };

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✓ Manifest saved: ${summaryPath}`);

  // Generate markdown documentation
  console.log('\n📋 Creating QR documentation...');
  const mdPath = join(OUTPUT_DIR, 'QR_CODES_README.md');
  const markdown = generateMarkdownDoc(summary, qrData);
  writeFileSync(mdPath, markdown);
  console.log(`✓ Documentation saved: ${mdPath}`);

  // Print summary
  console.log('\n✅ QR CODE GENERATION COMPLETE!');
  console.log('================================');
  console.log(`Total QR Codes: ${qrData.length}`);
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log(`Manifest: qr-manifest.json`);
  console.log(`Documentation: QR_CODES_README.md`);
  
  console.log('\n📊 Breakdown by House Type:');
  const typeCount: Record<string, number> = {};
  qrData.forEach((house) => {
    typeCount[house.house_type] = (typeCount[house.house_type] || 0) + 1;
  });
  Object.entries(typeCount).forEach(([type, count]) => {
    console.log(`   Type ${type}: ${count} houses`);
  });

  console.log('\n📋 Next Steps:');
  console.log('   1. Review generated QR codes in attached_assets/qrs/');
  console.log('   2. Print QR codes for each house');
  console.log('   3. Include QR codes in welcome packs');
  console.log('   4. Test onboarding URL with a sample QR code');
  console.log('   5. Verify JWT generation and portal access\n');

  process.exit(0);
}

function generateMarkdownDoc(summary: any, qrData: QRCodeData[]): string {
  return `# Longview Park - QR Codes & Onboarding

**Generated:** ${new Date(summary.generated_at).toLocaleString()}  
**Development:** ${summary.development.name}  
**Tenant:** ${summary.development.tenant}  
**Environment:** ${summary.environment}  
**Base URL:** ${summary.base_url}  
**Total Houses:** ${summary.total_houses}

---

## Overview

This directory contains QR codes for all houses in Longview Park. Each QR code links to a unique onboarding URL that:

1. Authenticates the homeowner via JWT
2. Grants access to their property-specific information
3. Enables the AI chat assistant
4. Provides access to documents and resources

---

## QR Code List

| House # | Type | Address | QR File | Onboarding URL |
|---------|------|---------|---------|----------------|
${qrData.map(h => `| ${h.house_number} | ${h.house_type} | ${h.address.split(',')[0]} | \`${h.file_path.split('/').pop()}\` | [Link](${h.onboarding_url}) |`).join('\n')}

---

## Usage Instructions

### For Homeowners

1. **Scan the QR code** using your smartphone camera
2. **Open the link** in your browser
3. **Complete onboarding** - Enter your name and email
4. **Access your home portal** - Chat with AI, view documents, check notices

### For Developers/Staff

1. **Print QR codes** - Include in homeowner welcome packs
2. **Test onboarding** - Scan a QR code to verify the flow
3. **Monitor usage** - Track onboarding completion rates
4. **Support homeowners** - Help with any technical issues

---

## Technical Details

- **Base URL:** ${summary.base_url}
- **Environment:** ${summary.environment}
- **QR Format:** PNG, 600x600px, Error Correction Level H
- **Authentication:** Supabase magic link with unique QR tokens
- **Security:** Tokens are UUIDs, not guessable
- **Onboarding Flow:** Scan QR → Enter email → Receive magic link → Access portal

---

## Troubleshooting

**QR code doesn't scan:**
- Ensure good lighting
- Hold phone steady 6-12 inches away
- Try a different QR scanner app

**Onboarding link doesn't work:**
- Check internet connection
- Verify the URL starts with ${summary.base_url}
- Contact support: info@longviewestates.ie

**Access denied after onboarding:**
- Clear browser cache and cookies
- Try scanning the QR code again
- Contact technical support

---

## Support

For technical support or questions:
- **Email:** info@longviewestates.ie
- **Phone:** +353 41 987 6543

---

Generated by OpenHouse AI - Phase 16 Pilot Deployment
`;
}

main().catch((error) => {
  console.error('❌ Error generating QR codes:', error);
  process.exit(1);
});
