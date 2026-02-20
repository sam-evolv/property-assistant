import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const documentId = params.id;

  try {
    const { question } = await req.json();
    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question required' }, { status: 400 });
    }

    // Get embedding for the question
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: question,
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;

    // Retrieve top 5 chunks from this specific document using cosine similarity
    const chunks = await db.execute(
      sql`SELECT content, chunk_index
          FROM rag_chunks
          WHERE document_id = ${documentId}::uuid
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

    const completion = await openai.chat.completions.create({
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
    console.error('[AskDoc] Failed:', error);
    return NextResponse.json({ error: 'Failed to process question' }, { status: 500 });
  }
}
