/**
 * RESET DEMO STATE
 *
 * Wipes the chat history and pending drafts for one agent profile and
 * reseeds a tiny synthetic demo conversation. Run before recording the
 * promo so the screen is clean (BUG-06: stale pending_drafts residue;
 * BUG-07: real names from earlier exploratory chats leaking in).
 *
 * USAGE:
 *   npx tsx scripts/reset-demo-state.ts <agent_profile_id>
 *
 * Example:
 *   npx tsx scripts/reset-demo-state.ts 0f9210e0-342d-4f98-9be1-95decb6f507a
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * WHAT IT DELETES (scoped to the supplied agent profile):
 *   - pending_drafts WHERE user_id = <profile.user_id> AND skin LIKE 'agent%'
 *   - intelligence_conversations WHERE agent_id = <profile.id>
 *   - intelligence_interactions WHERE user_id = <profile.user_id> AND skin LIKE 'agent%'
 *
 * WHAT IT INSERTS:
 *   A 4-turn synthetic demo conversation in intelligence_conversations
 *   (2 user, 2 assistant) using existing seeded purchaser_name values
 *   pulled from `units` rows tied to the agent's active scheme
 *   assignments. Never invents new names; if no seeded names are
 *   available the conversation is skipped and a warning is logged.
 *
 * WHAT IT DOES NOT TOUCH:
 *   - units, developments, agent_profiles, agent_scheme_assignments
 *   - any RLS or schema changes
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const agentProfileId = process.argv[2];
if (!agentProfileId) {
  console.error('Usage: npx tsx scripts/reset-demo-state.ts <agent_profile_id>');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY);

async function loadProfile() {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('id, user_id, tenant_id, display_name')
    .eq('id', agentProfileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`No agent_profiles row for id=${agentProfileId}`);
  if (!data.user_id) throw new Error('agent_profiles.user_id is null — cannot scope auth-keyed deletes.');
  return data as { id: string; user_id: string; tenant_id: string | null; display_name: string | null };
}

async function loadSeededBuyerNames(profile: {
  id: string;
  tenant_id: string | null;
}): Promise<Array<{ name: string; scheme: string }>> {
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', profile.id)
    .eq('is_active', true);
  const devIds = Array.from(
    new Set((assignments || []).map((a: any) => a.development_id).filter(Boolean)),
  );
  if (!devIds.length) return [];

  const { data: devs } = await supabase
    .from('developments')
    .select('id, name')
    .in('id', devIds);
  const devNameById = new Map<string, string>(
    (devs || []).map((d: any) => [d.id, d.name]),
  );

  const { data: rows } = await supabase
    .from('units')
    .select('purchaser_name, development_id')
    .in('development_id', devIds)
    .not('purchaser_name', 'is', null)
    .neq('purchaser_name', '');

  const seen = new Set<string>();
  const out: Array<{ name: string; scheme: string }> = [];
  for (const r of (rows || []) as any[]) {
    const name = String(r.purchaser_name).trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, scheme: devNameById.get(r.development_id) || 'your scheme' });
  }
  return out;
}

async function deleteCount(table: string, filter: (q: any) => any): Promise<number> {
  // Two-step: count first, then delete. Some PostgREST configs don't
  // return affected row count on delete; the count() head request is
  // reliable.
  const countQ = filter(
    supabase.from(table).select('id', { count: 'exact', head: true }),
  );
  const { count, error: countErr } = (await countQ) as any;
  if (countErr) throw countErr;
  if (!count) return 0;

  const { error: delErr } = (await filter(supabase.from(table).delete())) as any;
  if (delErr) throw delErr;
  return count as number;
}

async function reseedConversation(
  profile: { id: string; tenant_id: string | null; display_name: string | null },
  buyers: Array<{ name: string; scheme: string }>,
) {
  if (buyers.length < 2) {
    console.warn(`Not enough seeded buyer names for ${profile.id} — skipping reseed.`);
    return;
  }
  const sessionId = `demo_${Date.now()}`;
  const a = buyers[0];
  const b = buyers[1];
  const turns = [
    { role: 'user', content: `Hey, give me a quick read on ${a.scheme} for the morning.` },
    {
      role: 'assistant',
      content:
        `${a.scheme} is steady. Two units worth chasing today: ${a.name} (contracts issued, no signed return) and ${b.name} (sale agreed, deposit clear). Want me to draft chase emails?`,
    },
    { role: 'user', content: `Yes, draft both. Keep it warm.` },
    {
      role: 'assistant',
      content:
        `Drafted two follow-ups. Have a flick through in the drawer and approve when you're happy.`,
    },
  ];
  const rows = turns.map((t) => ({
    agent_id: profile.id,
    tenant_id: profile.tenant_id,
    session_id: sessionId,
    role: t.role,
    content: t.content,
    entities_mentioned: { buyers: [a.name, b.name].slice(0, 2), schemes: [a.scheme] },
  }));
  const { error } = await supabase.from('intelligence_conversations').insert(rows);
  if (error) throw error;
  console.log(`  inserted ${rows.length} demo conversation rows (session_id=${sessionId})`);
}

async function main() {
  console.log('');
  console.log('=== reset-demo-state ===');
  console.log(`agent_profile_id: ${agentProfileId}`);
  console.log('');

  const profile = await loadProfile();
  console.log(`profile resolved: ${profile.display_name || '(no name)'} (user_id=${profile.user_id})`);
  console.log('');

  console.log('Deleting…');
  const draftsDeleted = await deleteCount('pending_drafts', (q) =>
    q.eq('user_id', profile.user_id).like('skin', 'agent%'),
  );
  console.log(`  pending_drafts: ${draftsDeleted} row(s)`);

  const convosDeleted = await deleteCount('intelligence_conversations', (q) =>
    q.eq('agent_id', profile.id),
  );
  console.log(`  intelligence_conversations: ${convosDeleted} row(s)`);

  const interactionsDeleted = await deleteCount('intelligence_interactions', (q) =>
    q.eq('user_id', profile.user_id).like('skin', 'agent%'),
  );
  console.log(`  intelligence_interactions: ${interactionsDeleted} row(s)`);

  console.log('');
  console.log('Reseeding demo conversation…');
  const buyers = await loadSeededBuyerNames({ id: profile.id, tenant_id: profile.tenant_id });
  console.log(`  found ${buyers.length} seeded buyer name(s) in agent's schemes`);
  await reseedConversation(profile, buyers);

  console.log('');
  console.log('Done.');
}

main().catch((err) => {
  console.error('reset-demo-state failed:', err?.message || err);
  process.exit(1);
});
