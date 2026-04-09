'use client'

import { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Loader2, Check } from 'lucide-react'
import type { StorageFolder } from '@/lib/data-hub/storage-provider'

interface FolderBrowserProps {
  connectionId: string
  onFolderToggle: (folder: StorageFolder, watched: boolean) => void
  watchedFolderIds: Set<string>
}

interface FolderNode {
  folder: StorageFolder
  children: FolderNode[] | null
  loading: boolean
  expanded: boolean
}

export function FolderBrowser({ connectionId, onFolderToggle, watchedFolderIds }: FolderBrowserProps) {
  const [roots, setRoots] = useState<FolderNode[] | null>(null)
  const [rootLoading, setRootLoading] = useState(false)
  const [rootLoaded, setRootLoaded] = useState(false)

  const loadRoots = useCallback(async () => {
    if (rootLoaded) return
    setRootLoading(true)
    try {
      const res = await fetch(`/api/data-hub/connections/${connectionId}/folders`)
      const data = await res.json()
      setRoots(
        (data.folders || []).map((f: StorageFolder) => ({
          folder: f,
          children: null,
          loading: false,
          expanded: false,
        }))
      )
      setRootLoaded(true)
    } catch (err) {
    } finally {
      setRootLoading(false)
    }
  }, [connectionId, rootLoaded])

  const toggleExpand = useCallback(
    async (node: FolderNode, path: number[]) => {
      if (node.expanded) {
        // Collapse
        updateNode(path, { ...node, expanded: false })
        return
      }

      if (node.children !== null) {
        updateNode(path, { ...node, expanded: true })
        return
      }

      // Load children
      updateNode(path, { ...node, loading: true })
      try {
        const res = await fetch(
          `/api/data-hub/connections/${connectionId}/folders?folderId=${node.folder.id}`
        )
        const data = await res.json()
        const childNodes: FolderNode[] = (data.folders || []).map((f: StorageFolder) => ({
          folder: f,
          children: null,
          loading: false,
          expanded: false,
        }))
        updateNode(path, { ...node, children: childNodes, loading: false, expanded: true })
      } catch (err) {
        updateNode(path, { ...node, loading: false })
      }
    },
    [connectionId]
  )

  const updateNode = (path: number[], newNode: FolderNode) => {
    setRoots((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      let current = updated
      for (let i = 0; i < path.length - 1; i++) {
        const idx = path[i]
        const parent = { ...current[idx] }
        parent.children = parent.children ? [...parent.children] : []
        current[idx] = parent
        current = parent.children
      }
      current[path[path.length - 1]] = newNode
      return updated
    })
  }

  // Auto-load on first render
  if (!rootLoaded && !rootLoading) {
    loadRoots()
  }

  if (rootLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading folders...
      </div>
    )
  }

  if (!roots || roots.length === 0) {
    return <p className="py-4 text-gray-400 text-sm">No folders found</p>
  }

  return (
    <div className="space-y-0.5">
      {roots.map((node, idx) => (
        <FolderRow
          key={node.folder.id}
          node={node}
          depth={0}
          path={[idx]}
          onExpand={toggleExpand}
          onToggleWatch={onFolderToggle}
          watchedFolderIds={watchedFolderIds}
        />
      ))}
    </div>
  )
}

function FolderRow({
  node,
  depth,
  path,
  onExpand,
  onToggleWatch,
  watchedFolderIds,
}: {
  node: FolderNode
  depth: number
  path: number[]
  onExpand: (node: FolderNode, path: number[]) => void
  onToggleWatch: (folder: StorageFolder, watched: boolean) => void
  watchedFolderIds: Set<string>
}) {
  const isWatched = watchedFolderIds.has(node.folder.id)

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 group cursor-pointer text-sm"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse */}
        <button
          onClick={() => onExpand(node, path)}
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          {node.loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : node.expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Folder icon */}
        {node.expanded ? (
          <FolderOpen className="w-4 h-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className={`w-4 h-4 flex-shrink-0 ${isWatched ? 'text-blue-500' : 'text-gray-400'}`} />
        )}

        {/* Name */}
        <span
          className={`flex-1 truncate ${isWatched ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
          onClick={() => onExpand(node, path)}
        >
          {node.folder.name}
        </span>

        {/* Watch checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleWatch(node.folder, !isWatched)
          }}
          className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
            isWatched
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 text-transparent group-hover:border-gray-400'
          }`}
        >
          <Check className="w-3 h-3" />
        </button>
      </div>

      {/* Children */}
      {node.expanded && node.children && (
        <div>
          {node.children.map((child, idx) => (
            <FolderRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              path={[...path, idx]}
              onExpand={onExpand}
              onToggleWatch={onToggleWatch}
              watchedFolderIds={watchedFolderIds}
            />
          ))}
          {node.children.length === 0 && (
            <p className="text-xs text-gray-400 py-1" style={{ paddingLeft: `${(depth + 1) * 20 + 28}px` }}>
              No subfolders
            </p>
          )}
        </div>
      )}
    </div>
  )
}
