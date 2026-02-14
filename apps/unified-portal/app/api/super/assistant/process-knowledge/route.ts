// /api/super/assistant/process-knowledge/route.ts
// Uses GPT-4o-mini to chunk and extract knowledge from large text content
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }
  return new OpenAI({ apiKey });
}

interface KnowledgeChunk {
  title: string;
  content: string;
  category: string;
}

export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient();
    await requireRole(['super_admin', 'admin']);
    
    const body = await request.json();
    const { content, source_url } = body;

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ 
        error: 'Content must be at least 50 characters' 
      }, { status: 400 });
    }

    // Limit content to prevent excessive token usage
    const maxChars = 50000;
    const truncatedContent = content.slice(0, maxChars);
    const wasTruncated = content.length > maxChars;

    // Use GPT-4o-mini to extract knowledge chunks
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a knowledge extraction assistant. Your job is to break down provided content into discrete, useful knowledge chunks for a property/real estate AI assistant.

Each chunk should:
- Have a clear, descriptive title (max 100 chars)
- Contain self-contained information that answers a potential question
- Be categorized appropriately

Available categories:
- warranty: Warranty information, coverage, claims, defects
- maintenance: Home maintenance, upkeep, seasonal care
- local_area: Local amenities, transport, schools, shops
- property_info: Property features, specifications, layouts
- energy: Energy systems, heating, insulation, sustainability
- safety: Safety features, fire safety, security
- documents: Documentation, manuals, certificates
- general: Other useful information

Return a JSON array of objects with this structure:
{
  "chunks": [
    {
      "title": "Clear descriptive title",
      "content": "The actual knowledge content, can be multiple sentences",
      "category": "one of the categories above"
    }
  ]
}

Guidelines:
- Extract 5-20 chunks depending on content length
- Each chunk should be 50-300 words
- Focus on practical, actionable information
- Avoid duplicating information across chunks
- If content seems unrelated to property/home topics, still extract what's useful
- Return valid JSON only`
        },
        {
          role: 'user',
          content: `Please extract knowledge chunks from this content:\n\n${truncatedContent}${wasTruncated ? '\n\n[Content was truncated due to length]' : ''}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const responseText = response.choices[0]?.message?.content || '{"chunks": []}';
    
    let parsed: { chunks: KnowledgeChunk[] };
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse GPT response:', responseText);
      return NextResponse.json({ 
        error: 'Failed to parse AI response',
        raw: responseText 
      }, { status: 500 });
    }

    const chunks = parsed.chunks || [];

    // Validate and clean chunks
    const validChunks = chunks
      .filter(chunk => 
        chunk.title && 
        chunk.content && 
        chunk.title.length > 0 && 
        chunk.content.length > 20
      )
      .map(chunk => ({
        title: chunk.title.slice(0, 200).trim(),
        content: chunk.content.trim(),
        category: chunk.category || 'general',
        source_url: source_url || null,
        selected: true, // Default to selected for import
      }));

    return NextResponse.json({
      chunks: validChunks,
      metadata: {
        original_length: content.length,
        was_truncated: wasTruncated,
        chunks_extracted: validChunks.length,
      }
    });
  } catch (err) {
    console.error('Error processing knowledge:', err);
    return NextResponse.json({ error: 'Failed to process content' }, { status: 500 });
  }
}
