import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

// 1. SETUP (Admin Access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function heal() {
  console.log("🏥 STARTING BRAIN REPAIR...");

  // 2. GET ALL DOCUMENTS
  const { data: docs } = await supabase.from('documents').select('*');
  if (!docs || docs.length === 0) {
    console.error("❌ No documents found in the database catalog.");
    return;
  }
  console.log(`📂 Found ${docs.length} documents. Processing...`);

  // 3. PROCESS EACH DOCUMENT
  for (const doc of docs) {
    console.log(`\n📄 Processing: "${doc.title}"...`);

    // Check if already trained
    const { count } = await supabase
      .from('document_sections')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', doc.id);

    if (count && count > 0) {
      console.log(`   - Already has ${count} memories. Skipping.`);
      continue;
    }

    // Download
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('development_docs')
      .download(doc.storage_path);

    if (dlErr) {
      console.error(`   ❌ Download Failed: ${dlErr.message}`);
      continue;
    }

    // Extract Text
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
    const parsed = await pdf(pdfBuffer);
    const text = parsed.text;

    if (!text || text.length < 10) {
      console.error("   ❌ No text found in PDF.");
      continue;
    }
    console.log(`   - Extracted ${text.length} characters.`);

    // Embed & Save
    const chunks = text.match(/[\s\S]{1,1000}/g) || [];
    let saved = 0;

    for (const chunk of chunks) {
      const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });
      const vector = res.data[0].embedding;

      await supabase.from('document_sections').insert({
        document_id: doc.id,
        content: chunk,
        embedding: vector
      });
      saved++;
      process.stdout.write('.');
    }
    console.log(`\n   ✅ Saved ${saved} memories.`);
  }

  console.log("\n🧠 REPAIR COMPLETE.");
}

heal();