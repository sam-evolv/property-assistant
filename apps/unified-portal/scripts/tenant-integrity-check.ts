#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning';
}

const results: CheckResult[] = [];

function addResult(name: string, passed: boolean, message: string, severity: 'error' | 'warning' = 'error') {
  results.push({ name, passed, message, severity });
}

function scanDirectory(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    if (!fs.existsSync(currentDir)) return;
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') {
        continue;
      }
      
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

function checkDevRoutesBlocked(): void {
  const devRoutesDir = path.join(process.cwd(), 'app/api/dev');
  
  if (!fs.existsSync(devRoutesDir)) {
    addResult('dev-routes-exist', true, 'No /api/dev routes found', 'warning');
    return;
  }
  
  const routeFiles = scanDirectory(devRoutesDir, ['.ts', '.tsx']);
  let allProtected = true;
  const unprotectedRoutes: string[] = [];
  
  for (const file of routeFiles) {
    if (!file.includes('route.ts')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    const hasDevCheck = 
      content.includes('assertDevOnly') || 
      content.includes('isProductionEnvironment') ||
      content.includes("NODE_ENV === 'development'") ||
      content.includes('NODE_ENV !== "production"');
    
    if (!hasDevCheck) {
      allProtected = false;
      unprotectedRoutes.push(file);
    }
  }
  
  if (allProtected) {
    addResult('dev-routes-protected', true, `All ${routeFiles.length} dev routes have production guards`);
  } else {
    addResult('dev-routes-protected', false, `Unprotected dev routes: ${unprotectedRoutes.join(', ')}`, 'error');
  }
}

function checkDashboardQueriesScoped(): void {
  const analyticsDir = path.join(process.cwd(), 'app/api/analytics');
  
  if (!fs.existsSync(analyticsDir)) {
    addResult('dashboard-queries-scoped', true, 'No analytics routes found', 'warning');
    return;
  }
  
  const routeFiles = scanDirectory(analyticsDir, ['.ts']);
  let allScoped = true;
  const unscopedRoutes: string[] = [];
  
  for (const file of routeFiles) {
    if (!file.includes('route.ts')) continue;
    
    const isPlatformRoute = file.includes('/platform/');
    if (isPlatformRoute) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    
    const hasMultipleQueries = (content.match(/db\.execute|db\.select/g) || []).length > 0;
    if (!hasMultipleQueries) continue;
    
    const hasTenantScope = 
      content.includes('tenant_id') || 
      content.includes('tenantId') ||
      content.includes('enforceTenantScope');
    
    const hasDevelopmentScope = 
      content.includes('development_id') || 
      content.includes('developmentId') ||
      content.includes('enforceDevelopmentScope');
    
    const hasOrganisationScope =
      content.includes('organisation_id') ||
      content.includes('organisationId');
    
    if (!hasTenantScope && !hasDevelopmentScope && !hasOrganisationScope) {
      allScoped = false;
      unscopedRoutes.push(file);
    }
  }
  
  if (allScoped) {
    addResult('dashboard-queries-scoped', true, 'All analytics queries are properly scoped (tenant/development/organisation)');
  } else {
    addResult('dashboard-queries-scoped', false, `Unscoped analytics routes: ${unscopedRoutes.join(', ')}`, 'error');
  }
}

function checkNoHardcodedLogos(): void {
  const libDir = path.join(process.cwd(), 'lib');
  const componentsDir = path.join(process.cwd(), 'components');
  
  const filesToCheck = [
    ...scanDirectory(libDir, ['.ts', '.tsx']),
    ...scanDirectory(componentsDir, ['.ts', '.tsx']),
  ];
  
  const hardcodedPatterns = [
    /estate[_-]?logo.*=.*["'`]https?:\/\//gi,
    /logo[_-]?url.*=.*["'`]https?:\/\/.*\.(png|jpg|svg)/gi,
    /HARDCODED.*LOGO/gi,
  ];
  
  const violations: string[] = [];
  
  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, 'utf-8');
    
    for (const pattern of hardcodedPatterns) {
      if (pattern.test(content)) {
        violations.push(file);
        break;
      }
    }
  }
  
  if (violations.length === 0) {
    addResult('no-hardcoded-logos', true, 'No hardcoded estate logos found');
  } else {
    addResult('no-hardcoded-logos', false, `Hardcoded logos in: ${violations.join(', ')}`, 'warning');
  }
}

function checkUnitIdUsage(): void {
  const chatRoute = path.join(process.cwd(), 'app/api/chat/route.ts');
  
  if (!fs.existsSync(chatRoute)) {
    addResult('unit-id-persistence', false, 'Chat route not found', 'error');
    return;
  }
  
  const content = fs.readFileSync(chatRoute, 'utf-8');
  
  const hasActualUnitId = content.includes('actualUnitId');
  const persistCalls = (content.match(/persistMessageSafely\s*\(/g) || []).length;
  const unitIdInPersist = (content.match(/unit_id:\s*actualUnitId/g) || []).length;
  const requireUnitIdCalls = (content.match(/require_unit_id:\s*true/g) || []).length;
  
  if (!hasActualUnitId) {
    addResult('unit-id-persistence', false, 'actualUnitId variable not found in chat route', 'error');
  } else if (unitIdInPersist === 0) {
    addResult('unit-id-persistence', false, 'persistMessageSafely calls do not include unit_id', 'error');
  } else {
    addResult('unit-id-persistence', true, `Found ${unitIdInPersist} persistMessageSafely calls with unit_id (${requireUnitIdCalls} enforced)`);
  }
}

function checkNoHouseIdInQueries(): void {
  const apiDir = path.join(process.cwd(), 'app/api');
  const routeFiles = scanDirectory(apiDir, ['.ts']);
  
  const violations: string[] = [];
  
  for (const file of routeFiles) {
    if (!file.includes('route.ts')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    
    const hasHouseIdQuery = /\.house_id|house_id\s*=|WHERE\s+house_id|messages\.house_id/gi.test(content);
    
    if (hasHouseIdQuery) {
      violations.push(file);
    }
  }
  
  if (violations.length === 0) {
    addResult('no-house-id-queries', true, 'No deprecated house_id queries found in API routes');
  } else {
    addResult('no-house-id-queries', false, `Deprecated house_id usage in: ${violations.join(', ')}`, 'error');
  }
}

async function main() {
  console.log('\n===========================================');
  console.log('  TENANT INTEGRITY CHECK');
  console.log('===========================================\n');
  
  checkDevRoutesBlocked();
  checkDashboardQueriesScoped();
  checkNoHardcodedLogos();
  checkUnitIdUsage();
  checkNoHouseIdInQueries();
  
  console.log('\nResults:\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const result of results) {
    const icon = result.passed ? `${GREEN}✓${RESET}` : (result.severity === 'error' ? `${RED}✗${RESET}` : `${YELLOW}⚠${RESET}`);
    const status = result.passed ? 'PASS' : (result.severity === 'error' ? 'FAIL' : 'WARN');
    console.log(`  ${icon} [${status}] ${result.name}: ${result.message}`);
    
    if (!result.passed) {
      if (result.severity === 'error') hasErrors = true;
      else hasWarnings = true;
    }
  }
  
  console.log('\n===========================================');
  
  if (hasErrors) {
    console.log(`${RED}BUILD FAILED: Integrity checks failed${RESET}\n`);
    process.exit(1);
  } else if (hasWarnings) {
    console.log(`${YELLOW}BUILD OK with warnings${RESET}\n`);
    process.exit(0);
  } else {
    console.log(`${GREEN}BUILD OK: All integrity checks passed${RESET}\n`);
    process.exit(0);
  }
}

main().catch((error) => {
  console.error(`${RED}Integrity check error:${RESET}`, error);
  process.exit(1);
});
