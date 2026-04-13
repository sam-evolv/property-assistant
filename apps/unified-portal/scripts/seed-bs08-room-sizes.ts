/**
 * One-off script: insert BS08 Room Sizes document_sections row + embedding
 *
 * Run from apps/unified-portal:
 *   npx ts-node --project tsconfig.json -e "require('dotenv').config({path:'.env.local'})" scripts/seed-bs08-room-sizes.ts
 *
 * Or with env already set:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
 *     npx ts-node scripts/seed-bs08-room-sizes.ts
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

const PROJECT_ID = '84a559d1-89f1-4eb6-a48b-7ca068bcc164';

const CONTENT = `Room Sizes for House Type BS08. Ground Floor: Kitchen/Dining 3.6m x 5.8m (20.9m²), Living Room 3.8m x 4.1m (15.6m²), Hall 1.9m x 5.3m (10.1m²), Utility 2.2m x 1.6m (3.5m²), WC 1.5m x 1.6m (2.4m²). First Floor: Master Bedroom 3.6m x 4.0m (14.4m²), Bedroom 2 3.2m x 3.9m (12.5m²), Bedroom 3 2.5m x 3.3m (8.3m²), Bathroom 2.1m x 2.0m (4.2m²), En-suite 2.1m x 1.5m (3.2m²), Landing 2.2m x 2.8m (6.2m²).`;

const METADATA = {
  source: '24007HD-RS-BS08-01-A',
  file_url: 'https://mddxbilpjukwskeefakz.supabase.co/storage/v1/object/public/development_docs/6d3789de-2e46-430c-bf31-22224bd878da/1767104206462-281-MHL-BS08-ZZ-DR-A-0080-House-Type-BS08---Ground-and-First-Floor-Plans-Rev.C02.pdf',
  file_name: '24007HD-RS-BS08-01-A.pdf',
  discipline: 'architectural',
  house_type_code: 'BS08',
  drawing_type: 'room_sizes',
  title: 'Room Sizes (BS08)',
  chunk_index: 0,
  total_chunks: 1,
};

async function run() {
  console.log('Generating embedding for BS08 Room Sizes content...');

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: CONTENT,
    dimensions: 1536,
  });

  const embedding = embeddingResponse.data[0].embedding;
  console.log(`Embedding generated (${embedding.length} dims)`);

  // Check if this row already exists
  const { data: existing } = await supabase
    .from('document_sections')
    .select('id')
    .eq('project_id', PROJECT_ID)
    .filter('metadata->>source', 'eq', METADATA.source)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`Row already exists (id: ${existing[0].id}), updating embedding...`);
    const { error } = await supabase
      .from('document_sections')
      .update({ embedding, content: CONTENT, metadata: METADATA })
      .eq('id', existing[0].id);

    if (error) {
      console.error('Update failed:', error);
      process.exit(1);
    }
    console.log('Row updated successfully.');
    return;
  }

  console.log('Inserting new document_sections row...');
  const { data, error } = await supabase
    .from('document_sections')
    .insert({
      project_id: PROJECT_ID,
      content: CONTENT,
      metadata: METADATA,
      embedding,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Insert failed:', error);
    process.exit(1);
  }

  console.log(`Inserted successfully. New row id: ${data.id}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
