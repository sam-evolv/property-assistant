import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

// 1. SETUP
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function train() {
  console.log("🧠 STARTING FORCE TRAINING...");

  // 2. FIND THE DOCUMENT
  // We look for the one you just uploaded
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .ilike('title', '%Spec Doc%') // Matches "Spec Doc Finalised..."
    .limit(1);

  if (!docs || docs.length === 0) {
    console.error("❌ Could not find the document in the database.");
    return;
  }
  const doc = docs[0];
  console.log(`📄 Found Document: "${doc.title}"`);

  // 3. DOWNLOAD PDF FROM STORAGE
  console.log("⬇️  Downloading PDF...");
  const { data: fileData, error: dlError } = await supabase
    .storage
    .from('development_docs')
    .download(doc.storage_path);

  if (dlError) {
    console.error("❌ Download Failed:", dlError.message);
    return;
  }

  // 4. EXTRACT TEXT
  console.log("📖 Reading Text...");
  const pdfBuffer = Buffer.from(await fileData.arrayBuffer());
  const data = await pdf(pdfBuffer);
  const text = data.text;
  console.log(`✅ Extracted ${text.length} characters.`);

  // 5. CHUNK & EMBED
  console.log("✂️  Chunking & Embedding...");
  const chunks = text.match(/[\s\S]{1,1000}/g) || []; // Simple 1000 char chunks
  
  let count = 0;
  for (const chunk of chunks) {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk,
    });
    const vector = embeddingResponse.data[0].embedding;

    await supabase.from('document_sections').insert({
      document_id: doc.id,
      content: chunk,
      embedding: vector
    });
    count++;
    process.stdout.write('.'); // Progress dot
  }

  console.log(`\n✅ SUCCESS: Trained ${count} sections.`);
}

train();