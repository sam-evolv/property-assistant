'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Folder, FolderPlus, Upload, RefreshCw, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DocumentGrid, UploadModal, DocumentListItem, CreateFolderModal } from '@/components/archive';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import type { ArchiveDocument } from '@/lib/archive-constants';

interface CustomFolder {
  id: string;
  name: string;
  tenant_id: string;
  development_id: string;
  discipline: string;
  color: string | null;
  icon: string | null;
}

interface HouseType {
  id: string;
  house_type_code: string;
  name: string | null;
}

export default function CustomFolderPage() {
  const params = useParams();
  const folderId = params.id as string;
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  
  const [folder, setFolder] = useState<CustomFolder | null>(null);
  const [subFolders, setSubFolders] = useState<CustomFolder[]>([]);
  const [documents, setDocuments] = useState<ArchiveDocument[]>([]);
  const [houseTypes, setHouseTypes] = useState<HouseType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFolderLoading, setIsFolderLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadFolder = useCallback(async () => {
    if (!folderId || !tenantId || !developmentId) return;
    
    setIsFolderLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('developmentId', developmentId);
      
      const response = await fetch(`/api/archive/folders/${folderId}?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFolder(data.folder);
      }
    } catch (error) {
      console.error('[CustomFolder] Failed to load folder:', error);
    } finally {
      setIsFolderLoading(false);
    }
  }, [folderId, tenantId, developmentId]);

  const loadDocuments = useCallback(async () => {
    if (!tenantId || !developmentId || !folderId) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('developmentId', developmentId);
      params.set('folderId', folderId);
      params.set('pageSize', '500');
      
      const response = await fetch(`/api/archive/documents?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('[CustomFolder] Failed to load documents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, developmentId, folderId]);

  const loadHouseTypes = useCallback(async () => {
    if (!developmentId) return;
    
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        setHouseTypes(data.houseTypes || []);
      }
    } catch (error) {
      console.error('[CustomFolder] Failed to load house types:', error);
    }
  }, [developmentId]);

  const loadSubFolders = useCallback(async () => {
    if (!tenantId || !developmentId || !folderId) return;
    
    try {
      const params = new URLSearchParams();
      params.set('tenantId', tenantId);
      params.set('developmentId', developmentId);
      params.set('parentFolderId', folderId);
      
      const response = await fetch(`/api/archive/folders?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSubFolders(data.folders || []);
      }
    } catch (error) {
      console.error('[CustomFolder] Failed to load sub-folders:', error);
    }
  }, [tenantId, developmentId, folderId]);

  useEffect(() => {
    if (!isHydrated || !tenantId || !developmentId) return;
    loadFolder();
  }, [isHydrated, tenantId, developmentId, loadFolder]);

  useEffect(() => {
    if (!isHydrated || !tenantId) return;
    loadDocuments();
    loadHouseTypes();
    loadSubFolders();
  }, [isHydrated, tenantId, developmentId, loadDocuments, loadHouseTypes, loadSubFolders]);

  const handleRefresh = () => {
    loadFolder();
    loadDocuments();
    loadSubFolders();
  };

  const handleFolderCreated = () => {
    loadSubFolders();
    setShowCreateFolderModal(false);
  };

  const handleUploadComplete = () => {
    loadDocuments();
    setShowUploadModal(false);
  };

  const handleDocumentUpdate = (docId: string, updates: Partial<ArchiveDocument>) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, ...updates } : doc
    ));
  };

  const handleDocumentDelete = (docId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(query) ||
      doc.file_name?.toLowerCase().includes(query)
    );
  });

  const folderColor = folder?.color || '#6b7280';

  if (isFolderLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Folder className="w-10 h-10 text-gray-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Category Not Found</h2>
        <p className="text-gray-500 mb-6">This category may have been deleted or moved.</p>
        <Link
          href="/developer/archive"
          className="flex items-center gap-2 text-gold-400 hover:text-gold-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/developer/archive"
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${folderColor}20` }}
              >
                <Folder className="w-7 h-7" style={{ color: folderColor }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{folder.name}</h1>
                <p className="text-gray-500 mt-0.5">
                  {documents.length} document{documents.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-gold-500/50 w-64"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setShowCreateFolderModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 border border-gray-200 text-gray-900 hover:bg-gray-200 transition-colors"
              >
                <FolderPlus className="w-5 h-5" />
                <span>New Folder</span>
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
              >
                <Upload className="w-5 h-5" />
                <span>Upload</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {subFolders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Folders</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {subFolders.map((subFolder) => (
                <Link
                  key={subFolder.id}
                  href={`/developer/archive/custom/${subFolder.id}`}
                  className="group p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-gold-500/30 hover:bg-gray-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${subFolder.color || '#6b7280'}20` }}
                    >
                      <Folder className="w-6 h-6" style={{ color: subFolder.color || '#6b7280' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-gold-400 transition-colors truncate">
                        {subFolder.name}
                      </h3>
                      <p className="text-sm text-gray-500">Sub-folder</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          searchQuery ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No matching documents</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Try adjusting your search query.
              </p>
            </div>
          ) : subFolders.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Folder className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Upload documents to this category, create sub-folders, or move existing documents here.
              </p>
            </div>
          ) : null
        ) : viewMode === 'grid' ? (
          <DocumentGrid 
            documents={filteredDocuments}
            onDocumentUpdate={handleDocumentUpdate}
            onDocumentDelete={handleDocumentDelete}
          />
        ) : (
          <div className="space-y-2">
            {filteredDocuments.map(doc => (
              <DocumentListItem 
                key={doc.id}
                document={doc}
                onDocumentUpdate={handleDocumentUpdate}
                onDocumentDelete={handleDocumentDelete}
              />
            ))}
          </div>
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
            defaultFolderId={folderId}
          />
          <CreateFolderModal
            isOpen={showCreateFolderModal}
            onClose={() => setShowCreateFolderModal(false)}
            onFolderCreated={handleFolderCreated}
            tenantId={tenantId}
            developmentId={developmentId}
            discipline={folder?.name || 'Custom'}
            parentFolderId={folderId}
          />
        </>
      )}
    </div>
  );
}
