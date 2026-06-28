/**
 * embed-bayly-sections.ts
 *
 * Surgical, one-off backfill of embeddings for the Bayly demo project only.
 *
 * Why this exists:
 * - The Bayly document_sections rows were seeded without embeddings, so retrieval
 *   was running on keyword matching alone (similarity 0). That is brittle and it
 *   also means the hallucination firewall does not treat correct answers as
 *   grounded, so it can suppress them.
 * - This embeds every Bayly chunk that is missing an embedding using
 *   text-embedding-3-small, which is the SAME model the live query path uses in
 *   apps/unified-portal/app/api/chat/route.ts. The model must match or cosine
 *   similarity between query and chunk is meaningless.
 *
 * Scope guard: only touches rows where project_id = the Bayly project id below.
 * It will not write to any other development.
 *
 * Run:
 *   OPENAI_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/embed-bayly-sections.ts
 *
 * Safe to run more than once. It only fills rows where embedding IS NULL.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const BAYLY_PROJECT_ID = 'ca110000-0000-4000-a000-000000000002';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EXPECTED_DIMS = 1536;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}
if (!openaiKey) {
  console.error('Missing OPENAI_API_KEY in the environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const openai = new OpenAI({ apiKey: openaiKey });

async function run() {
  console.log('Bayly embedding backfill starting.');
  console.log(`Project: ${BAYLY_PROJECT_ID}`);
  console.log(`Model:   ${EMBEDDING_MODEL}`);

  const { data: rows, error } = await supabase
    .from('document_sections')
    .select('id, content, metadata')
    .eq('project_id', BAYLY_PROJECT_ID)
    .is('embedding', null);

  if (error) {
    console.error('Failed to read document_sections:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('Nothing to do. No Bayly rows are missing an embedding.');
    return;
  }

  console.log(`Found ${rows.length} Bayly rows without embeddings.`);

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    const source = (row.metadata && (row.metadata.source as string)) || row.id;
    const section = (row.metadata && (row.metadata.section as string)) || '';
    const label = section ? `${source} [${section}]` : source;

    const text = (row.content || '').toString().trim();
    if (!text) {
      console.warn(`Skipping ${label}: empty content.`);
      failed++;
      continue;
    }

    try {
      const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });
      const vector = res.data[0].embedding;

      if (!Array.isArray(vector) || vector.length !== EXPECTED_DIMS) {
        console.error(`Unexpected embedding length for ${label}: ${vector?.length}. Aborting to avoid a bad write.`);
        process.exit(1);
      }

      const { error: updErr } = await supabase
        .from('document_sections')
        .update({ embedding: vector })
        .eq('id', row.id);

      if (updErr) {
        console.error(`Update failed for ${label}: ${updErr.message}`);
        failed++;
      } else {
        console.log(`Embedded: ${label}`);
        ok++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Embedding call failed for ${label}: ${msg}`);
      failed++;
    }
  }

  const { count: remaining } = await supabase
    .from('document_sections')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', BAYLY_PROJECT_ID)
    .is('embedding', null);

  console.log('');
  console.log('Summary');
  console.log(`  Embedded this run: ${ok}`);
  console.log(`  Failed:            ${failed}`);
  console.log(`  Still missing:     ${remaining ?? 'unknown'}`);
  console.log('Done.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
