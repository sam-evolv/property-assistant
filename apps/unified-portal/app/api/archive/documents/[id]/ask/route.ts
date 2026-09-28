export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { requireRole } from '@/lib/supabase-server';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const documentId = params.id;

  try {
    // SECURITY: middleware skips /api/* — authenticate here and scope to the session tenant
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const [doc] = await db
      .select({ id: documents.id, tenant_id: documents.tenant_id })
      .from(documents)
      .where(eq(documents.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && doc.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { question } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    // Get embedding for the question
    const embeddingResponse = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve top 5 chunks from this specific document using cosine similarity
    const chunks = await db.execute(
      sql`SELECT content, chunk_index
          FROM rag_chunks
          WHERE document_id = ${documentId}::uuid
            AND tenant_id = ${doc.tenant_id}::uuid
          ORDER BY embedding <=> ${JSON.stringify(questionEmbedding)}::vector
          LIMIT 5`
    );

    if (!chunks.rows?.length) {
      return NextResponse.json({
        answer: "This document hasn't been indexed yet or has no searchable content.",
        chunks_used: 0,
      });
    }

    const context = (chunks.rows as Array<{ content: string }>).map(c => c.content).join('\n\n---\n\n');

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant answering questions about a specific construction or property document. Answer accurately based only on the provided document content. Be concise and direct.',
        },
        {
          role: 'user',
          content: `Document content:\n\n${context}\n\n---\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    return NextResponse.json({
      answer: completion.choices[0].message.content,
      chunks_used: chunks.rows.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (errorMessage === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}
