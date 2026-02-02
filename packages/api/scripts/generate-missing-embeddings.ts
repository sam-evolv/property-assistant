import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateMissingEmbeddings() {
  console.log('Checking for document_sections without embeddings...');

  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('id, content')
    .is('embedding', null);

  if (error) {
    console.error('Error fetching sections:', error);
    return;
  }

  if (!sections || sections.length === 0) {
    console.log('No sections without embeddings found. All good!');
    return;
  }

  console.log(`Found ${sections.length} sections without embeddings`);

  let successCount = 0;
  let errorCount = 0;

  for (const section of sections) {
    try {
      console.log(`Processing section ${section.id}...`);

      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: section.content,
      });

      const embedding = response.data[0].embedding;

      const { error: updateError } = await supabase
        .from('document_sections')
        .update({ embedding })
        .eq('id', section.id);

      if (updateError) {
        console.error(`Error updating section ${section.id}:`, updateError);
        errorCount++;
      } else {
        console.log(`Updated embedding for section ${section.id}`);
        successCount++;
      }
    } catch (err) {
      console.error(`Error generating embedding for ${section.id}:`, err);
      errorCount++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total processed: ${sections.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);

  const { data: remaining } = await supabase
    .from('document_sections')
    .select('id')
    .is('embedding', null);

  console.log(`Remaining without embeddings: ${remaining?.length || 0}`);
  console.log('Done!');
}

generateMissingEmbeddings().catch(console.error);
