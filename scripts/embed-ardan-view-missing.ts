/**
 * Generate embeddings for all document_sections rows with NULL embeddings
 * for the Árdan View project (project_id = 84a559d1-89f1-4eb6-a48b-7ca068bcc164).
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/embed-ardan-view-missing.ts
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const ARDAN_VIEW_PROJECT_ID = '84a559d1-89f1-4eb6-a48b-7ca068bcc164';
const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims, matches chat route

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function embedArdanViewMissing() {
  console.log(`Fetching document_sections with NULL embeddings for Árdan View (${ARDAN_VIEW_PROJECT_ID})...`);

  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('id, content')
    .eq('project_id', ARDAN_VIEW_PROJECT_ID)
    .is('embedding', null);

  if (error) {
    console.error('Error fetching sections:', error);
    process.exit(1);
  }

  if (!sections || sections.length === 0) {
    console.log('No sections with NULL embeddings found for Árdan View. All good!');
    return;
  }

  console.log(`Found ${sections.length} sections needing embeddings.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const section of sections) {
    try {
      const preview = section.content.substring(0, 80).replace(/\n/g, ' ');
      console.log(`[${successCount + errorCount + 1}/${sections.length}] Embedding: "${preview}..."`);

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: section.content,
      });

      const embedding = response.data[0].embedding;

      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ embedding })
        .eq('id', section.id);

      if (updateError) {
        console.error(`  ERROR updating section ${section.id}:`, updateError);
        errorCount++;
      } else {
        console.log(`  OK (${embedding.length} dims)`);
        successCount++;
      }
    } catch (err) {
      console.error(`  ERROR generating embedding for ${section.id}:`, err);
      errorCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${sections.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  // Verify no rows remain
  const { data: remaining } = await supabase
    .from('document_sections')
    .select('id')
    .eq('project_id', ARDAN_VIEW_PROJECT_ID)
    .is('embedding', null);

  console.log(`Remaining NULL embeddings for Árdan View: ${remaining?.length || 0}`);
  if ((remaining?.length || 0) === 0) {
    console.log('All Árdan View document_sections are now embedded.');
  }
}

embedArdanViewMissing().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
