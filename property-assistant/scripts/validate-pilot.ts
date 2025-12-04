import { db } from '@openhouse/db/client';
import { tenants, developments, homeowners, admins, documents } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * PHASE 16: Pilot Validation Script
 * Validates that all components are properly configured for Longview Park
 */

interface ValidationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
  }>;
}

const results: ValidationResult[] = [];

async function main() {
  console.log('🔍 PHASE 16: Longview Park Pilot Validation');
  console.log('============================================\n');

  await validateTenantSetup();
  await validateDevelopmentSetup();
  await validateHousesAndQRCodes();
  await validateStaffAccounts();
  await validateQRCodeFiles();
  await validateDocuments();
  await validateEnvironmentVariables();

  printResults();
}

async function validateTenantSetup() {
  const category = 'Tenant Configuration';
  const checks: ValidationResult['checks'] = [];

  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, 'longview-estates'),
    });

    if (tenant) {
      checks.push({
        name: 'Tenant exists',
        status: 'PASS',
        message: `Longview Estates found (ID: ${tenant.id.substring(0, 8)}...)`,
      });

      if (tenant.theme_color) {
        checks.push({
          name: 'Theme configured',
          status: 'PASS',
          message: `Theme color: ${tenant.theme_color}`,
        });
      } else {
        checks.push({
          name: 'Theme configured',
          status: 'WARN',
          message: 'No theme color set',
        });
      }

      const brandData = tenant.brand as any;
      if (brandData?.companyName) {
        checks.push({
          name: 'Brand data',
          status: 'PASS',
          message: `Company: ${brandData.companyName}`,
        });
      } else {
        checks.push({
          name: 'Brand data',
          status: 'WARN',
          message: 'Brand data incomplete',
        });
      }
    } else {
      checks.push({
        name: 'Tenant exists',
        status: 'FAIL',
        message: 'Longview Estates tenant not found! Run: npm run seed:longview',
      });
    }
  } catch (error) {
    checks.push({
      name: 'Database connection',
      status: 'FAIL',
      message: `Error: ${error}`,
    });
  }

  results.push({ category, checks });
}

async function validateDevelopmentSetup() {
  const category = 'Development Configuration';
  const checks: ValidationResult['checks'] = [];

  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
  });

  if (development) {
    checks.push({
      name: 'Development exists',
      status: 'PASS',
      message: 'Longview Park found',
    });

    if (development.system_instructions && development.system_instructions.length > 100) {
      checks.push({
        name: 'AI instructions',
        status: 'PASS',
        message: `${development.system_instructions.length} characters`,
      });
    } else {
      checks.push({
        name: 'AI instructions',
        status: 'WARN',
        message: 'System instructions missing or too short',
      });
    }

    if (development.description) {
      checks.push({
        name: 'Development description',
        status: 'PASS',
        message: 'Description present',
      });
    }
  } else {
    checks.push({
      name: 'Development exists',
      status: 'FAIL',
      message: 'Longview Park not found',
    });
  }

  results.push({ category, checks });
}

async function validateHousesAndQRCodes() {
  const category = 'Houses & QR Tokens';
  const checks: ValidationResult['checks'] = [];

  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
  });

  if (!development) {
    checks.push({
      name: 'Houses check',
      status: 'FAIL',
      message: 'Cannot check houses - development not found',
    });
    results.push({ category, checks });
    return;
  }

  const houses = await db.query.homeowners.findMany({
    where: eq(homeowners.development_id, development.id),
  });

  if (houses.length > 0) {
    checks.push({
      name: 'Houses created',
      status: 'PASS',
      message: `${houses.length} houses found`,
    });

    const housesWithQR = houses.filter(h => h.unique_qr_token);
    if (housesWithQR.length === houses.length) {
      checks.push({
        name: 'QR tokens assigned',
        status: 'PASS',
        message: `All ${houses.length} houses have QR tokens`,
      });
    } else {
      checks.push({
        name: 'QR tokens assigned',
        status: 'FAIL',
        message: `Only ${housesWithQR.length}/${houses.length} houses have QR tokens`,
      });
    }

    const houseTypes = new Set(houses.map(h => h.house_type).filter(Boolean));
    checks.push({
      name: 'House types',
      status: 'PASS',
      message: `${houseTypes.size} types: ${Array.from(houseTypes).join(', ')}`,
    });

    // Validate structured metadata
    const housesWithMetadata = houses.filter(h => {
      const meta = h.metadata as any;
      return meta?.houseNumber && meta?.lotNumber && typeof meta?.onboardingCompleted === 'boolean';
    });
    
    if (housesWithMetadata.length === houses.length) {
      checks.push({
        name: 'House metadata structure',
        status: 'PASS',
        message: 'All houses have structured metadata (houseNumber, lotNumber, onboardingCompleted)',
      });
    } else {
      checks.push({
        name: 'House metadata structure',
        status: 'FAIL',
        message: `Only ${housesWithMetadata.length}/${houses.length} houses have complete structured metadata`,
      });
    }

    // Check onboarding setup
    const housesWithPlaceholderEmails = houses.filter(h => 
      h.email?.includes('@pending.onboarding')
    );
    
    if (housesWithPlaceholderEmails.length > 0) {
      checks.push({
        name: 'Onboarding setup',
        status: 'PASS',
        message: `${housesWithPlaceholderEmails.length} houses awaiting onboarding (placeholder emails)`,
      });
    } else {
      checks.push({
        name: 'Onboarding setup',
        status: 'WARN',
        message: 'No placeholder emails found - check onboarding flow',
      });
    }
  } else {
    checks.push({
      name: 'Houses created',
      status: 'FAIL',
      message: 'No houses found for Longview Park',
    });
  }

  results.push({ category, checks });
}

async function validateStaffAccounts() {
  const category = 'Developer Staff Accounts';
  const checks: ValidationResult['checks'] = [];

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, 'longview-estates'),
  });

  if (!tenant) {
    checks.push({
      name: 'Staff accounts',
      status: 'FAIL',
      message: 'Cannot check - tenant not found',
    });
    results.push({ category, checks });
    return;
  }

  const staffAccounts = await db.query.admins.findMany({
    where: and(
      eq(admins.tenant_id, tenant.id),
      eq(admins.role, 'developer')
    ),
  });

  if (staffAccounts.length > 0) {
    checks.push({
      name: 'Developer accounts',
      status: 'PASS',
      message: `${staffAccounts.length} staff accounts created`,
    });

    staffAccounts.forEach(staff => {
      checks.push({
        name: `Account: ${staff.email}`,
        status: 'PASS',
        message: 'Ready for login',
      });
    });
  } else {
    checks.push({
      name: 'Developer accounts',
      status: 'WARN',
      message: 'No developer staff accounts found',
    });
  }

  results.push({ category, checks });
}

async function validateQRCodeFiles() {
  const category = 'QR Code Files';
  const checks: ValidationResult['checks'] = [];

  const qrDir = join(process.cwd(), 'attached_assets', 'qrs');
  
  if (existsSync(qrDir)) {
    checks.push({
      name: 'QR directory',
      status: 'PASS',
      message: `Directory exists: ${qrDir}`,
    });

    const manifestPath = join(qrDir, 'qr-manifest.json');
    if (existsSync(manifestPath)) {
      checks.push({
        name: 'QR manifest',
        status: 'PASS',
        message: 'Manifest file found',
      });
    } else {
      checks.push({
        name: 'QR manifest',
        status: 'WARN',
        message: 'Manifest not found - run: npm run generate:qrs',
      });
    }

    const readmePath = join(qrDir, 'QR_CODES_README.md');
    if (existsSync(readmePath)) {
      checks.push({
        name: 'QR documentation',
        status: 'PASS',
        message: 'README generated',
      });
    }
  } else {
    checks.push({
      name: 'QR directory',
      status: 'FAIL',
      message: 'QR codes not generated - run: npm run generate:qrs',
    });
  }

  results.push({ category, checks });
}

async function validateDocuments() {
  const category = 'Documents & Embeddings';
  const checks: ValidationResult['checks'] = [];

  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
    with: {
      documents: true,
    },
  });

  if (!development) {
    checks.push({
      name: 'Documents',
      status: 'FAIL',
      message: 'Cannot check - development not found',
    });
    results.push({ category, checks });
    return;
  }

  if (development.documents && development.documents.length > 0) {
    checks.push({
      name: 'Documents uploaded',
      status: 'PASS',
      message: `${development.documents.length} documents found`,
    });
  } else {
    checks.push({
      name: 'Documents uploaded',
      status: 'WARN',
      message: 'No documents uploaded yet - Upload via Developer Portal',
    });
  }

  results.push({ category, checks });
}

async function validateEnvironmentVariables() {
  const category = 'Environment Configuration';
  const checks: ValidationResult['checks'] = [];

  const requiredVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
  ];

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      checks.push({
        name: varName,
        status: 'PASS',
        message: 'Set',
      });
    } else {
      checks.push({
        name: varName,
        status: 'FAIL',
        message: 'Missing - check .env file',
      });
    }
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.APP_BASE_URL;
  if (baseUrl) {
    checks.push({
      name: 'App Base URL',
      status: 'PASS',
      message: baseUrl,
    });
  } else {
    checks.push({
      name: 'App Base URL',
      status: 'WARN',
      message: 'Not set (NEXT_PUBLIC_APP_BASE_URL or APP_BASE_URL) - QR codes will use fallback',
    });
  }

  results.push({ category, checks });
}

function printResults() {
  console.log('\n\n📊 VALIDATION RESULTS');
  console.log('====================\n');

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  let warnings = 0;

  results.forEach(({ category, checks }) => {
    console.log(`\n📋 ${category}`);
    console.log('─'.repeat(50));

    checks.forEach(check => {
      totalChecks++;
      const icon = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '⚠';
      const color = check.status === 'PASS' ? '' : check.status === 'FAIL' ? '' : '';
      
      console.log(`  ${icon} ${check.name}: ${check.message}`);

      if (check.status === 'PASS') passedChecks++;
      else if (check.status === 'FAIL') failedChecks++;
      else warnings++;
    });
  });

  console.log('\n' + '═'.repeat(50));
  console.log(`\n📈 Summary: ${passedChecks}/${totalChecks} checks passed`);
  if (warnings > 0) console.log(`⚠️  Warnings: ${warnings}`);
  if (failedChecks > 0) console.log(`❌ Failures: ${failedChecks}`);

  if (failedChecks === 0 && warnings === 0) {
    console.log('\n🎉 ALL CHECKS PASSED! Pilot is ready for deployment.');
  } else if (failedChecks === 0) {
    console.log('\n✅ No critical failures. Review warnings before deployment.');
  } else {
    console.log('\n⚠️  Critical issues found. Fix failures before deployment.');
  }

  console.log('\n');
  process.exit(failedChecks > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Validation error:', error);
  process.exit(1);
});
