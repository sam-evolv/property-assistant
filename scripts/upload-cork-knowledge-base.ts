/**
 * upload-cork-knowledge-base.ts
 * 
 * Chunks Cork planning/regulatory MD files, generates embeddings via OpenAI,
 * and inserts them into document_sections for OpenHouse Intelligence (Layer 4).
 * 
 * Usage:
 *   npx tsx scripts/upload-cork-knowledge-base.ts
 * 
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────
const REGULATORY_PROJECT_ID = '00000000-0000-0000-0000-000000000001'; // Layer 4
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 1500;       // chars per chunk (sweet spot for embedding quality)
const CHUNK_OVERLAP = 200;     // overlap between chunks for context continuity
const BATCH_SIZE = 20;         // embeddings per API call (max 2048)
const DELAY_MS = 200;          // rate limit delay between batches

// ── Files to upload ─────────────────────────────────────────────────
const MD_FILES: { file: string; title: string }[] = [
  { file: 'cork_markdown/CorkCityPlan_Volume1_website_nov_04_12_25.md', title: 'Cork City Development Plan 2022-2028 - Volume 1' },
  { file: 'cork_markdown/volume-1-main-policy-material.md', title: 'Cork County Development Plan 2022-2028 - Volume 1 Main Policy' },
  { file: 'cork_markdown/New_Volume_2__Cover_plus_Internal_Pages__17_10_23__Approved_.md', title: 'Cork County Development Plan 2022-2028 - Volume 2' },
  { file: 'cork_markdown/Appendix_A_Volume_1_-_Written_Statement.md', title: 'Cork County Development Plan - Appendix A Written Statement' },
  { file: 'cork_markdown/Appendix_C_Volume_4.md', title: 'Cork County Development Plan - Appendix C Volume 4' },
  { file: 'cork_markdown/adopted-development-contributions-scheme-2023-2029.md', title: 'Cork Development Contributions Scheme 2023-2029' },
  { file: 'cork_markdown/cork-county-council-housing-delivery-action-plan-2022-2026.md', title: 'Cork County Council Housing Delivery Action Plan 2022-2026' },
  { file: 'cork_markdown/taking-in-charge-policy.md', title: 'Cork City Council Taking In Charge Policy 2010' },
  { file: 'cork_markdown/R009_LeeCFRMP_FinalandAppendices_Jan14.md', title: 'Lee Catchment Flood Risk Management Plan (CFRAM)' },
  { file: 'cork_markdown/2013-Design-Manual-for-Urban-Roads-and-Streets-1.md', title: 'DMURS - Design Manual for Urban Roads and Streets 2013' },
  { file: 'cork_markdown/design-manual-for-quality-housing.md', title: 'Design Manual for Quality Housing' },
  { file: 'cork_markdown/Design-Standards-for-New-Apartment-Amended-PGs-July-2023.md', title: 'Design Standards for New Apartments 2023 (Amended)' },
  { file: 'cork_markdown/Sustainable-Residential-Development-and-Compact-Settlements-Guidelines-for-Planning-Authorities.md', title: 'Sustainable Residential Development & Compact Settlements Guidelines' },
  { file: 'cork_markdown/Uisce-Eireann-Developer-Guide-to-Connect.md', title: 'Uisce Éireann Developer Guide to Connect' },
  { file: 'cork_markdown/Water-Standard-Details.md', title: 'Water Standard Details' },
  { file: 'cork_markdown/pdf.md', title: 'Cork Planning Document (PDF)' },
  { file: 'cork_markdown/pdf__1_.md', title: 'Cork Planning Document (PDF 2)' },
];

// ── Setup ───────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Chunking ────────────────────────────────────────────────────────
function chunkMarkdown(text: string, maxSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  
  // Split on headings first for semantic boundaries
  const sections = text.split(/(?=^#{1,3} )/m);
  
  let currentChunk = '';
  
  for (const section of sections) {
    if (currentChunk.length + section.length <= maxSize) {
      currentChunk += section;
    } else {
      // If current chunk has content, push it
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // If single section is too large, split by paragraphs
      if (section.length > maxSize) {
        const paragraphs = section.split(/\n\n+/);
        currentChunk = '';
        for (const para of paragraphs) {
          if (currentChunk.length + para.length + 2 <= maxSize) {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
          } else {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              // Keep overlap from end of previous chunk
              const overlapText = currentChunk.slice(-overlap);
              currentChunk = overlapText + '\n\n' + para;
            } else {
              // Single paragraph too large, hard split
              let remaining = para;
              while (remaining.length > maxSize) {
                const splitPoint = remaining.lastIndexOf('. ', maxSize) + 1 || maxSize;
                chunks.push(remaining.slice(0, splitPoint).trim());
                remaining = remaining.slice(splitPoint - overlap).trim();
              }
              currentChunk = remaining;
            }
          }
        }
      } else {
        currentChunk = section;
      }
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // Filter out tiny chunks (< 50 chars) that are just whitespace/headers
  return chunks.filter(c => c.length >= 50);
}

// ── Embed batch ─────────────────────────────────────────────────────
async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('🏗️  OpenHouse Intelligence — Cork Knowledge Base Upload');
  console.log('='.repeat(60));
  
  // Check env
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing env vars. Need: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
    process.exit(1);
  }

  let totalChunks = 0;
  let totalFiles = 0;
  let errors: string[] = [];

  for (const { file, title } of MD_FILES) {
    const filePath = path.resolve(file);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping (not found): ${file}`);
      errors.push(`File not found: ${file}`);
      continue;
    }
    
    console.log(`\n📄 Processing: ${title}`);
    console.log(`   File: ${file}`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`   Size: ${(content.length / 1024).toFixed(0)}KB`);
    
    // Chunk
    const chunks = chunkMarkdown(content, CHUNK_SIZE, CHUNK_OVERLAP);
    console.log(`   Chunks: ${chunks.length}`);
    
    // Delete existing chunks for this document title (dedup on re-run)
    const { error: deleteError } = await supabase
      .from('document_sections')
      .delete()
      .eq('project_id', REGULATORY_PROJECT_ID)
      .filter('metadata->>title', 'eq', title);
    
    if (deleteError) {
      console.warn(`   ⚠️  Could not clear old chunks: ${deleteError.message}`);
    }
    
    // Process in batches
    let fileChunkCount = 0;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      
      try {
        // Generate embeddings
        const embeddings = await embedBatch(batch);
        
        // Insert rows
        const rows = batch.map((chunk, idx) => ({
          id: randomUUID(),
          project_id: REGULATORY_PROJECT_ID,
          content: chunk,
          embedding: embeddings[idx],
          metadata: {
            title,
            file_name: path.basename(file),
            source: 'cork_regulatory',
            chunk_index: i + idx,
            total_chunks: chunks.length,
          },
        }));
        
        const { error: insertError } = await supabase
          .from('document_sections')
          .insert(rows);
        
        if (insertError) {
          console.error(`   ❌ Insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${insertError.message}`);
          errors.push(`${title} batch ${Math.floor(i / BATCH_SIZE) + 1}: ${insertError.message}`);
        } else {
          fileChunkCount += batch.length;
          process.stdout.write(`   ✅ ${fileChunkCount}/${chunks.length} chunks\r`);
        }
        
        // Rate limit
        if (i + BATCH_SIZE < chunks.length) {
          await new Promise(r => setTimeout(r, DELAY_MS));
        }
      } catch (err: any) {
        console.error(`   ❌ Batch error: ${err.message}`);
        errors.push(`${title}: ${err.message}`);
      }
    }
    
    console.log(`   ✅ ${fileChunkCount} chunks embedded and stored`);
    totalChunks += fileChunkCount;
    totalFiles++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`🎉 Upload complete!`);
  console.log(`   Files processed: ${totalFiles}/${MD_FILES.length}`);
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Project ID: ${REGULATORY_PROJECT_ID} (Layer 4 — Regulatory)`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} error(s):`);
    errors.forEach(e => console.log(`   - ${e}`));
  }
  
  // Verify count
  const { count } = await supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', REGULATORY_PROJECT_ID);
  
  console.log(`\n📊 Total Layer 4 regulatory chunks in DB: ${count}`);
}

main().catch(console.error);
