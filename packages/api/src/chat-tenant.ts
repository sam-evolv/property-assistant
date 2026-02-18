import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db, tenants, documents, pois, developments } from '@openhouse/db';
import { eq, sql } from 'drizzle-orm';
import { searchSimilarChunks } from './vector-store';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function handleTenantChat(request: NextRequest, tenantSlug: string) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json() as { messages: ChatMessage[] };
    const { messages } = body;
    
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const lastUserMessage = messages.filter((m: ChatMessage) => m.role === 'user').pop();
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    const [tenantDocs, tenantPois, tenantDevs] = await Promise.all([
      db.select().from(documents).where(eq(documents.tenant_id, tenant.id)).limit(50),
      db.select().from(pois).where(eq(pois.tenant_id, tenant.id)).limit(50),
      db.select().from(developments).where(eq(developments.tenant_id, tenant.id)).limit(10),
    ]);

    let relevantChunks: any[] = [];
    try {
      const developmentId = tenantDevs[0]?.id?.toString() || '';
      if (developmentId) {
        relevantChunks = await searchSimilarChunks(
          lastUserMessage.content, 
          tenant.id.toString(), 
          developmentId,
          { limit: 5 }
        );
      }
    } catch (err) {
      console.warn('Vector search failed, continuing without embeddings:', err);
    }

    const context = buildTenantContext(tenant, tenantDocs, tenantPois, tenantDevs, relevantChunks);

    const systemMessage: ChatMessage = {
      role: 'system',
      content: `You are a helpful AI assistant for ${tenant.name}. 

${context}

Answer questions based on the provided context. If you don't have enough information, politely say so. Be friendly and helpful.`,
    };

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({
      message: assistantMessage,
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
      },
      citations: relevantChunks.map(chunk => ({
        title: chunk.title || 'Document',
        page: chunk.page_number,
      })).slice(0, 3),
    });

  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

function buildTenantContext(
  tenant: any,
  docs: any[],
  pois: any[],
  developments: any[],
  chunks: any[]
): string {
  let context = `Property: ${tenant.name}\n`;
  if (tenant.description) {
    context += `Description: ${tenant.description}\n`;
  }
  context += '\n';

  if (developments.length > 0) {
    context += '## Developments:\n';
    developments.forEach(dev => {
      context += `- ${dev.name}: ${dev.address}\n`;
    });
    context += '\n';
  }

  if (docs.length > 0) {
    context += `## Available Documents (${docs.length}):\n`;
    docs.slice(0, 10).forEach(doc => {
      context += `- ${doc.title}\n`;
    });
    context += '\n';
  }

  if (pois.length > 0) {
    context += `## Points of Interest:\n`;
    pois.forEach(poi => {
      context += `- ${poi.name} (${poi.category})\n`;
    });
    context += '\n';
  }

  if (chunks.length > 0) {
    context += '## Relevant Information:\n';
    chunks.forEach((chunk, idx) => {
      context += `${idx + 1}. ${chunk.text.substring(0, 200)}...\n`;
    });
    context += '\n';
  }

  return context;
}
