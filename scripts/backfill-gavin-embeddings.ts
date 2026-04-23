import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/unified-portal/.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required env vars. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.');
  process.exit(1);
}

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const HOUSE_TYPE_CODE = 'BT01';
const EMBEDDING_MODEL = 'text-embedding-3-small';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

type Row = { id: string; content: string };

async function main() {
  console.log(`Backfilling embeddings for project=${PROJECT_ID}, house_type_code=${HOUSE_TYPE_CODE}`);

  const { data, error } = await supabase
    .from('document_sections')
    .select('id, content')
    .eq('project_id', PROJECT_ID)
    .filter('metadata->>house_type_code', 'eq', HOUSE_TYPE_CODE)
    .is('embedding', null);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as Row[];
  console.log(`Found ${rows.length} rows needing embeddings.`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.id}`;

    if (!row.content || row.content.trim().length === 0) {
      console.warn(`${label} skipped: empty content`);
      failed++;
      continue;
    }

    try {
      const res = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: row.content,
      });
      const vector = res.data[0].embedding;

      const { error: updErr } = await supabase
        .from('document_sections')
        .update({ embedding: vector })
        .eq('id', row.id);

      if (updErr) {
        console.error(`${label} update failed: ${updErr.message}`);
        failed++;
      } else {
        success++;
        console.log(`${label} ok (${row.content.length} chars)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${label} embedding failed: ${msg}`);
      failed++;
    }
  }

  console.log(`\nDone. success=${success} failed=${failed} total=${rows.length}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
