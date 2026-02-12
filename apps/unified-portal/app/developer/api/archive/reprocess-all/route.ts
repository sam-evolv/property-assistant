export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    return NextResponse.json({
      totalDocuments: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0,
      pending: 0,
      processing: 0,
      errors: 0,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
      totalDocuments: 0,
      withEmbeddings: 0,
      withoutEmbeddings: 0,
      pending: 0,
      processing: 0,
      errors: 0,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    return NextResponse.json({
      processed: 0,
      successful: 0,
      totalChunks: 0,
      message: 'No documents to reprocess',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Reprocessing not available' }, { status: 500 });
  }
}
