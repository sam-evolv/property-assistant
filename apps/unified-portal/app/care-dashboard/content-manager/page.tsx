import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { ContentManagerClient } from './content-manager-client';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, db: { schema: 'public' } }
  );
}

function mapContentType(type: string): 'Video' | 'Document' | 'Article' | 'FAQ' {
  switch (type) {
    case 'video': return 'Video';
    case 'document': return 'Document';
    case 'guide': return 'Article';
    case 'faq': return 'FAQ';
    default: return 'Document';
  }
}

function mapCategory(category: string | null): string {
  switch (category) {
    case 'how_to': return 'Video Guides';
    case 'troubleshooting': return 'Troubleshooting';
    case 'product_manual': return 'Documents';
    default: return 'FAQs';
  }
}

export default async function ContentManagerPage() {
  let session;
  try {
    session = await requireRole(['installer', 'installer_admin', 'super_admin']);
  } catch {
    return <ContentManagerClient contentItems={[]} error="You do not have permission to view this page." />;
  }

  const tenantId = session.tenantId;
  const supabase = getSupabaseAdmin();

  try {
    const { data, error: fetchError } = await supabase
      .from('installer_content')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[ContentManager] Fetch error:', fetchError);
      return <ContentManagerClient contentItems={[]} error="Failed to load content." />;
    }

    const contentItems = (data || []).map((item: any, idx: number) => ({
      id: idx + 1,
      title: item.title || '',
      type: mapContentType(item.content_type),
      category: mapCategory(item.category),
      systemType: item.brand || 'All Systems',
      status: item.status === 'live' ? 'Live' as const : 'Draft' as const,
      views: item.view_count || 0,
      uploadDate: item.created_at ? item.created_at.split('T')[0] : '',
    }));

    return <ContentManagerClient contentItems={contentItems} />;
  } catch (err: any) {
    console.error('[ContentManager] Error:', err);
    return <ContentManagerClient contentItems={[]} error="Failed to load content. Please refresh the page." />;
  }
}
