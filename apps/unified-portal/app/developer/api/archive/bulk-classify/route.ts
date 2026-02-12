export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    return NextResponse.json({ unclassifiedCount: 0 });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ unclassifiedCount: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    return NextResponse.json({ successCount: 0, message: 'No documents to classify' });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Classification not available' }, { status: 500 });
  }
}
