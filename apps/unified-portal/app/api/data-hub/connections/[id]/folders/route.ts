/**
 * Data Hub Folder Browsing + Watching API
 *
 * GET  ?folderId= — browse folders for a connection (defaults to root)
 * POST — add a watched folder
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { decryptCredentials, isTokenExpiringSoon, encryptCredentials } from '@/lib/integrations/security/token-encryption'
import { GoogleDriveProvider } from '@/lib/data-hub/providers/google-drive-provider'
import { MicrosoftStorageProvider } from '@/lib/data-hub/providers/microsoft-storage-provider'
import type { StorageProvider } from '@/lib/data-hub/storage-provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function createProvider(providerType: string, accessToken: string): StorageProvider {
  switch (providerType) {
    case 'google_drive':
      return new GoogleDriveProvider(accessToken)
    case 'onedrive':
      return new MicrosoftStorageProvider(accessToken, 'onedrive')
    case 'sharepoint':
      return new MicrosoftStorageProvider(accessToken, 'sharepoint')
    default:
      throw new Error(`Unknown provider: ${providerType}`)
  }
}

async function getConnectionWithProvider(connectionId: string, tenantId: string) {
  const supabase = getSupabaseAdmin()

  const { data: connection } = await supabase
    .from('storage_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('tenant_id', tenantId)
    .single()

  if (!connection) {
    return null
  }

  const creds = decryptCredentials(connection.tenant_id, connection.credentials)
  const provider = createProvider(connection.provider, creds.access_token)

  // Refresh token if needed
  if (isTokenExpiringSoon(creds.expires_at)) {
    try {
      const refreshed = await provider.refreshAccessToken(creds.refresh_token)
      creds.access_token = refreshed.accessToken
      creds.expires_at = new Date(refreshed.expiresAt).toISOString()

      const encryptedCreds = encryptCredentials(connection.tenant_id, creds)
      await supabase
        .from('storage_connections')
        .update({ credentials: encryptedCreds })
        .eq('id', connectionId)
    } catch (err) {
      console.error('[Data Hub Folders] Token refresh failed:', err)
    }
  }

  return { connection, provider }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const { id: connectionId } = await params
    const folderId = request.nextUrl.searchParams.get('folderId')

    const result = await getConnectionWithProvider(connectionId, session.tenantId)
    if (!result) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const { provider } = result

    if (folderId) {
      const contents = await provider.listFolderContents(folderId)
      return NextResponse.json(contents)
    } else {
      const folders = await provider.listRootFolders()
      return NextResponse.json({ folders, files: [] })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Data Hub Folders GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin'])
    const { id: connectionId } = await params
    const body = await request.json()
    const { folderId, folderPath, folderName, developmentId } = body

    if (!folderId || !folderPath || !folderName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

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

    // Insert watched folder
    const { data: watchedFolder, error: insertError } = await supabase
      .from('watched_folders')
      .insert({
        connection_id: connectionId,
        tenant_id: session.tenantId,
        folder_id: folderId,
        folder_path: folderPath,
        folder_name: folderName,
        development_id: developmentId || null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ watchedFolder })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Data Hub Folders POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
