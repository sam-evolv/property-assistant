import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

// 1. SETUP (Admin Mode)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function forceFeed() {
  console.log("🥩 STARTING FORCE FEED...");

  // 2. FIND THE DOCUMENT
  // We search for the file you uploaded
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .ilike('title', '%Spec Doc%') // Matches "Spec Doc Finalised"
    .limit(1);

  if (!docs || docs.length === 0) {
    console.error("❌ ERROR: Could not find 'Spec Doc' in the database catalog.");
    console.log("👉 Please re-upload the file in the Dashboard so the catalog record exists.");
    return;
  }
  const doc = docs[0];
  console.log(`📄 Found Document: "${doc.title}"`);

  // 3. CLEAR OLD MEMORIES (To avoid duplicates)
  await supabase.from('document_sections').delete().eq('document_id', doc.id);
  console.log("🧹 Cleared any partial/corrupt memories.");

  // 4. DOWNLOAD PDF
  console.log("⬇️  Downloading PDF from Storage...");
  const { data: fileData, error: dlErr } = await supabase.storage
    .from('development_docs')
    .download(doc.storage_path);

  if (dlErr) {
    console.error(`❌ Download Failed: ${dlErr.message}`);
    return;
  }

  // 5. EXTRACT TEXT
  const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
  const parsed = await pdf(pdfBuffer);
  const text = parsed.text;
  console.log(`📖 Extracted ${text.length} characters.`);

  // 6. MEMORIZE (Chunk & Embed)
  console.log("🧠 Memorizing...");
  const chunks = text.match(/[\s\S]{1,1000}/g) || [];
  
  let count = 0;
  for (const chunk of chunks) {
    // Generate Vector
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    const vector = res.data[0].embedding;

    // Save to Brain
    await supabase.from('document_sections').insert({
      document_id: doc.id,
      content: chunk,
      embedding: vector
    });
    count++;
    process.stdout.write('.'); // Progress dot
  }

  console.log(`\n✅ SUCCESS: The AI has memorized ${count} sections.`);
}

forceFeed();