export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/care/third-party/lookup-job
 *
 * For the SE Systems demo we always return { matched: false } because
 * SE Systems has not connected their job system yet. The portal is
 * designed to keep working without the integration and will auto-match
 * jobs once a job API is wired in.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const jobReference: string | undefined = body?.jobReference;

    return NextResponse.json({
      matched: false,
      jobReference: jobReference ?? null,
      message: 'No job system integrated yet; continue with manual entry.',
    });
  } catch {
    return NextResponse.json({ matched: false }, { status: 200 });
  }
}
