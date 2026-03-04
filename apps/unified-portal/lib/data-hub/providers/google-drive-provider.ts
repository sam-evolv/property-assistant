/**
 * Google Drive Storage Provider
 *
 * Implements StorageProvider for Google Drive using the Drive API v3.
 * Only reads folder structure and file metadata — never downloads file content.
 */

import type { StorageProvider, StorageFolder, StorageFile } from '../storage-provider'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'

export class GoogleDriveProvider implements StorageProvider {
  provider = 'google_drive' as const
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async driveGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${DRIVE_API}${path}`)
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
      throw new Error(`Google Drive API error ${res.status}: ${body}`)
    }

    return res.json()
  }

  async listRootFolders(): Promise<StorageFolder[]> {
    const data = await this.driveGet<{
      files: Array<{ id: string; name: string; parents?: string[] }>
    }>('/files', {
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: 'files(id,name,parents)',
      pageSize: '100',
    })

    return (data.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      path: `/${f.name}`,
      parentId: null,
    }))
  }

  async listFolderContents(folderId: string): Promise<{ folders: StorageFolder[]; files: StorageFile[] }> {
    const data = await this.driveGet<{
      files: Array<{
        id: string
        name: string
        mimeType: string
        size?: string
        webViewLink?: string
        modifiedTime?: string
        parents?: string[]
      }>
    }>('/files', {
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,webViewLink,modifiedTime,parents)',
      pageSize: '200',
    })

    const folders: StorageFolder[] = []
    const files: StorageFile[] = []

    for (const item of data.files || []) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({
          id: item.id,
          name: item.name,
          path: item.name,
          parentId: folderId,
        })
      } else {
        files.push({
          id: item.id,
          name: item.name,
          path: item.name,
          mimeType: item.mimeType,
          sizeBytes: parseInt(item.size || '0', 10),
          webUrl: item.webViewLink || '',
          modifiedAt: item.modifiedTime || new Date().toISOString(),
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
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
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
