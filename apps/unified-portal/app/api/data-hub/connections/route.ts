/**
 * Data Hub Connections API
 *
 * GET  — list all storage connections for the tenant (with file count stats)
 * DELETE ?id= — disconnect a storage connection
 */

import { NextRequest, NextResponse } from 'next/server'
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

    const { data: connections, error } = await supabase
      .from('storage_connections')
      .select('*')
      .eq('tenant_id', session.tenantId)
      .neq('status', 'disconnected')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get file counts per connection
    const connectionsWithStats = await Promise.all(
      (connections || []).map(async (conn) => {
        const { count } = await supabase
          .from('storage_files')
          .select('*', { count: 'exact', head: true })
          .eq('connection_id', conn.id)

        return { ...conn, file_count: count || 0 }
      })
    )

    return NextResponse.json({ connections: connectionsWithStats })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const connectionId = request.nextUrl.searchParams.get('id')

    if (!connectionId) {
      return NextResponse.json({ error: 'Missing connection id' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Verify ownership
    const { data: conn } = await supabase
      .from('storage_connections')
      .select('tenant_id')
      .eq('id', connectionId)
      .single()

    if (!conn || conn.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Remove watched folders and mark disconnected
    await supabase.from('watched_folders').delete().eq('connection_id', connectionId)
    await supabase.from('storage_files').delete().eq('connection_id', connectionId)
    await supabase
      .from('storage_connections')
      .update({
        status: 'disconnected',
        credentials: '{}',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
