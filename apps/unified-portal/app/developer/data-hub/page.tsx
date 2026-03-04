'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HardDrive, Plus, RefreshCw, FolderTree, Unplug,
  ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2,
  Ruler, ShieldCheck, FileText, Briefcase, FolderOpen,
} from 'lucide-react'
import { FolderBrowser } from '@/components/data-hub/FolderBrowser'
import type { StorageFolder } from '@/lib/data-hub/storage-provider'

interface Connection {
  id: string
  provider: string
  display_name: string
  status: string
  last_sync_at: string | null
  last_error: string | null
  file_count: number
  created_at: string
}

interface Stats {
  totalFiles: number
  byCategory: Record<string, number>
}

interface WatchedFolder {
  id: string
  folder_id: string
  folder_path: string
  folder_name: string
  development_id: string | null
}

interface Development {
  id: string
  name: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    connected: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
    syncing: { color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
    error: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
    disconnected: { color: 'bg-gray-100 text-gray-500', icon: Unplug },
  }
  const { color, icon: Icon } = config[status] || config.disconnected
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      {status}
    </span>
  )
}

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'google_drive') {
    return (
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M8 2L2 12h6l6-10H8z" fill="#4285F4" />
          <path d="M14 2l6 10h-6l-6-10h6z" fill="#FBBC04" />
          <path d="M2 12l3 5h14l3-5H2z" fill="#34A853" />
        </svg>
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
      </svg>
    </div>
  )
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Ruler; color: string }> = {
  drawing: { label: 'Drawings', icon: Ruler, color: 'text-blue-600' },
  compliance: { label: 'Compliance', icon: ShieldCheck, color: 'text-green-600' },
  spec: { label: 'Specs', icon: FileText, color: 'text-amber-600' },
  commercial: { label: 'Commercial', icon: Briefcase, color: 'text-purple-600' },
  other: { label: 'Other', icon: FolderOpen, color: 'text-gray-500' },
}

export default function DataHubPage() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [expandedConnection, setExpandedConnection] = useState<string | null>(null)
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set())
  const [watchedFolders, setWatchedFolders] = useState<Record<string, WatchedFolder[]>>({})
  const [developments, setDevelopments] = useState<Development[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [connRes, statsRes] = await Promise.all([
        fetch('/api/data-hub/connections'),
        fetch('/api/data-hub/stats'),
      ])
      const connData = await connRes.json()
      const statsData = await statsRes.json()

      setConnections(connData.connections || [])
      setStats(statsData)
    } catch (err) {
      console.error('Failed to fetch data hub data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    // Fetch developments for mapping
    fetch('/api/developer/developments')
      .then((r) => r.json())
      .then((data) => setDevelopments(data.developments || data || []))
      .catch(() => {})
  }, [])

  const connectProvider = async (provider: 'google' | 'microsoft', subType?: string) => {
    setConnecting(provider)
    try {
      const type = provider === 'google' ? 'cloud_storage' : `cloud_storage_${subType || 'onedrive'}`
      const res = await fetch(`/api/integrations/oauth/${provider}?type=${type}`)
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      }
    } catch (err) {
      console.error('Failed to initiate OAuth:', err)
    } finally {
      setConnecting(null)
    }
  }

  const syncConnection = async (connectionId: string) => {
    setSyncingIds((prev) => new Set(prev).add(connectionId))
    try {
      await fetch(`/api/data-hub/sync?connectionId=${connectionId}`, { method: 'POST' })
      await fetchData()
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(connectionId)
        return next
      })
    }
  }

  const disconnectConnection = async (connectionId: string) => {
    try {
      await fetch(`/api/data-hub/connections?id=${connectionId}`, { method: 'DELETE' })
      await fetchData()
    } catch (err) {
      console.error('Disconnect failed:', err)
    }
  }

  const toggleFolderBrowser = async (connectionId: string) => {
    if (expandedConnection === connectionId) {
      setExpandedConnection(null)
      return
    }
    setExpandedConnection(connectionId)

    // Load watched folders for this connection
    if (!watchedFolders[connectionId]) {
      try {
        const res = await fetch(`/api/data-hub/connections/${connectionId}/folders`)
        const data = await res.json()
        // We need the watched folders from DB, not the provider folders
        // For now store an empty array - the FolderBrowser handles browsing
        setWatchedFolders((prev) => ({ ...prev, [connectionId]: data.watchedFolders || [] }))
      } catch {
        setWatchedFolders((prev) => ({ ...prev, [connectionId]: [] }))
      }
    }
  }

  const handleFolderToggle = async (connectionId: string, folder: StorageFolder, watched: boolean) => {
    try {
      if (watched) {
        await fetch(`/api/data-hub/connections/${connectionId}/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folder.id,
            folderPath: folder.path,
            folderName: folder.name,
          }),
        })
      } else {
        await fetch(`/api/data-hub/connections/${connectionId}/folders/${folder.id}`, {
          method: 'DELETE',
        })
      }

      // Refresh watched folders
      setWatchedFolders((prev) => {
        const current = prev[connectionId] || []
        if (watched) {
          return {
            ...prev,
            [connectionId]: [
              ...current,
              { id: '', folder_id: folder.id, folder_path: folder.path, folder_name: folder.name, development_id: null },
            ],
          }
        } else {
          return {
            ...prev,
            [connectionId]: current.filter((f) => f.folder_id !== folder.id),
          }
        }
      })
    } catch (err) {
      console.error('Failed to toggle folder watch:', err)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Hub</h1>
            <p className="text-sm text-gray-500">Connect and index your cloud storage</p>
          </div>
        </div>
      </div>

      {/* Connect Storage (always visible as Add option, or prominent when no connections) */}
      {connections.length === 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Connect Your Cloud Storage</h2>
          <p className="text-sm text-gray-500">
            Link your Google Drive or Microsoft 365 account to automatically index project files.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => connectProvider('google')}
              disabled={connecting === 'google'}
              className="flex items-center gap-4 p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M8 2L2 12h6l6-10H8z" fill="#4285F4" />
                  <path d="M14 2l6 10h-6l-6-10h6z" fill="#FBBC04" />
                  <path d="M2 12l3 5h14l3-5H2z" fill="#34A853" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Google Drive</h3>
                <p className="text-sm text-gray-500">Index your Drive folders automatically</p>
              </div>
              {connecting === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : (
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              )}
            </button>

            <button
              onClick={() => connectProvider('microsoft', 'onedrive')}
              disabled={connecting === 'microsoft'}
              className="flex items-center gap-4 p-6 bg-white rounded-xl border border-gray-200 hover:border-sky-300 hover:shadow-md transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center group-hover:scale-105 transition-transform">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
                  <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Microsoft 365</h3>
                <p className="text-sm text-gray-500">Works with OneDrive and SharePoint</p>
              </div>
              {connecting === 'microsoft' ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              ) : (
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-sky-500" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Connection Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Connected Storage</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => connectProvider('google')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Storage
                </button>
              </div>
            </div>

            {connections.map((conn) => {
              const isExpanded = expandedConnection === conn.id
              const isSyncing = syncingIds.has(conn.id) || conn.status === 'syncing'
              const connWatchedIds = new Set(
                (watchedFolders[conn.id] || []).map((f) => f.folder_id)
              )

              return (
                <div key={conn.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="p-5 flex items-center gap-4">
                    <ProviderIcon provider={conn.provider} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{conn.display_name}</h3>
                        <StatusBadge status={conn.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span>{conn.file_count} files indexed</span>
                        {conn.last_sync_at && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>Synced {timeAgo(conn.last_sync_at)}</span>
                          </>
                        )}
                      </div>
                      {conn.last_error && conn.status === 'error' && (
                        <p className="text-xs text-red-500 mt-1 truncate">{conn.last_error}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => syncConnection(conn.id)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={() => toggleFolderBrowser(conn.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition ${
                          isExpanded
                            ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <FolderTree className="w-3.5 h-3.5" />
                        Folders
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        onClick={() => disconnectConnection(conn.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                      >
                        <Unplug className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Folder Browser (inline) */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                      <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">
                        Select folders to watch
                      </p>
                      <FolderBrowser
                        connectionId={conn.id}
                        watchedFolderIds={connWatchedIds}
                        onFolderToggle={(folder, watched) =>
                          handleFolderToggle(conn.id, folder, watched)
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Classification Overview */}
          {stats && stats.totalFiles > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Classification Overview</h2>
              <p className="text-3xl font-bold text-gray-900">{stats.totalFiles}</p>
              <p className="text-sm text-gray-500 mb-4">files indexed</p>

              <div className="space-y-3">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const count = stats.byCategory[key] || 0
                  const pct = stats.totalFiles > 0 ? (count / stats.totalFiles) * 100 : 0
                  const Icon = cfg.icon

                  return (
                    <div key={key} className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
                      <span className="text-sm text-gray-700 w-24">{cfg.label}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gray-400 transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              key === 'drawing'
                                ? '#2563eb'
                                : key === 'compliance'
                                  ? '#16a34a'
                                  : key === 'spec'
                                    ? '#d97706'
                                    : key === 'commercial'
                                      ? '#9333ea'
                                      : '#6b7280',
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 w-10 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Development Mapping */}
          {connections.length > 0 && Object.values(watchedFolders).some((wf) => wf.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Development Mapping</h2>
              <p className="text-sm text-gray-500 mb-4">
                Assign watched folders to developments so the AI knows which scheme each folder belongs to.
              </p>
              <div className="space-y-3">
                {Object.entries(watchedFolders).map(([connId, folders]) =>
                  folders.map((folder) => (
                    <div
                      key={`${connId}-${folder.folder_id}`}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50"
                    >
                      <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{folder.folder_name}</span>
                      <select
                        className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700"
                        value={folder.development_id || ''}
                        onChange={async (e) => {
                          const devId = e.target.value || null
                          try {
                            // Update via POST with development_id
                            await fetch(`/api/data-hub/connections/${connId}/folders`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                folderId: folder.folder_id,
                                folderPath: folder.folder_path,
                                folderName: folder.folder_name,
                                developmentId: devId,
                              }),
                            })
                            setWatchedFolders((prev) => ({
                              ...prev,
                              [connId]: prev[connId].map((f) =>
                                f.folder_id === folder.folder_id
                                  ? { ...f, development_id: devId }
                                  : f
                              ),
                            }))
                          } catch (err) {
                            console.error('Failed to update development mapping:', err)
                          }
                        }}
                      >
                        <option value="">No development</option>
                        {developments.map((dev) => (
                          <option key={dev.id} value={dev.id}>
                            {dev.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
