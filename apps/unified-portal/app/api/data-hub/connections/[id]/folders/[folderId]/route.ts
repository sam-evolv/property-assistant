/**
 * Data Hub Watched Folder Delete API
 *
 * DELETE — remove a watched folder by its provider folder ID
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const { id: connectionId, folderId } = await params

    const supabase = getSupabaseAdmin()

    // Verify connection ownership
    const { data: conn } = await supabase
      .from('storage_connections')
      .select('tenant_id')
      .eq('id', connectionId)
      .single()

    if (!conn || conn.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Delete watched folder
    const { error: deleteError } = await supabase
      .from('watched_folders')
      .delete()
      .eq('connection_id', connectionId)
      .eq('folder_id', folderId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
