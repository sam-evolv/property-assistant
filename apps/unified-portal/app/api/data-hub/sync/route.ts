/**
 * Data Hub Sync API
 *
 * POST ?connectionId= — trigger manual sync for a connection
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { syncConnection } from '@/lib/data-hub/sync-worker'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const connectionId = request.nextUrl.searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connectionId' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: conn } = await supabase
      .from('storage_connections')
      .select('tenant_id')
      .eq('id', connectionId)
      .single()

    if (!conn || conn.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const result = await syncConnection(connectionId)

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
