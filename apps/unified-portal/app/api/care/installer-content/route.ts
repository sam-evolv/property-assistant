export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

export async function GET(req: NextRequest) {
  try {
    const { supabase, session } = await requireCareTenantSession();
    const { searchParams } = new URL(req.url);
    const requestedTenantId = searchParams.get('tenantId');

    // The tenantId query param is preserved for backwards compatibility but
    // we always scope to the caller's tenant; the param can no longer be
    // used to cross tenants.
    if (requestedTenantId && requestedTenantId !== session.tenantId) {
      return NextResponse.json({ content: [], total: 0 });
    }

    const { data: content, error } = await supabase
      .from('installer_content')
      .select('id, title, content_type, system_type, description, file_url, status, created_at')
      .eq('tenant_id', session.tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    type ContentRow = {
      id: string; title: string; content_type: string; system_type: string | null;
      description: string | null; file_url: string | null; status: string | null; created_at: string;
    };
    const mapped = ((content || []) as ContentRow[]).map(item => ({
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      system_type: item.system_type,
      description: item.description,
      url: item.file_url ?? null,
      is_published: item.status === 'live',
      created_at: item.created_at,
    }));

    return NextResponse.json({
      content: mapped,
      total: mapped.length,
    });
  } catch (error) {
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}
