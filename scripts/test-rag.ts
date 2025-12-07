import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 1. SETUP
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// THE QUESTION YOU ASKED
const QUESTION = "What is the structural guarantee?"; 

async function scanBrain() {
  console.log(`🧠 SCANNING BRAIN FOR: "${QUESTION}"\n`);

  // 2. EMBED QUESTION
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: QUESTION,
  });
  const searchVector = embeddingResponse.data[0].embedding;

  // 3. SEARCH DATABASE (Vector Match)
  // We use a Remote Procedure Call (RPC) or direct similarity search if vector extension is enabled
  const { data: chunks, error } = await supabase.rpc('match_documents', {
    query_embedding: searchVector,
    match_threshold: 0.5, // 50% similarity
    match_count: 3
  });

  if (error) {
    // If RPC fails, we might be missing the SQL function.
    console.error("❌ SEARCH FAILED:", error.message);
    console.log("👉 You likely need to run the SQL to enable vector search functions.");
    return;
  }

  if (!chunks || chunks.length === 0) {
    console.error("❌ BRAIN EMPTY: No matching memories found.");
    console.log("👉 The document might not be indexed, or the 'match_documents' function is missing.");
    return;
  }

  // 4. SHOW RESULTS
  console.log("✅ FOUND MEMORIES:");
  chunks.forEach((chunk: any, i: number) => {
    console.log(`\n[MATCH ${i+1}] (Similarity: ${(chunk.similarity * 100).toFixed(1)}%)`);
    console.log(`"${chunk.content.substring(0, 150)}..."`); // Show first 150 chars
  });
}

scanBrain();