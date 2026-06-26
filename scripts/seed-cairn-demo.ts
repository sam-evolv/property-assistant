/**
 * seed-cairn-demo.ts
 *
 * One-off, ADDITIVE, IDEMPOTENT, REVERSIBLE seed of an isolated Cairn demo tenant
 * and one fully populated demo home, so the homeowner assistant can run the Cairn
 * demo on the unified-portal Supabase project (ref mddxbilpjukwskeefakz).
 *
 * Guarantees:
 *   - INSERT only. It never UPDATEs or DELETEs any existing row.
 *   - Idempotent. Every row is looked up by a natural key before insert, so running
 *     it twice neither duplicates nor errors. The auth user is found by email.
 *   - Reversible. On completion it prints a teardown SQL block keyed on the new
 *     tenant id, plus the one manual step (deleting the auth user).
 *
 * It is deliberately NOT run as part of any build or deploy. You run it yourself,
 * once, against production, after reading it:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=...  (or SUPABASE_URL=...)
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   SEED_DEMO_PASSWORD=...        (optional, falls back to a clearly-marked default)
 *   CAIRN_LOGO_URL=...            (optional, sets the Cairn tenant and development logo)
 *   CAIRN_SEED_JSON=...           (optional, path to the energy dataset; default below)
 *
 *   npx tsx scripts/seed-cairn-demo.ts
 *
 * The home dataset is loaded verbatim from cairn-demo-energy-seed.json (repo root by
 * default) and stored whole under units.metadata.demo_home.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Tunable constants (safe to edit before you run)
// ---------------------------------------------------------------------------

// Status for the occupied, sold, post-handover demo home. Confirmed against the
// live distinct values in units.unit_status. Alternatives: 'occupied', 'sold'.
const UNIT_STATUS = 'handed_over';

// The Cairn project must reference a row in the organisations table (NOT NULL FK
// projects.organization_id -> organisations.id). The verified Longview pattern is
// that a developer owns a tenants row and an organisations row sharing one id, so
// we reuse the new tenant id for the organisation. Set to false to mint a separate
// organisation id instead (teardown then has to track two ids).
const ORG_SHARES_TENANT_ID = true;

// Tenant
const TENANT_NAME = 'Cairn Homes';
const TENANT_SLUG = 'cairn-homes-demo';

// Development
const DEV_NAME = 'Bayly';
const DEV_CODE = 'BAYLY';
const DEV_SLUG = 'bayly-douglas';
const DEV_PROJECT_TYPE = 'bts';

// Unit (the demo home)
const UNIT_ADDRESS = '34 Bayly, Douglas, Co. Cork';
const UNIT_NUMBER = '34';
const UNIT_CODE = '034';
const UNIT_HANDOVER_DATE = '2025-02-14';
const UNIT_HOUSE_TYPE_CODE = 'BAYLY-3B';
const UNIT_BEDROOMS = 3;
const UNIT_BATHROOMS = 3;
const UNIT_FLOOR_AREA_M2 = 118;
const UNIT_MRPN = '10003456789';
const UNIT_ELECTRICITY_ACCOUNT = 'DEMO-EA-0034';
const UNIT_ESB_EIRGRID_NUMBER = '10003456789';
const UNIT_CONSENT_AT = '2025-02-14T10:00:00Z';

// Homeowner login
const DEMO_EMAIL = 'cairn-demo@openhouseai.ie';
// Clearly-marked fallback. Override with SEED_DEMO_PASSWORD. Change after the demo.
const DEFAULT_DEMO_PASSWORD = 'ChangeMe-CairnDemo-2026!';

// user_contexts display copy (per brief; note Longview uses the full address here)
const CONTEXT_DISPLAY_NAME = '34 Bayly';
const CONTEXT_DISPLAY_SUBTITLE = 'Bayly';

// Devices fitted to the home. All system_type values pass the live
// unit_systems_system_type_check constraint.
const UNIT_SYSTEMS = [
  {
    system_type: 'heat_pump',
    make: 'Mitsubishi',
    model: 'Ecodan PUZ-WM85VAA',
    key_settings: { flow_temp_c: 40, dhw_target_c: 50, design_spf: 3.2 },
  },
  {
    system_type: 'solar_pv',
    make: 'SolarEdge',
    model: 'HD-Wave SE3680H',
    key_settings: { array_kwp: 4.0, panels: 10, battery: false },
  },
  {
    system_type: 'ev_charger',
    make: 'myenergi',
    model: 'Zappi v2',
    key_settings: { rating_kw: 7.4, mode: 'fast' },
  },
  {
    system_type: 'mvhr',
    make: 'Zehnder',
    model: 'ComfoAir Q350',
    key_settings: { mode: 'continuous' },
  },
] as const;

// ---------------------------------------------------------------------------
// Environment and client
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CAIRN_LOGO_URL = process.env.CAIRN_LOGO_URL || null;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD;
const SEED_JSON_PATH = process.env.CAIRN_SEED_JSON || join(process.cwd(), 'cairn-demo-energy-seed.json');

function requireEnv(): { url: string; key: string } {
  if (!SUPABASE_URL) {
    throw new Error(
      'Missing Supabase URL. Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in the environment.',
    );
  }
  if (!SERVICE_KEY) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. The service role is required for the inserts and the auth admin API.',
    );
  }
  return { url: SUPABASE_URL, key: SERVICE_KEY };
}

function loadDemoHome(): unknown {
  try {
    return JSON.parse(readFileSync(SEED_JSON_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Could not read the energy dataset at ${SEED_JSON_PATH}. ` +
        'Place cairn-demo-energy-seed.json at the repo root, or set CAIRN_SEED_JSON to its path. ' +
        `Underlying error: ${(err as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Select the first row of `table` matching every key in `match`, or null. */
async function findOne(
  admin: SupabaseClient,
  table: string,
  match: Record<string, unknown>,
): Promise<{ id: string } | null> {
  let query = admin.from(table).select('id');
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value as never);
  }
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`Lookup on ${table} failed: ${error.message}`);
  return data && data.length ? (data[0] as { id: string }) : null;
}

async function insertReturningId(
  admin: SupabaseClient,
  table: string,
  row: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin.from(table).insert(row).select('id').single();
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  return (data as { id: string }).id;
}

/** Find an auth user by email, paging through the admin list. */
async function findAuthUserByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<{ id: string; email?: string } | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`auth.admin.listUsers failed: ${error.message}`);
    const match = data.users.find((u) => (u.email || '').toLowerCase() === target);
    if (match) return { id: match.id, email: match.email ?? undefined };
    if (data.users.length < perPage) return null;
  }
  return null;
}

type State = 'created' | 'existing';
const mark = (created: boolean): State => (created ? 'created' : 'existing');

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { url, key } = requireEnv();
  const demoHome = loadDemoHome();

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report: Record<string, State> = {};

  // 0. Auth user (must exist before the unit and the user context reference it).
  let authUser = await findAuthUserByEmail(admin, DEMO_EMAIL);
  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {},
    });
    if (error) {
      // Tolerate a race where the user already exists.
      if (/already|registered|exists/i.test(error.message)) {
        authUser = await findAuthUserByEmail(admin, DEMO_EMAIL);
        if (!authUser) throw new Error(`auth.admin.createUser failed: ${error.message}`);
        report.authUser = 'existing';
      } else {
        throw new Error(`auth.admin.createUser failed: ${error.message}`);
      }
    } else {
      authUser = { id: data.user.id, email: data.user.email ?? undefined };
      report.authUser = 'created';
    }
  } else {
    report.authUser = 'existing';
  }
  const userId = authUser.id;

  // 1. Tenant (looked up by its unique slug).
  let tenantId: string;
  const existingTenant = await findOne(admin, 'tenants', { slug: TENANT_SLUG });
  if (existingTenant) {
    tenantId = existingTenant.id;
    report.tenant = 'existing';
  } else {
    tenantId = randomUUID();
    await insertReturningId(admin, 'tenants', {
      id: tenantId,
      name: TENANT_NAME,
      slug: TENANT_SLUG,
      tenant_type: 'developer',
      logo_url: CAIRN_LOGO_URL,
      primary_color: null,
      theme_color: null,
      installer_display_name: TENANT_NAME,
    });
    report.tenant = 'created';
  }

  // 2. Organisation (FK target for the project). Shares the tenant id by default.
  const orgId = ORG_SHARES_TENANT_ID ? tenantId : randomUUID();
  const existingOrg = await findOne(admin, 'organisations', { id: orgId });
  if (existingOrg) {
    report.organisation = 'existing';
  } else {
    // When the org id is shared with the tenant we must not collide with any other
    // organisation, so a fresh random id is only used when ORG_SHARES_TENANT_ID is
    // false. Either way we insert with the chosen id.
    await admin.from('organisations').insert({ id: orgId, name: TENANT_NAME }).throwOnError();
    report.organisation = 'created';
  }

  // 3. Development (looked up by tenant + slug).
  let developmentId: string;
  const existingDev = await findOne(admin, 'developments', {
    tenant_id: tenantId,
    slug: DEV_SLUG,
  });
  if (existingDev) {
    developmentId = existingDev.id;
    report.development = 'existing';
  } else {
    developmentId = randomUUID();
    await insertReturningId(admin, 'developments', {
      id: developmentId,
      tenant_id: tenantId,
      name: DEV_NAME,
      code: DEV_CODE,
      slug: DEV_SLUG,
      project_type: DEV_PROJECT_TYPE,
      logo_url: CAIRN_LOGO_URL,
      is_active: true,
    });
    report.development = 'created';
  }

  // 4. Project (owned by the Cairn organisation; mirrors Longview where the project
  //    name equals the development name and development_id is left null).
  let projectId: string;
  const existingProject = await findOne(admin, 'projects', {
    organization_id: orgId,
    name: DEV_NAME,
  });
  if (existingProject) {
    projectId = existingProject.id;
    report.project = 'existing';
  } else {
    projectId = randomUUID();
    await insertReturningId(admin, 'projects', {
      id: projectId,
      organization_id: orgId,
      name: DEV_NAME,
      development_id: null,
    });
    report.project = 'created';
  }

  // 5. Unit (the demo home). Looked up by address within the Cairn tenant.
  let unitId: string;
  const existingUnit = await findOne(admin, 'units', {
    address: UNIT_ADDRESS,
    tenant_id: tenantId,
  });
  if (existingUnit) {
    unitId = existingUnit.id;
    report.unit = 'existing';
  } else {
    unitId = randomUUID();
    await insertReturningId(admin, 'units', {
      id: unitId,
      project_id: projectId,
      development_id: developmentId,
      tenant_id: tenantId,
      user_id: userId,
      address: UNIT_ADDRESS,
      unit_number: UNIT_NUMBER,
      unit_code: UNIT_CODE,
      tier: 'standard',
      unit_mode: 'sale',
      unit_status: UNIT_STATUS,
      handover_date: UNIT_HANDOVER_DATE,
      house_type_code: UNIT_HOUSE_TYPE_CODE,
      bedrooms: UNIT_BEDROOMS,
      bathrooms: UNIT_BATHROOMS,
      floor_area_m2: UNIT_FLOOR_AREA_M2,
      mrpn: UNIT_MRPN,
      electricity_account: UNIT_ELECTRICITY_ACCOUNT,
      esb_eirgrid_number: UNIT_ESB_EIRGRID_NUMBER,
      consent_at: UNIT_CONSENT_AT,
      metadata: { demo_home: demoHome },
    });
    report.unit = 'created';
  }

  // 6. Unit systems (one row per device). Looked up by unit + system_type.
  let systemsCreated = 0;
  let systemsExisting = 0;
  for (const system of UNIT_SYSTEMS) {
    const existingSystem = await findOne(admin, 'unit_systems', {
      unit_id: unitId,
      system_type: system.system_type,
    });
    if (existingSystem) {
      systemsExisting++;
      continue;
    }
    await admin
      .from('unit_systems')
      .insert({
        tenant_id: tenantId,
        unit_id: unitId,
        system_type: system.system_type,
        make: system.make,
        model: system.model,
        key_settings: system.key_settings,
      })
      .throwOnError();
    systemsCreated++;
  }
  report.unitSystems = systemsCreated > 0 ? 'created' : 'existing';

  // 7. User context (homeowner routing row). Unique on (auth_user_id, context_type,
  //    context_id), so a lookup keeps it idempotent.
  const existingContext = await findOne(admin, 'user_contexts', {
    auth_user_id: userId,
    context_type: 'unit',
    context_id: unitId,
  });
  if (existingContext) {
    report.userContext = 'existing';
  } else {
    await admin
      .from('user_contexts')
      .insert({
        auth_user_id: userId,
        product: 'homeowner',
        context_type: 'unit',
        context_id: unitId,
        display_name: CONTEXT_DISPLAY_NAME,
        display_subtitle: CONTEXT_DISPLAY_SUBTITLE,
        context_aware: true,
      })
      .throwOnError();
    report.userContext = 'created';
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  const usedDefaultPassword = !process.env.SEED_DEMO_PASSWORD;

  const lines: string[] = [];
  lines.push('');
  lines.push('==========================================================================');
  lines.push('  Cairn demo seed complete');
  lines.push('==========================================================================');
  lines.push('');
  lines.push('  Per row:');
  lines.push(`    auth user     ${report.authUser}`);
  lines.push(`    tenant        ${report.tenant}`);
  lines.push(`    organisation  ${report.organisation}`);
  lines.push(`    development   ${report.development}`);
  lines.push(`    project       ${report.project}`);
  lines.push(`    unit          ${report.unit}`);
  lines.push(`    unit_systems  ${systemsCreated} created, ${systemsExisting} already present`);
  lines.push(`    user_context  ${report.userContext}`);
  lines.push('');
  lines.push('  Key ids:');
  lines.push(`    TENANT_ID     ${tenantId}`);
  lines.push(`    ORGANISATION  ${orgId}${ORG_SHARES_TENANT_ID ? '  (shares the tenant id)' : ''}`);
  lines.push(`    DEVELOPMENT   ${developmentId}`);
  lines.push(`    PROJECT       ${projectId}`);
  lines.push(`    UNIT_ID       ${unitId}`);
  lines.push(`    AUTH_USER_ID  ${userId}`);
  lines.push('');
  lines.push('  Route this tenant to gpt-5.5 by adding the tenant id to PREMIUM_TENANTS:');
  lines.push(`    PREMIUM_TENANTS=...,${tenantId}`);
  lines.push('');
  lines.push('  Homeowner login:');
  lines.push(`    email     ${DEMO_EMAIL}`);
  lines.push(`    password  ${DEMO_PASSWORD}`);
  if (usedDefaultPassword) {
    lines.push('    NOTE: this is the built-in default password. Set SEED_DEMO_PASSWORD to');
    lines.push('          override it, and change it after the demo.');
  }
  lines.push('');
  lines.push('--------------------------------------------------------------------------');
  lines.push('  TEARDOWN (removes exactly what was created, keyed on the tenant id).');
  lines.push('  Run in the Supabase SQL editor. Children first to respect the FKs.');
  lines.push('--------------------------------------------------------------------------');
  lines.push('');
  lines.push(`delete from public.user_contexts where context_id = '${unitId}';`);
  lines.push(`delete from public.unit_systems  where tenant_id  = '${tenantId}';`);
  lines.push(`delete from public.units         where tenant_id  = '${tenantId}';`);
  lines.push(`delete from public.developments  where tenant_id  = '${tenantId}';`);
  lines.push(`delete from public.projects      where organization_id = '${orgId}';`);
  if (ORG_SHARES_TENANT_ID) {
    lines.push(`delete from public.organisations where id = '${tenantId}';`);
  } else {
    lines.push(`delete from public.organisations where id = '${orgId}';`);
  }
  lines.push(`delete from public.tenants       where id = '${tenantId}';`);
  lines.push('');
  lines.push('  The auth user is not removed by the SQL above. Delete it via the');
  lines.push('  Supabase dashboard (Authentication > Users) or the admin API:');
  lines.push(`    supabase.auth.admin.deleteUser('${userId}')   // ${DEMO_EMAIL}`);
  lines.push('');
  lines.push('==========================================================================');
  lines.push('');

  console.log(lines.join('\n'));
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
