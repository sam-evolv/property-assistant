import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import pdfLib from 'pdf-parse'; // Import as a generic object

// 1. UNIVERSAL IMPORT FIX
// Some environments load it as 'pdfLib', others as 'pdfLib.default'
// We force it to find the function.
const pdf = (typeof pdfLib === 'function' ? pdfLib : (pdfLib as any).default);

// 2. SETUP
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function fix() {
  console.log("🤿 STARTING DEEP DIVE FIX (Attempt 4)...");

  // Verify PDF library loaded
  if (typeof pdf !== 'function') {
    console.error("❌ CRITICAL: Could not load 'pdf-parse' library properly.");
    console.log("Debug Type:", typeof pdf);
    return;
  }

  // 1. LIST FILES INSIDE THE PROJECT FOLDER
  console.log(`📂 Looking inside folder: ${PROJECT_ID}...`);
  const { data: files, error } = await supabase.storage
    .from('development_docs')
    .list(PROJECT_ID);

  if (error) {
    console.error("❌ Storage Error:", error.message);
    return;
  }

  if (!files || files.length === 0) {
    console.error("❌ Folder is empty. Please upload the file again.");
    return;
  }

  console.log(`✅ Found ${files.length} items inside folder.`);

  // 2. PROCESS EACH REAL FILE
  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;

    const fullPath = `${PROJECT_ID}/${file.name}`;
    console.log(`\n📄 Processing Real File: "${file.name}"`);

    // A. REGISTER IN DATABASE
    let { data: doc } = await supabase.from('documents').select('*').eq('storage_path', fullPath).single();

    if (!doc) {
      console.log("   - Creating Database Record...");
      const { data: newDoc, error: insErr } = await supabase.from('documents').insert({
        project_id: PROJECT_ID,
        title: file.name,
        storage_path: fullPath,
        file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/development_docs/${fullPath}`
      }).select().single();

      if (insErr) { console.error(`   ❌ DB Insert Failed: ${insErr.message}`); continue; }
      doc = newDoc;
    } else {
      console.log("   - Database Record Exists.");
    }

    // B. CLEAR OLD MEMORIES
    await supabase.from('document_sections').delete().eq('document_id', doc.id);

    // C. DOWNLOAD & TRAIN
    console.log("   - Downloading PDF...");
    const { data: fileData, error: dlErr } = await supabase.storage
      .from('development_docs')
      .download(fullPath);

    if (dlErr) { console.error(`   ❌ Download Failed: ${dlErr.message}`); continue; }

    console.log("   - Reading Text...");
    const pdfBuffer = Buffer.from(await fileData.arrayBuffer());

    let text = "";
    try {
        const parsed = await pdf(pdfBuffer);
        text = parsed.text;
    } catch (err: any) {
        console.error(`   ❌ PDF Parse Error: ${err.message}`);
        continue;
    }

    if (!text || text.length < 10) { console.error("   ❌ PDF is empty/image-only."); continue; }
    console.log(`   - Extracted ${text.length} characters.`);

    console.log("   - Memorizing (Chunking & Embedding)...");
    const chunks = text.match(/[\s\S]{1,1000}/g) || [];
    let saved = 0;

    for (const chunk of chunks) {
      const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: chunk });
      const vector = res.data[0].embedding;
      await supabase.from('document_sections').insert({ document_id: doc.id, content: chunk, embedding: vector });
      saved++;
      process.stdout.write('.');
    }
    console.log(`\n   ✅ SUCCESS: Memorized ${saved} chunks.`);
  }

  // 3. CLEANUP BAD RECORDS
  await supabase.from('documents').delete().eq('storage_path', PROJECT_ID);
  console.log("\n🧹 Cleanup complete.");
}

fix();