/**
 * Storage Provider Abstraction
 *
 * Common interface for Google Drive, OneDrive, and SharePoint.
 * Providers enumerate folders and files — no file content is downloaded.
 */

export interface StorageFolder {
  id: string
  name: string
  path: string
  parentId: string | null
  childCount?: number
}

export interface StorageFile {
  id: string
  name: string
  path: string
  mimeType: string
  sizeBytes: number
  webUrl: string
  modifiedAt: string
  parentFolderId: string
}

export type StorageProviderType = 'google_drive' | 'onedrive' | 'sharepoint'

export interface StorageProvider {
  provider: StorageProviderType
  listRootFolders(): Promise<StorageFolder[]>
  listFolderContents(folderId: string): Promise<{ folders: StorageFolder[]; files: StorageFile[] }>
  listAllFiles(folderIds: string[]): Promise<StorageFile[]>
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }>
}
