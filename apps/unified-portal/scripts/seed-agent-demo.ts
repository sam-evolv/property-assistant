/**
 * Seed Agent Intelligence demo data.
 *
 * Usage:
 *   cd apps/unified-portal
 *   npx tsx scripts/seed-agent-demo.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * in .env.local (or as environment variables).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from the unified-portal directory
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Set them in .env.local or as environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== Agent Intelligence Demo Data Seed ===\n');

  // ── Step 1: Look up existing data ──
  console.log('Step 1: Looking up existing data...\n');

  // Find admin user
  const { data: admins, error: adminsErr } = await supabase
    .from('admins')
    .select('id, email, tenant_id, role')
    .order('created_at', { ascending: true })
    .limit(5);

  if (adminsErr) throw new Error(`Failed to query admins: ${adminsErr.message}`);
  if (!admins?.length) throw new Error('No admins found. Seed admin data first.');

  console.log('Admins found:');
  admins.forEach((a) => console.log(`  - ${a.email} (role: ${a.role}, tenant: ${a.tenant_id})`));

  // Prefer sam@openhouseai.ie, else first admin
  const admin = admins.find((a) => a.email === 'sam@openhouseai.ie') || admins[0];
  console.log(`\nUsing admin: ${admin.email}`);

  // Find the auth.users ID for this admin
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const authUser = authUsers?.users?.find((u) => u.email === admin.email);
  if (!authUser) throw new Error(`No auth.users entry found for ${admin.email}`);
  const userId = authUser.id;
  console.log(`Auth user ID: ${userId}`);

  // Get tenant
  const { data: tenants, error: tenantsErr } = await supabase
    .from('tenants')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(5);

  if (tenantsErr) throw new Error(`Failed to query tenants: ${tenantsErr.message}`);
  if (!tenants?.length) throw new Error('No tenants found.');

  const tenant = tenants.find((t) => t.id === admin.tenant_id) || tenants[0];
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name} (${tenantId})`);

  // Get developments
  const { data: developments, error: devsErr } = await supabase
    .from('developments')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (devsErr) throw new Error(`Failed to query developments: ${devsErr.message}`);
  console.log(`\nDevelopments (${developments?.length || 0}):`);
  developments?.forEach((d) => console.log(`  - ${d.name} (${d.id})`));

  if (!developments?.length) throw new Error('No developments found for this tenant.');

  // ── Step 2: Create agent profile ──
  console.log('\nStep 2: Creating agent profile...');

  const { data: existing } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let agentId: string;

  if (existing) {
    agentId = existing.id;
    console.log(`Agent profile already exists: ${agentId}`);
  } else {
    const { data: newAgent, error: insertErr } = await supabase
      .from('agent_profiles')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        display_name: 'Sam Donworth',
        agency_name: 'OpenHouse AI',
        email: 'sam@openhouseai.ie',
        phone: '+353 87 123 4567',
        preferred_tone: 'professional',
      })
      .select('id')
      .single();

    if (insertErr) throw new Error(`Failed to create agent profile: ${insertErr.message}`);
    agentId = newAgent.id;
    console.log(`Created agent profile: ${agentId}`);
  }

  // ── Step 3: Assign to all developments ──
  console.log('\nStep 3: Assigning agent to all developments...');

  let assigned = 0;
  let skipped = 0;

  for (const dev of developments) {
    const { error: assignErr } = await supabase
      .from('agent_scheme_assignments')
      .upsert(
        {
          agent_id: agentId,
          development_id: dev.id,
          tenant_id: tenantId,
          assigned_by: userId,
          role: 'lead_agent',
          is_active: true,
        },
        { onConflict: 'agent_id,development_id' }
      );

    if (assignErr) {
      console.error(`  Failed to assign ${dev.name}: ${assignErr.message}`);
    } else {
      assigned++;
      console.log(`  Assigned to: ${dev.name}`);
    }
  }

  console.log(`\nAssigned: ${assigned}, Skipped: ${skipped}`);

  // ── Step 4: Verify ──
  console.log('\nStep 4: Verifying...\n');

  const { data: verification } = await supabase
    .from('agent_scheme_assignments')
    .select(`
      id,
      role,
      is_active,
      agent_profiles!inner ( display_name, agency_name, email ),
      developments!inner ( name )
    `)
    .eq('agent_id', agentId);

  console.log('Agent Profile + Assignments:');
  console.log('─'.repeat(60));

  if (verification?.length) {
    const first = verification[0] as any;
    console.log(`Agent:    ${first.agent_profiles.display_name}`);
    console.log(`Agency:   ${first.agent_profiles.agency_name}`);
    console.log(`Email:    ${first.agent_profiles.email}`);
    console.log(`Agent ID: ${agentId}`);
    console.log('');
    console.log('Assigned Schemes:');
    verification.forEach((v: any) => {
      console.log(`  - ${v.developments.name} (role: ${v.role}, active: ${v.is_active})`);
    });
  } else {
    console.log('No assignments found — something went wrong.');
  }

  console.log('\n=== Seed complete ===');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});
