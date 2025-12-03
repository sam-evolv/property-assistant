import { encoding_for_model } from 'tiktoken';
import { TrainingItem, TextChunk } from './types';

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

export async function chunkText(
  text: string,
  maxTokens: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): Promise<TextChunk[]> {
  const encoder = encoding_for_model('gpt-3.5-turbo');
  
  try {
    const tokens = encoder.encode(text);
    const chunks: TextChunk[] = [];
    let startIdx = 0;
    let chunkIndex = 0;
    
    while (startIdx < tokens.length) {
      const endIdx = Math.min(startIdx + maxTokens, tokens.length);
      const chunkTokens = tokens.slice(startIdx, endIdx);
      const decoded = encoder.decode(chunkTokens);
      const chunkText = typeof decoded === 'string' ? decoded : new TextDecoder().decode(decoded);
      
      chunks.push({
        content: chunkText.trim(),
        index: chunkIndex,
        tokenCount: chunkTokens.length,
        metadata: {
          startToken: startIdx,
          endToken: endIdx,
        },
      });
      
      chunkIndex++;
      
      if (endIdx >= tokens.length) {
        break;
      }
      
      startIdx = Math.max(0, endIdx - overlap);
    }
    
    console.log(`  ✂️  Split into ${chunks.length} chunks (avg ~${Math.round(tokens.length / chunks.length)} tokens each)`);
    
    return chunks;
  } finally {
    encoder.free();
  }
}

export async function chunkTrainingItems(
  items: TrainingItem[],
  maxTokens: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): Promise<Array<{ item: TrainingItem; chunks: TextChunk[] }>> {
  if (items.length === 0) {
    console.log('   ⚠️  No items to chunk');
    return [];
  }
  
  console.log(`\n✂️  Chunking ${items.length} training items...`);
  
  const results = [];
  
  for (const item of items) {
    const chunks = await chunkText(item.text, maxTokens, overlap);
    
    const enrichedChunks = chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        ...item.metadata,
        sourceType: item.sourceType,
        title: item.title,
      },
    }));
    
    results.push({
      item,
      chunks: enrichedChunks,
    });
  }
  
  const totalChunks = results.reduce((sum, r) => sum + r.chunks.length, 0);
  console.log(`✅ Created ${totalChunks} total chunks from ${items.length} items`);
  
  return results;
}

export function estimateTokenCount(text: string): number {
  const encoder = encoding_for_model('gpt-3.5-turbo');
  try {
    const tokens = encoder.encode(text);
    return tokens.length;
  } finally {
    encoder.free();
  }
}
