/**
 * Microsoft Storage Provider (OneDrive + SharePoint)
 *
 * Implements StorageProvider using Microsoft Graph API v1.0.
 * Handles both OneDrive (personal drive) and SharePoint (site drives).
 */

import type { StorageProvider, StorageFolder, StorageFile, StorageProviderType } from '../storage-provider'

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

export class MicrosoftStorageProvider implements StorageProvider {
  provider: StorageProviderType
  private accessToken: string

  constructor(accessToken: string, provider: 'onedrive' | 'sharepoint' = 'onedrive') {
    this.accessToken = accessToken
    this.provider = provider
  }

  private get driveRoot(): string {
    return this.provider === 'sharepoint' ? '/sites/root/drive' : '/me/drive'
  }

  private async graphGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${GRAPH_API}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v)
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Microsoft Graph API error ${res.status}: ${body}`)
    }

    return res.json()
  }

  async listRootFolders(): Promise<StorageFolder[]> {
    const data = await this.graphGet<{
      value: Array<{
        id: string
        name: string
        folder?: { childCount: number }
        parentReference?: { path?: string }
      }>
    }>(`${this.driveRoot}/root/children`, {
      $filter: 'folder ne null',
      $select: 'id,name,folder,parentReference',
    })

    return (data.value || []).map((item) => ({
      id: item.id,
      name: item.name,
      path: `/${item.name}`,
      parentId: null,
      childCount: item.folder?.childCount,
    }))
  }

  async listFolderContents(folderId: string): Promise<{ folders: StorageFolder[]; files: StorageFile[] }> {
    const data = await this.graphGet<{
      value: Array<{
        id: string
        name: string
        folder?: { childCount: number }
        file?: { mimeType: string }
        size: number
        webUrl: string
        lastModifiedDateTime: string
        parentReference?: { path?: string; id?: string }
      }>
    }>(`${this.driveRoot}/items/${folderId}/children`, {
      $select: 'id,name,folder,file,size,webUrl,lastModifiedDateTime,parentReference',
      $top: '200',
    })

    const folders: StorageFolder[] = []
    const files: StorageFile[] = []

    for (const item of data.value || []) {
      if (item.folder) {
        folders.push({
          id: item.id,
          name: item.name,
          path: item.name,
          parentId: folderId,
          childCount: item.folder.childCount,
        })
      } else if (item.file) {
        files.push({
          id: item.id,
          name: item.name,
          path: item.name,
          mimeType: item.file.mimeType,
          sizeBytes: item.size,
          webUrl: item.webUrl,
          modifiedAt: item.lastModifiedDateTime,
          parentFolderId: folderId,
        })
      }
    }

    return { folders, files }
  }

  async listAllFiles(folderIds: string[]): Promise<StorageFile[]> {
    const allFiles: StorageFile[] = []

    const enumerateFolder = async (folderId: string, parentPath: string) => {
      const { folders, files } = await this.listFolderContents(folderId)

      for (const file of files) {
        allFiles.push({ ...file, path: `${parentPath}/${file.name}` })
      }

      for (const folder of folders) {
        await enumerateFolder(folder.id, `${parentPath}/${folder.name}`)
      }
    }

    for (const folderId of folderIds) {
      await enumerateFolder(folderId, '')
    }

    return allFiles
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    const tokens = await res.json()
    if (!res.ok || !tokens.access_token) {
      throw new Error(`Token refresh failed: ${JSON.stringify(tokens)}`)
    }

    this.accessToken = tokens.access_token

    return {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    }
  }
}
