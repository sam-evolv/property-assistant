import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { informationRequests, docChunks } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

// REMOVED: Hardcoded tenant/development IDs - these are now derived from the request's existing data

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { response, status, addToKnowledgeBase } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    const existingRequest = await db
      .select()
      .from(informationRequests)
      .where(eq(informationRequests.id, id))
      .limit(1);

    if (existingRequest.length === 0) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      updated_at: new Date(),
    };

    if (response !== undefined) {
      updateData.response = response;
    }

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolved_at = new Date();
      }
    }

    await db
      .update(informationRequests)
      .set(updateData)
      .where(eq(informationRequests.id, id));

    if (addToKnowledgeBase && response && status === 'resolved') {
      const question = existingRequest[0].question;
      
      const faqContent = `Question: ${question}\n\nAnswer: ${response}`;
      
      let embedding: number[] | null = null;
      try {
        const embeddingResponse = await getOpenAIClient().embeddings.create({
          model: 'text-embedding-3-small',
          input: faqContent,
          dimensions: 1536,
        });
        embedding = embeddingResponse.data[0].embedding;
      } catch (embError) {
        console.error('[InfoRequest] Failed to generate embedding:', embError);
      }

      await db.insert(docChunks).values({
        tenant_id: existingRequest[0].tenant_id,
        development_id: existingRequest[0].development_id,
        document_id: null,
        source_type: 'faq',
        source_id: id,
        content: faqContent,
        chunk_index: 0,
        token_count: Math.ceil(faqContent.length / 4),
        embedding: embedding,
        metadata: {
          source: 'faq_from_request',
          request_id: id,
          question: question,
          created_from: 'information_request',
          file_name: 'FAQ - User Questions',
          uploaded_at: new Date().toISOString(),
        },
      });

      console.log('[InfoRequest] Added FAQ to knowledge base from request:', id);
    }

    console.log('[InfoRequest] Updated request:', id, 'Status:', status);

    return NextResponse.json({
      success: true,
      message: addToKnowledgeBase 
        ? 'Response saved and added to the AI knowledge base'
        : 'Response saved successfully',
    });
  } catch (error) {
    console.error('[InfoRequest] Error updating request:', error);
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await db
      .select()
      .from(informationRequests)
      .where(eq(informationRequests.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      request: result[0],
    });
  } catch (error) {
    console.error('[InfoRequest] Error fetching request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    );
  }
}
