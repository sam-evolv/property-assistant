'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FolderOpen, RefreshCw, Plus, ChevronRight, Home, Grid, List, Search, Star, AlertTriangle, FolderPlus } from 'lucide-react';
import { DocumentGrid, UploadModal, FolderCard, CreateFolderModal, MoveToFolderModal, type ArchiveFolder } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES, getDisciplineDisplayName, type ArchiveDocument, type DisciplineType } from '@/lib/archive-constants';

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

interface HouseTypeGroup {
  houseTypeCode: string;
  houseTypeName: string | null;
  documentCount: number;
  documents: ArchiveDocument[];
}

export default function DisciplineDetailPage() {
  const params = useParams();
  const discipline = params.discipline as string;
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  
  const [allDocuments, setAllDocuments] = useState<ArchiveDocument[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [customFolders, setCustomFolders] = useState<ArchiveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingDocument, setMovingDocument] = useState<ArchiveDocument | null>(null);
  const [editingFolder, setEditingFolder] = useState<ArchiveFolder | null>(null);
  const [selectedHouseType, setSelectedHouseType] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<ArchiveFolder | null>(null);
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterImportant, setFilterImportant] = useState(false);
  const [filterMustRead, setFilterMustRead] = useState(false);

  const displayName = getDisciplineDisplayName(discipline);
  const disciplineInfo = DISCIPLINES[discipline as DisciplineType];

  const loadDocuments = useCallback(async () => {
    console.log('[Archive Page] loadDocuments called:', { tenantId, developmentId, discipline });
    if (!tenantId) {
      console.log('[Archive Page] No tenantId, skipping load');
      return;
    }
    
    setIsLoading(true);
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('tenantId', tenantId);
      urlParams.set('discipline', discipline);
      urlParams.set('pageSize', '500');
      
      if (developmentId) {
        urlParams.set('developmentId', developmentId);
        console.log('[Archive Page] Fetching documents for developmentId:', developmentId);
      } else {
        console.log('[Archive Page] No developmentId - will show "Select a Development" message');
      }
      
      const response = await fetch(`/api/archive/documents?${urlParams}`);
      console.log('[Archive Page] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Archive Page] Loaded documents:', data.documents?.length || 0);
        setAllDocuments(data.documents || []);
      } else {
        console.error('[Archive Page] API error:', response.status);
      }
    } catch (error) {
      console.error('[Archive] Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId, discipline]);

  const loadHouseTypes = useCallback(async () => {
    if (!tenantId || !developmentId) return;
    
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        setHouseTypes(data.houseTypes || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load house types:', error);
    }
  }, [tenantId, developmentId]);

  const loadCustomFolders = useCallback(async () => {
    if (!tenantId || !developmentId) return;
    
    try {
      const urlParams = new URLSearchParams();
      urlParams.set('tenantId', tenantId);
      urlParams.set('developmentId', developmentId);
      urlParams.set('discipline', discipline);
      if (selectedFolder) {
        urlParams.set('parentFolderId', selectedFolder.id);
      }
      
      const response = await fetch(`/api/archive/folders?${urlParams}`);
      if (response.ok) {
        const data = await response.json();
        setCustomFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[Archive] Failed to load folders:', error);
    }
  }, [tenantId, developmentId, discipline, selectedFolder]);

  useEffect(() => {
    if (!isHydrated || !tenantId) return;
    loadDocuments();
    loadHouseTypes();
    loadCustomFolders();
  }, [isHydrated, tenantId, developmentId, loadDocuments, loadHouseTypes, loadCustomFolders]);

  const handleUploadComplete = () => {
    loadDocuments();
    setShowUploadModal(false);
  };

  const handleRefresh = () => {
    loadDocuments();
    loadCustomFolders();
  };

  const handleFolderCreated = (folder: ArchiveFolder) => {
    if (editingFolder) {
      setCustomFolders(prev => prev.map(f => f.id === folder.id ? folder : f));
    } else {
      setCustomFolders(prev => [...prev, folder]);
    }
    setEditingFolder(null);
    setShowFolderModal(false);
  };

  const handleFolderClick = (folder: ArchiveFolder) => {
    setSelectedFolder(folder);
    setSelectedHouseType(null);
  };

  const handleFolderEdit = (folder: ArchiveFolder) => {
    setEditingFolder(folder);
    setShowFolderModal(true);
  };

  const handleFolderDelete = (folderId: string) => {
    setCustomFolders(prev => prev.filter(f => f.id !== folderId));
  };

  const handleBackFromFolder = () => {
    if (selectedFolder?.parent_folder_id) {
      const parentFolder = customFolders.find(f => f.id === selectedFolder.parent_folder_id);
      setSelectedFolder(parentFolder || null);
    } else {
      setSelectedFolder(null);
    }
    loadCustomFolders();
  };

  const handleMoveToFolder = (document: ArchiveDocument) => {
    setMovingDocument(document);
    setShowMoveModal(true);
  };

  const handleMoveConfirm = async (folderId: string | null) => {
    if (!movingDocument) return;
    
    try {
      const response = await fetch('/api/archive/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: movingDocument.file_name || movingDocument.title,
          folderId,
        }),
      });
      
      if (response.ok) {
        loadDocuments();
      } else {
        console.error('Failed to move document');
      }
    } catch (error) {
      console.error('Error moving document:', error);
    } finally {
      setMovingDocument(null);
      setShowMoveModal(false);
    }
  };

  const extractHouseTypeFromFilename = (filename: string): string | null => {
    const match = filename.match(/[_-](B[DS]\d{2})[_-]/i);
    if (match) return match[1].toUpperCase();
    const altMatch = filename.match(/(B[DS]\d{2})/i);
    if (altMatch) return altMatch[1].toUpperCase();
    return null;
  };

  const getDocumentHouseType = (doc: ArchiveDocument): string | null => {
    if (doc.house_type_code) return doc.house_type_code;
    const fromTitle = extractHouseTypeFromFilename(doc.title || '');
    if (fromTitle) return fromTitle;
    return extractHouseTypeFromFilename(doc.file_name || '');
  };

  const shouldShowFolders = useCallback((): boolean => {
    const docsWithHouseType = allDocuments.filter(doc => getDocumentHouseType(doc) !== null);
    return docsWithHouseType.length > 0 && docsWithHouseType.length >= allDocuments.length * 0.3;
  }, [allDocuments]);

  const groupedByHouseType = useCallback((): HouseTypeGroup[] => {
    const groups: Record<string, ArchiveDocument[]> = {};
    
    allDocuments.forEach(doc => {
      const houseType = getDocumentHouseType(doc);
      if (houseType) {
        if (!groups[houseType]) {
          groups[houseType] = [];
        }
        groups[houseType].push(doc);
      }
    });

    const result: HouseTypeGroup[] = Object.entries(groups)
      .map(([code, docs]) => {
        const houseType = houseTypes.find(ht => ht.house_type_code === code);
        return {
          houseTypeCode: code,
          houseTypeName: houseType?.name || null,
          documentCount: docs.length,
          documents: docs.sort((a, b) => (a.title || '').localeCompare(b.title || '')),
        };
      })
      .sort((a, b) => {
        const aPrefix = a.houseTypeCode.substring(0, 2);
        const bPrefix = b.houseTypeCode.substring(0, 2);
        if (aPrefix !== bPrefix) return aPrefix.localeCompare(bPrefix);
        const aNum = parseInt(a.houseTypeCode.substring(2)) || 0;
        const bNum = parseInt(b.houseTypeCode.substring(2)) || 0;
        return aNum - bNum;
      });

    return result;
  }, [allDocuments, houseTypes]);

  const filteredDocuments = useCallback(() => {
    let docs = allDocuments;
    
    if (selectedHouseType) {
      docs = docs.filter(d => getDocumentHouseType(d) === selectedHouseType);
    }
    
    if (selectedFolder) {
      docs = docs.filter(d => d.folder_id === selectedFolder.id);
    } else if (!selectedHouseType && customFolders.length > 0) {
      docs = docs.filter(d => !d.folder_id);
    }
    
    if (filterImportant) {
      docs = docs.filter(d => d.is_important === true);
    }
    
    if (filterMustRead) {
      const extDocs = docs as (ArchiveDocument & { must_read?: boolean })[];
      docs = extDocs.filter(d => d.must_read === true);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(d => 
        d.title?.toLowerCase().includes(query) ||
        d.file_name?.toLowerCase().includes(query)
      );
    }
    
    return docs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [allDocuments, selectedHouseType, selectedFolder, customFolders.length, searchQuery, filterImportant, filterMustRead]);

  const getDocumentCountForFolder = (folderId: string): number => {
    return allDocuments.filter(d => d.folder_id === folderId).length;
  };

  const importantCount = allDocuments.filter(d => d.is_important === true).length;
  const mustReadCount = allDocuments.filter(d => (d as ArchiveDocument & { must_read?: boolean }).must_read === true).length;

  const groups = groupedByHouseType();
  const currentDocs = filteredDocuments();
  const selectedGroup = selectedHouseType 
    ? groups.find(g => g.houseTypeCode === selectedHouseType)
    : null;
  const showFolderView = shouldShowFolders() && groups.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
      <div className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                <Link 
                  href="/developer/archive" 
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Smart Archive
                </Link>
                <ChevronRight className="w-3 h-3" />
                {selectedHouseType ? (
                  <>
                    <button
                      onClick={() => setSelectedHouseType(null)}
                      className="hover:text-white transition-colors"
                    >
                      {displayName}
                    </button>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-white">{selectedGroup?.houseTypeCode}</span>
                  </>
                ) : selectedFolder ? (
                  <>
                    <button
                      onClick={() => setSelectedFolder(null)}
                      className="hover:text-white transition-colors"
                    >
                      {displayName}
                    </button>
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-white">{selectedFolder.name}</span>
                  </>
                ) : (
                  <span className="text-white">{displayName}</span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-gold-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {selectedHouseType 
                      ? `${selectedGroup?.houseTypeCode}${selectedGroup?.houseTypeName ? ` - ${selectedGroup.houseTypeName}` : ''}`
                      : selectedFolder
                        ? selectedFolder.name
                        : displayName}
                  </h1>
                  <p className="text-gray-400 mt-0.5">
                    {selectedHouseType 
                      ? `${currentDocs.length} document${currentDocs.length !== 1 ? 's' : ''}`
                      : selectedFolder
                        ? `${currentDocs.length} document${currentDocs.length !== 1 ? 's' : ''}`
                        : showFolderView 
                          ? `${allDocuments.length} document${allDocuments.length !== 1 ? 's' : ''} in ${groups.length} folder${groups.length !== 1 ? 's' : ''}`
                          : `${allDocuments.length} document${allDocuments.length !== 1 ? 's' : ''}`}
                    {disciplineInfo && !selectedHouseType && !selectedFolder && ` • ${disciplineInfo.description}`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('folders')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'folders' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Folder view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-gray-700 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {developmentId && (
                <>
                  <button
                    onClick={() => { setEditingFolder(null); setShowFolderModal(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 font-medium hover:bg-gray-700 hover:text-white transition-all"
                  >
                    <FolderPlus className="w-5 h-5" />
                    <span>New Folder</span>
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Upload</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {allDocuments.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {(selectedHouseType || viewMode === 'list' || !showFolderView) && (
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gold-500 transition-colors"
                  />
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilterImportant(!filterImportant)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    filterImportant 
                      ? 'bg-gold-500/20 border-gold-500/50 text-gold-400' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <Star className={`w-4 h-4 ${filterImportant ? 'fill-gold-400' : ''}`} />
                  <span className="text-sm font-medium">Important</span>
                  {importantCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      filterImportant ? 'bg-gold-500/30 text-gold-300' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {importantCount}
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => setFilterMustRead(!filterMustRead)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    filterMustRead 
                      ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Must Read</span>
                  {mustReadCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      filterMustRead ? 'bg-red-500/30 text-red-300' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {mustReadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!developmentId ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Select a Development</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Choose a development from the sidebar to view documents.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : viewMode === 'folders' && !selectedHouseType && !selectedFolder ? (
          <div className="space-y-6">
            {customFolders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Custom Folders</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {customFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      documentCount={getDocumentCountForFolder(folder.id)}
                      onClick={() => handleFolderClick(folder)}
                      onEdit={handleFolderEdit}
                      onDelete={handleFolderDelete}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {showFolderView && groups.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                  {customFolders.length > 0 ? 'Auto-Detected House Types' : 'House Types'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {groups.map((group) => (
                    <button
                      key={group.houseTypeCode}
                      onClick={() => setSelectedHouseType(group.houseTypeCode)}
                      className="group p-6 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gold-500/30 rounded-xl text-left transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/10 flex items-center justify-center group-hover:from-gold-500/30 group-hover:to-gold-600/20 transition-colors">
                          <Home className="w-6 h-6 text-gold-400" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gold-400 transition-colors" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">{group.houseTypeCode}</h3>
                      {group.houseTypeName && (
                        <p className="text-sm text-gray-400 mb-2 truncate">{group.houseTypeName}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {group.documentCount} document{group.documentCount !== 1 ? 's' : ''}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Always show document grid when no folder grouping is possible */}
            {!showFolderView && customFolders.length === 0 && allDocuments.length > 0 && (
              <DocumentGrid
                documents={allDocuments}
                isLoading={false}
                page={1}
                totalPages={1}
                totalCount={allDocuments.length}
                onPageChange={() => {}}
                onDocumentDeleted={loadDocuments}
                onMoveToFolder={handleMoveToFolder}
                viewMode="grid"
              />
            )}
            
            {/* Show empty state when no documents at all */}
            {!showFolderView && customFolders.length === 0 && allDocuments.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Documents Yet</h3>
                <p className="text-gray-400 mb-4">Upload your first document to get started</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-black font-medium hover:bg-gold-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload Document
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {(selectedHouseType || selectedFolder) && (
              <button
                onClick={() => {
                  if (selectedFolder) {
                    handleBackFromFolder();
                  } else {
                    setSelectedHouseType(null);
                  }
                }}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {selectedFolder ? 'Back' : 'Back to folders'}
              </button>
            )}
            {allDocuments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Documents Yet</h3>
                <p className="text-gray-400 mb-4">Upload your first document to get started</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-500 text-black font-medium hover:bg-gold-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload Document
                </button>
              </div>
            ) : (
              <DocumentGrid
                documents={currentDocs}
                isLoading={false}
                page={1}
                totalPages={1}
                totalCount={currentDocs.length}
                onPageChange={() => {}}
                onDocumentDeleted={loadDocuments}
                onMoveToFolder={handleMoveToFolder}
                viewMode={viewMode === 'list' ? 'list' : 'grid'}
              />
            )}
          </>
        )}
      </div>

      {tenantId && developmentId && (
        <>
          <UploadModal
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onUploadComplete={handleUploadComplete}
            tenantId={tenantId}
            developmentId={developmentId}
            houseTypes={houseTypes}
          />
          <CreateFolderModal
            isOpen={showFolderModal}
            onClose={() => { setShowFolderModal(false); setEditingFolder(null); }}
            onFolderCreated={handleFolderCreated}
            tenantId={tenantId}
            developmentId={developmentId}
            discipline={discipline}
            parentFolderId={selectedFolder?.id}
            editFolder={editingFolder}
          />
          {movingDocument && (
            <MoveToFolderModal
              isOpen={showMoveModal}
              onClose={() => { setShowMoveModal(false); setMovingDocument(null); }}
              onMove={handleMoveConfirm}
              documentName={movingDocument.file_name || movingDocument.title}
              currentFolderId={movingDocument.folder_id || null}
              tenantId={tenantId}
              developmentId={developmentId}
              discipline={discipline}
            />
          )}
        </>
      )}
    </div>
  );
}
