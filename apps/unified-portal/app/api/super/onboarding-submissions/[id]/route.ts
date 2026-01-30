import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { onboardingSubmissions } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin']);

    const [submission] = await db
      .select()
      .from(onboardingSubmissions)
      .where(eq(onboardingSubmissions.id, params.id))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ submission });
  } catch (error: any) {
    console.error('[Super Onboarding Submission API] GET Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch submission' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin']);

    const body = await request.json();
    const { status, admin_notes } = body;

    const validStatuses = ['pending', 'in_review', 'completed', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };

    if (status) updateData.status = status;
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

    const [updated] = await db
      .update(onboardingSubmissions)
      .set(updateData)
      .where(eq(onboardingSubmissions.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ submission: updated });
  } catch (error: any) {
    console.error('[Super Onboarding Submission API] PATCH Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['super_admin']);

    const [deleted] = await db
      .delete(onboardingSubmissions)
      .where(eq(onboardingSubmissions.id, params.id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Super Onboarding Submission API] DELETE Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete submission' }, { status: 500 });
  }
}
