import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { informationRequests, docChunks } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { requireRole, type AdminSession } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
  });
}

// REMOVED: Hardcoded tenant/development IDs - these are now derived from the request's existing data

// SECURITY: this [id] route is only used by developer dashboards (knowledge-base, insights).
// Purchasers create requests via POST /api/information-requests, not here.
function canAccessTenant(session: AdminSession, tenantId: string | null | undefined): boolean {
  return session.role === 'super_admin' || tenantId === session.tenantId;
}

function authErrorResponse(error: unknown): NextResponse | null {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  if (errorMessage === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (errorMessage === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
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

    if (!canAccessTenant(session, existingRequest[0].tenant_id)) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
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
      } catch (_embError) {
          // error handled silently
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

    }

    return NextResponse.json({
      success: true,
      message: addToKnowledgeBase 
        ? 'Response saved and added to the AI knowledge base'
        : 'Response saved successfully',
    });
  } catch (error) {
    const authError = authErrorResponse(error);
    if (authError) return authError;
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
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { id } = params;

    const result = await db
      .select()
      .from(informationRequests)
      .where(eq(informationRequests.id, id))
      .limit(1);

    if (result.length === 0 || !canAccessTenant(session, result[0].tenant_id)) {
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
    const authError = authErrorResponse(error);
    if (authError) return authError;
    return NextResponse.json(
      { error: 'Failed to fetch request' },
      { status: 500 }
    );
  }
}
