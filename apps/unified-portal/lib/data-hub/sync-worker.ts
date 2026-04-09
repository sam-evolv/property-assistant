/**
 * Data Hub Sync Worker
 *
 * Syncs file metadata from connected cloud storage providers.
 * Classifies files and upserts metadata into storage_files — no file content is stored.
 */

import { createClient } from '@supabase/supabase-js'
import { decryptCredentials, encryptCredentials, isTokenExpiringSoon } from '@/lib/integrations/security/token-encryption'
import { GoogleDriveProvider } from './providers/google-drive-provider'
import { MicrosoftStorageProvider } from './providers/microsoft-storage-provider'
import { classifyFile } from './classifier'
import type { StorageProvider, StorageFile } from './storage-provider'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function createProvider(
  providerType: string,
  accessToken: string
): StorageProvider {
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

export async function syncConnection(connectionId: string): Promise<{ filesIndexed: number; errors: string[] }> {
  const supabase = getSupabaseAdmin()
  const errors: string[] = []
  let filesIndexed = 0

  try {
    // Update status to syncing
    await supabase
      .from('storage_connections')
      .update({ status: 'syncing', updated_at: new Date().toISOString() })
      .eq('id', connectionId)

    // Load connection
    const { data: connection, error: connError } = await supabase
      .from('storage_connections')
      .select('id, tenant_id, provider, credentials, status')
      .eq('id', connectionId)
      .single()

    if (connError || !connection) {
      throw new Error(`Connection not found: ${connError?.message || 'missing'}`)
    }

    // Decrypt credentials
    const creds = decryptCredentials(connection.tenant_id, connection.credentials)

    // Create provider and refresh token if needed
    const provider = createProvider(connection.provider, creds.access_token)

    if (isTokenExpiringSoon(creds.expires_at)) {
      try {
        const refreshed = await provider.refreshAccessToken(creds.refresh_token)
        creds.access_token = refreshed.accessToken
        creds.expires_at = new Date(refreshed.expiresAt).toISOString()

        // Re-encrypt and save updated credentials
        const encryptedCreds = encryptCredentials(connection.tenant_id, creds)
        await supabase
          .from('storage_connections')
          .update({ credentials: encryptedCreds })
          .eq('id', connectionId)
      } catch (refreshErr: unknown) {
        const msg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
        errors.push(`Token refresh failed: ${msg}`)
        throw refreshErr
      }
    }

    // Load watched folders
    const { data: watchedFolders } = await supabase
      .from('watched_folders')
      .select('id, folder_id, development_id')
      .eq('connection_id', connectionId)
      .eq('is_active', true)

    if (!watchedFolders || watchedFolders.length === 0) {
      await supabase
        .from('storage_connections')
        .update({
          status: 'connected',
          last_sync_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connectionId)

      return { filesIndexed: 0, errors: [] }
    }

    // Get all files from watched folders
    const folderIds = watchedFolders.map((f) => f.folder_id)
    let allFiles: StorageFile[] = []

    try {
      allFiles = await provider.listAllFiles(folderIds)
    } catch (listErr: unknown) {
      const msg = listErr instanceof Error ? listErr.message : String(listErr)
      errors.push(`Failed to list files: ${msg}`)
      throw listErr
    }

    // Build folder ID → watched_folder mapping
    const folderMap = new Map<string, typeof watchedFolders[0]>()
    for (const wf of watchedFolders) {
      folderMap.set(wf.folder_id, wf)
    }

    // Classify and upsert each file
    for (const file of allFiles) {
      try {
        const classification = await classifyFile(file.name, file.path)

        // Find which watched folder this file belongs to
        const watchedFolder = folderMap.get(file.parentFolderId)

        const { error: upsertError } = await supabase
          .from('storage_files')
          .upsert(
            {
              connection_id: connectionId,
              tenant_id: connection.tenant_id,
              folder_id: watchedFolder?.id || null,
              development_id: watchedFolder?.development_id || null,
              provider_file_id: file.id,
              file_name: file.name,
              file_path: file.path,
              mime_type: file.mimeType,
              file_size_bytes: file.sizeBytes,
              web_url: file.webUrl,
              category: classification.category,
              category_confidence: classification.confidence,
              provider_modified_at: file.modifiedAt,
              indexed_at: new Date().toISOString(),
            },
            { onConflict: 'connection_id,provider_file_id' }
          )

        if (upsertError) {
          errors.push(`Upsert failed for ${file.name}: ${upsertError.message}`)
        } else {
          filesIndexed++
        }
      } catch (fileErr: unknown) {
        const msg = fileErr instanceof Error ? fileErr.message : String(fileErr)
        errors.push(`Error processing ${file.name}: ${msg}`)
      }
    }

    // Update connection status
    await supabase
      .from('storage_connections')
      .update({
        status: errors.length > 0 ? 'error' : 'connected',
        last_sync_at: new Date().toISOString(),
        last_error: errors.length > 0 ? errors.slice(0, 5).join('; ') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    return { filesIndexed, errors }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // Set connection to error state
    await supabase
      .from('storage_connections')
      .update({
        status: 'error',
        last_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectionId)

    errors.push(msg)
    return { filesIndexed, errors }
  }
}
