import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  category: string | null;
  system_type: string | null;
  brand: string | null;
  model: string | null;
  file_url: string | null;
  view_count: number;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installation_id');

    if (!installationId) {
      return NextResponse.json(
        { error: 'installation_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Look up installation to get tenant_id, system_type, inverter_model, panel_model
    const { data: installation, error: installError } = await supabase
      .from('installations')
      .select('id, tenant_id, system_type, inverter_model, panel_model')
      .eq('id', installationId)
      .single();

    if (installError || !installation) {
      console.error('[Care Content] Installation lookup error:', installError);
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    // 2. Fetch installer_content where tenant_id matches and status is 'live'
    const { data: contentItems, error: contentError } = await supabase
      .from('installer_content')
      .select('id, title, description, content_type, category, system_type, brand, model, file_url, view_count, created_at')
      .eq('tenant_id', installation.tenant_id)
      .eq('status', 'live');

    if (contentError) {
      console.error('[Care Content] Content fetch error:', contentError);
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: 500 }
      );
    }

    const items: ContentItem[] = contentItems || [];

    // 3. Sort: content matching this specific inverter/panel model first,
    //    then system_type match, then general
    const getRelevanceScore = (item: ContentItem): number => {
      let score = 0;

      // Check if the item's brand/model matches the installation's inverter or panel model
      if (item.brand || item.model) {
        const inverterModel = installation.inverter_model?.toLowerCase() || '';
        const panelModel = installation.panel_model?.toLowerCase() || '';
        const itemBrand = item.brand?.toLowerCase() || '';
        const itemModel = item.model?.toLowerCase() || '';

        // Exact model match is highest priority
        if (itemModel && (inverterModel.includes(itemModel) || panelModel.includes(itemModel))) {
          score += 3;
        }
        // Brand match
        if (itemBrand && (inverterModel.includes(itemBrand) || panelModel.includes(itemBrand))) {
          score += 2;
        }
      }

      // System type match
      if (item.system_type && item.system_type === installation.system_type) {
        score += 1;
      }

      return score;
    };

    const sortedItems = [...items].sort((a, b) => {
      const scoreA = getRelevanceScore(a);
      const scoreB = getRelevanceScore(b);
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Secondary sort by view_count descending for equal relevance
      return (b.view_count || 0) - (a.view_count || 0);
    });

    // 4. Categorise by content_type
    const categorised: Record<string, ContentItem[]> = {};
    for (const item of sortedItems) {
      const type = item.content_type || 'other';
      if (!categorised[type]) {
        categorised[type] = [];
      }
      categorised[type].push(item);
    }

    return NextResponse.json({
      content: categorised,
    });
  } catch (error) {
    console.error('[Care Content] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
