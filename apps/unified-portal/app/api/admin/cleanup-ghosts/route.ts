export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { documents } from '@openhouse/db/schema';
import { like, or } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.delete(documents)
      .where(
        or(
          like(documents.file_url, '/uploads/%'),
          like(documents.file_url, 'uploads/%')
        )
      )
      .returning({ id: documents.id, title: documents.title });

    return new NextResponse(
      `SUCCESS: Cleaned up ${result.length} ghost records.\n\nGo refresh your Admin Panel.`,
      { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  } catch (error) {
    return new NextResponse(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    );
  }
}
