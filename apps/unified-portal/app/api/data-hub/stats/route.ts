/**
 * Data Hub Stats API
 *
 * GET — returns file count totals and breakdown by category
 */

import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const supabase = getSupabaseAdmin()

    // Total files
    const { count: totalFiles } = await supabase
      .from('storage_files')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)

    // Count by category
    const categories = ['drawing', 'compliance', 'spec', 'commercial', 'other']
    const byCategory: Record<string, number> = {}

    for (const cat of categories) {
      const { count } = await supabase
        .from('storage_files')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', session.tenantId)
        .eq('category', cat)

      byCategory[cat] = count || 0
    }

    // Count uncategorized (null category)
    const { count: uncategorized } = await supabase
      .from('storage_files')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', session.tenantId)
      .is('category', null)

    byCategory.other = (byCategory.other || 0) + (uncategorized || 0)

    return NextResponse.json({
      totalFiles: totalFiles || 0,
      byCategory,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
